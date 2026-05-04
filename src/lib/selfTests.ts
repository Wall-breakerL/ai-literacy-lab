import { PERSONALITY_PROFILES, getPersonalityCode, getPersonalityProfile } from "@/lib/personalityProfiles";
import {
  FALLBACK_QUESTIONNAIRE_BATCHES,
  FALLBACK_QUESTIONNAIRE_TOTAL,
} from "@/lib/fallbackQuestionnaire";
import { buildQuestionStem } from "@/lib/questionText";
import {
  findSimilarQuestionText,
  isSpecificScenario,
  validateQuestionnaireBatch,
  validateQuestionnaireTotal,
} from "@/lib/questionnaireValidation";
import { questionnaireReadyMessageForBatchKey, questionnaireReadyMessageForBatchMode } from "@/lib/questionnaireReadyMessage";
import { flattenBatchAnswers, getBatchKeyForPhase, getNextBatchKey } from "@/lib/sessionState";
import { completePortableArtifacts, normalizeSignatureDetailText } from "@/lib/reportPortableArtifacts";
import {
  buildMidDialoguePrompt,
  buildQuestionnaireBatchPrompt,
  buildResearcherToolPrompt,
  agentBOutputFromToolUses,
  questionnaireBatchOutputFromToolUses,
  normalizeMidDialogueOutput,
  normalizeMidDialogueTransitionRepairText,
  normalizeMidDialogueVisibleText,
  RESEARCHER_TOOL_SYSTEM,
} from "@/lib/researcher";
import { resolveReportQuestionnaireAnswers, scoreAnswer, scoreQuestionnaireAnswers } from "@/lib/reportScoring";
import { inferTargetContextFromMessages, normalizeTargetContext } from "@/lib/targetContext";
import { getHQRoundState, HQ_ROUNDS } from "@/lib/hqAgents";
import {
  buildHQReportFromDraft,
  HQ_PROBE_DEFINITIONS,
  scoreHQProbeResults,
  validateHQReportDraft,
  type HQProbeResult,
  type HQReportDraft,
} from "@/lib/hqScoring";
import type { AgentBOutput, Dimension, HQDimension, Message, QuestionnaireAnswer, QuestionnaireQuestion, SessionState } from "@/lib/types";

export interface SelfTestResult {
  name: string;
  status: "pass" | "fail";
  detail: string;
  group: "AI-MBTI" | "AI-HQ";
}

const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];

function test(group: SelfTestResult["group"], name: string, fn: () => string | void): SelfTestResult {
  try {
    const detail = fn() ?? "OK";
    return { group, name, status: "pass", detail };
  } catch (error) {
    return {
      group,
      name,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function answer(dimension: Dimension, score: number | null, reverse = false): QuestionnaireAnswer {
  return {
    dimension,
    score,
    reverse,
    question: `${dimension} test question`,
    scenario: "习惯",
    skipped: score == null,
    skipReason: score == null ? "unsure_or_not_applicable" : undefined,
  };
}

function repeatedAnswers(dimension: Dimension, count: number, score: number, reverse = false): QuestionnaireAnswer[] {
  return Array.from({ length: count }, (_, index) => ({
    ...answer(dimension, score, reverse),
    question: `${dimension} test question ${index + 1}`,
  }));
}

function skippedAnswer(dimension: Dimension, score: number | null = null): QuestionnaireAnswer {
  return {
    ...answer(dimension, score),
    skipped: true,
    skipReason: "unsure_or_not_applicable",
  };
}

function countHabitQuestions(questions: QuestionnaireQuestion[]): number {
  return questions.filter((question) => question.scenario.trim() === "习惯").length;
}

function assertHybridBatchShape(
  questions: QuestionnaireQuestion[],
  label: string,
  expected: { count: number; habits: number; perDimension: number; reversePerDimension: number }
) {
  assert(questions.length === expected.count, `${label} 应为 ${expected.count} 题`);
  assert(countHabitQuestions(questions) === expected.habits, `${label} 应包含 ${expected.habits} 道习惯题`);
  assert(
    questions.length - countHabitQuestions(questions) === expected.count - expected.habits,
    `${label} 应包含 ${expected.count - expected.habits} 道场景题`
  );
  for (const dimension of DIMENSIONS) {
    const items = questions.filter((question) => question.dimension === dimension);
    assert(items.length === expected.perDimension, `${label} 每维应有 ${expected.perDimension} 题：${dimension}`);
    assert(
      items.filter((question) => question.reverse).length === expected.reversePerDimension,
      `${label} 每维应有 ${expected.reversePerDimension} 道反向题：${dimension}`
    );
  }
}

function assertHybridTotalBalance(questions: QuestionnaireQuestion[]) {
  assert(questions.length === 24, "总卷应为 24 题");
  assert(countHabitQuestions(questions) === 12, "总卷应包含 12 道习惯题");
  for (const dimension of DIMENSIONS) {
    const items = questions.filter((question) => question.dimension === dimension);
    assert(items.length === 6, `总卷每维应有 6 题：${dimension}`);
    assert(items.filter((question) => question.reverse).length === 2, `总卷每维应有 2 道反向题：${dimension}`);
  }
}

function sessionState(overrides: Partial<SessionState>): SessionState {
  return {
    sessionId: "self-test-session",
    turn: 1,
    phase: "report",
    background: {
      role: "产品经理",
      tools: ["ChatGPT"],
      recentUse: "需求分析",
      goal: "提高需求拆解质量",
      goalStatus: "specific",
      goalType: "product_building",
    },
    evidence: [],
    openProbes: [],
    ...overrides,
  };
}

function hqProbeResults(hits: Partial<Record<HQDimension, boolean[]>>): Record<HQDimension, HQProbeResult[]> {
  return Object.fromEntries(
    HQ_PROBE_DEFINITIONS.map((definition) => [
      definition.dimension,
      definition.probes.map((probe, index) => ({
        hit: hits[definition.dimension]?.[index] ?? false,
        evidence: hits[definition.dimension]?.[index] ? `${probe.id} evidence` : "",
      })),
    ])
  ) as Record<HQDimension, HQProbeResult[]>;
}

function hqDraft(hits: Partial<Record<HQDimension, boolean[]>>): HQReportDraft {
  return {
    probeResults: hqProbeResults(hits),
    overall: "《AI-HQ 报告》测试总体分析。",
    dimensions: HQ_PROBE_DEFINITIONS.map((definition) => ({
      dimension: definition.dimension,
      analysis: `${definition.label}分析`,
      advice: `${definition.label}建议`,
    })),
    recommendations: ["先写清目标、约束和验收标准。", "把复杂任务拆成可检查的小步骤。"],
    promptTemplates: [
      { title: "任务契约模板", prompt: "请先确认目标、背景、约束和验收标准。" },
      { title: "修复模板", prompt: "请定位偏差、解释原因，并只重写有问题的部分。" },
    ],
  };
}

function userMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, index) => ({
    role: "user" as const,
    content: `用户回答 ${index + 1}`,
  }));
}

export function runAiMbtiSelfTests(): SelfTestResult[] {
  return [
    test("AI-MBTI", "正向题计分方向", () => {
      assert(scoreAnswer(answer("Relation", 6, false)) === 100, "正向题 6 应为 100 分");
      assert(scoreAnswer(answer("Relation", 1, false)) === 0, "正向题 1 应为 0 分");
    }),
    test("AI-MBTI", "反向题计分方向", () => {
      assert(scoreAnswer(answer("Workflow", 6, true)) === 0, "反向题 6 应为 0 分");
      assert(scoreAnswer(answer("Workflow", 1, true)) === 100, "反向题 1 应为 100 分");
    }),
    test("AI-MBTI", "不了解 / 没想好不计分", () => {
      assert(scoreAnswer(answer("Epistemic", null, false)) == null, "跳过题应返回 null");
      const scored = scoreQuestionnaireAnswers([
        answer("Relation", 6),
        answer("Relation", null),
        answer("Relation", 4),
        answer("Relation", null),
      ]);
      const relation = scored.find((item) => item.dimension === "Relation");
      assert(relation?.answeredCount === 2, "Relation 有效题数应为 2");
      assert(relation?.skippedCount === 2, "Relation 跳过题数应为 2");
    }),
    test("AI-MBTI", "Phase 6 24 题问卷计分", () => {
      const scored = scoreQuestionnaireAnswers(
        DIMENSIONS.flatMap((dimension) => repeatedAnswers(dimension, 6, 6))
      );
      assert(scored.length === 4, "应输出四个维度");
      assert(scored.every((dimension) => dimension.answeredCount === 6), "每个维度应有 6 道有效题");
      assert(scored.every((dimension) => dimension.confidence === "high"), "6 道有效题应为 high confidence");
      assert(scored.every((dimension) => dimension.score === 100), "正向 6 分题应计为 100");
    }),
    test("AI-MBTI", "Phase 6 confidence 阈值", () => {
      const scored = scoreQuestionnaireAnswers([
        ...repeatedAnswers("Relation", 4, 5),
        ...repeatedAnswers("Workflow", 3, 5),
        ...repeatedAnswers("Epistemic", 2, 5),
        ...repeatedAnswers("RepairScope", 1, 5),
      ]);
      assert(scored.find((item) => item.dimension === "Relation")?.confidence === "high", "4 题应为 high");
      assert(scored.find((item) => item.dimension === "Workflow")?.confidence === "medium", "3 题应为 medium");
      assert(scored.find((item) => item.dimension === "Epistemic")?.confidence === "medium", "2 题应为 medium");
      assert(scored.find((item) => item.dimension === "RepairScope")?.confidence === "low", "1 题应为 low");
    }),
    test("AI-MBTI", "Phase 6 跳过题不参与置信度和分数", () => {
      const scored = scoreQuestionnaireAnswers([
        answer("Relation", 6),
        answer("Relation", 6),
        skippedAnswer("Relation", 1),
        skippedAnswer("Relation", null),
      ]);
      const relation = scored.find((item) => item.dimension === "Relation");
      assert(relation?.answeredCount === 2, "跳过题不应计入有效题数");
      assert(relation?.skippedCount === 2, "跳过题数应保留");
      assert(relation?.confidence === "medium", "2 道有效题应为 medium");
      assert(relation?.score === 100, `跳过的 1 分不应拉低分数，实际 ${relation?.score}`);
    }),
    test("AI-MBTI", "Phase 6 batchAnswers 报告入口兜底", () => {
      const requestAnswer = { ...answer("Relation", 1), question: "request answer" };
      const flatAnswer = { ...answer("Workflow", 2), question: "flat answer" };
      const batchAnswer = { ...answer("Epistemic", 3), question: "batch answer" };
      const stateWithFlatAnswers = sessionState({
        answers: [flatAnswer],
        batchAnswers: {
          batch1: [batchAnswer],
        },
      });
      assert(
        resolveReportQuestionnaireAnswers({
          questionnaireAnswers: [requestAnswer],
          sessionState: stateWithFlatAnswers,
        })[0]?.question === "request answer",
        "请求中的扁平答案应优先于 sessionState"
      );
      const flatResolved = resolveReportQuestionnaireAnswers({ sessionState: stateWithFlatAnswers });
      assert(flatResolved.length === 1 && flatResolved[0]?.question === "flat answer", "已有扁平答案时不应混入 batchAnswers");
      const batchResolved = resolveReportQuestionnaireAnswers({
        sessionState: sessionState({
          batchAnswers: {
            batch1: [batchAnswer],
            batch2: [{ ...answer("RepairScope", 4), question: "batch2 answer" }],
          },
        }),
      });
      assert(batchResolved.length === 2, `缺少扁平答案时应展开 batchAnswers，实际 ${batchResolved.length}`);
      assert(batchResolved[0]?.question === "batch answer", "batchAnswers 应按批次顺序展开");
    }),
    test("AI-MBTI", "Phase 6 active 批次键与就绪文案", () => {
      assert(getBatchKeyForPhase("questionnaire_batch1") === "batch1", "questionnaire_batch1 → batch1");
      assert(getBatchKeyForPhase("questionnaire_batch2") === "batch2", "questionnaire_batch2 → batch2");
      assert(
        getBatchKeyForPhase("questionnaire_batch3") === undefined,
        "旧第三段阶段不映射到 active batch 键"
      );
      assert(getBatchKeyForPhase("interview") === undefined, "interview 无批次键");
      assert(getNextBatchKey("batch1") === "batch2", "batch1 后仅 batch2");
      assert(getNextBatchKey("batch2") === undefined, "batch2 后无下一批");
      const msg1 = questionnaireReadyMessageForBatchKey("batch1");
      const msg2 = questionnaireReadyMessageForBatchKey("batch2");
      assert(msg1.includes("第一部分问卷") && msg1.includes("点击按钮"), "第一部分问卷就绪应追加自然提示");
      assert(msg2.includes("第二部分问卷") && msg2.includes("点击按钮"), "第二部分问卷就绪应追加自然提示");
      assert(
        questionnaireReadyMessageForBatchMode("hybrid_batch1") === msg1 &&
          questionnaireReadyMessageForBatchMode("hybrid_batch2") === msg2,
        "batchMode 就绪文案应与批次键一致"
      );
    }),
    test("AI-MBTI", "Phase 6 flattenBatchAnswers 含 legacy batch3", () => {
      const a1 = { ...answer("Relation", 5), question: "b1" };
      const a2 = { ...answer("Workflow", 4), question: "b2" };
      const a3 = { ...answer("Epistemic", 3), question: "b3" };
      const flat = flattenBatchAnswers({
        batch1: [a1],
        batch2: [a2],
        batch3: [a3],
      });
      assert(
        flat.length === 3 && flat[0]?.question === "b1" && flat[1]?.question === "b2" && flat[2]?.question === "b3",
        "应按 batch1→batch2→batch3 顺序展开含旧批次答案"
      );
    }),
    test("AI-MBTI", "Phase 6 两段式兜底批次结构合法", () => {
      const first = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1;
      const second = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2;
      assertHybridBatchShape(first, "hybrid_batch1 fallback", {
        count: 8,
        habits: 4,
        perDimension: 2,
        reversePerDimension: 0,
      });
      assertHybridBatchShape(second, "hybrid_batch2 fallback", {
        count: 16,
        habits: 8,
        perDimension: 4,
        reversePerDimension: 2,
      });
      assert(validateQuestionnaireBatch(first, "hybrid_batch1"), "hybrid_batch1 fallback 应合法");
      assert(validateQuestionnaireBatch(second, "hybrid_batch2"), "hybrid_batch2 fallback 应合法");
      assert(validateQuestionnaireTotal(FALLBACK_QUESTIONNAIRE_TOTAL), "两部分 fallback 合并后应是合法 24 题");
      assertHybridTotalBalance(FALLBACK_QUESTIONNAIRE_TOTAL);
    }),
    test("AI-MBTI", "Phase 6 hybrid 批次允许泛场景（放宽校验）", () => {
      const genericScenarioBatch: QuestionnaireQuestion[] = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2.map((question) => ({
        ...question,
        scenario: question.scenario === "习惯" ? "习惯" : "日常使用 AI",
      }));
      assert(!isSpecificScenario("日常使用 AI"), "泛场景不应被视为具体场景");
      assert(!isSpecificScenario("使用 AI 时"), "带时间后缀的泛场景也不应被视为具体场景");
      assert(isSpecificScenario("写代码"), "三字但明确的中文任务场景应被接受");
      assert(isSpecificScenario("写代码时"), "短但明确的中文任务场景应被接受");
      assert(validateQuestionnaireBatch(genericScenarioBatch, "hybrid_batch2"), "hybrid batch 现已允许泛场景");
    }),
    test("AI-MBTI", "Phase 6 问卷去重检测", () => {
      const similar = findSimilarQuestionText(
        [{
          dimension: "Relation",
          scenario: "习惯",
          question: "我习惯把 AI 当成一起打磨思路的协作者，而不是只负责交付结果的工具。",
          reverse: false,
        }],
        [{
          dimension: "Relation",
          scenario: "习惯",
          question: "我习惯把 AI 当作一起打磨思路的协作者，而不是只负责交付结果的工具。",
          reverse: false,
        }]
      );
      assert(similar && similar.similarity >= 0.72, "高度相似题干应被检测出来");
    }),
    test("AI-MBTI", "Phase 6 prompt 优化保留问卷硬合约", () => {
      const firstPrompt = buildQuestionnaireBatchPrompt({
        sessionState: sessionState({ phase: "questionnaire_batch1" }),
        batchMode: "hybrid_batch1",
        existingQuestions: [],
      });
      const secondPrompt = buildQuestionnaireBatchPrompt({
        sessionState: sessionState({ phase: "questionnaire_batch2" }),
        batchMode: "hybrid_batch2",
        existingQuestions: FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1,
      });

      assert(firstPrompt.includes("第一部分问卷（8题）"), "第一部分 prompt 应使用自然批次名称");
      assert(firstPrompt.includes("4 道 scenario=\"习惯\""), "第一部分 prompt 应保留习惯题精确数量");
      assert(firstPrompt.includes("Relation / Workflow / Epistemic / RepairScope 各 2 题"), "第一部分 prompt 应保留每维题数");
      assert(firstPrompt.includes("每个维度 2 道 reverse=false、0 道 reverse=true"), "第一部分 prompt 应保留全正向合约");
      assert(secondPrompt.includes("第二部分问卷（16题）"), "第二部分 prompt 应使用自然批次名称");
      assert(secondPrompt.includes("8 道 scenario=\"习惯\""), "第二部分 prompt 应保留习惯题精确数量");
      assert(secondPrompt.includes("两部分合计后每个维度 6 题，其中 4 道 reverse=false、2 道 reverse=true"), "第二部分 prompt 应保留总卷方向合约");
    }),
    test("AI-MBTI", "Phase 6 batch validator 强制新正反向结构", () => {
      const invalidFirst = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1.map((question, index) => (
        index === 1 ? { ...question, reverse: true } : question
      ));
      const invalidSecond = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2.map((question, index) => (
        index === 0 ? { ...question, reverse: false } : question
      ));

      assert(validateQuestionnaireBatch(FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1, "hybrid_batch1"), "batch1 全正向应合法");
      assert(!validateQuestionnaireBatch(invalidFirst, "hybrid_batch1"), "batch1 出现反向题应非法");
      assert(validateQuestionnaireBatch(FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2, "hybrid_batch2"), "batch2 每维 2 正 2 反应合法");
      assert(!validateQuestionnaireBatch(invalidSecond, "hybrid_batch2"), "batch2 正反向失衡应非法");
    }),
    test("AI-MBTI", "Phase 6 prompt 优化分离自然对话与结构化输出", () => {
      assert(RESEARCHER_TOOL_SYSTEM.includes("双重职责"), "system prompt 应明确对话者与分析者两种职责");
      assert(RESEARCHER_TOOL_SYSTEM.includes("用户可见回复"), "system prompt 应标出用户可见回复边界");
      assert(RESEARCHER_TOOL_SYSTEM.includes("结构化工具调用"), "system prompt 应标出结构化工具边界");

      const interviewPrompt = buildResearcherToolPrompt([
        { role: "assistant", content: "嗨，欢迎！先聊聊你是做什么的吧？" },
        { role: "user", content: "我是大三学生，最近在准备项目作品集。" },
      ], 1, sessionState({ phase: "interview" }));
      assert(interviewPrompt.includes("自然承接用户的职业或身份"), "初始访谈 prompt 应强调自然承接");
      assert(interviewPrompt.includes("recentUse 先保留已有值"), "初始访谈 prompt 应防止把职业写入 recentUse");

      const midPrompt = buildMidDialoguePrompt({
        messages: [{ role: "user", content: "第二部分更想围绕代码评审，不要泛泛写作。" }],
        sessionState: sessionState({ phase: "mid_dialog1" }),
        dialogKey: "dialog1",
      });
      assert(midPrompt.includes("一句话自然承接"), "中途对话 prompt 应把用户可见回复收敛成一句自然承接");
      assert(midPrompt.includes("几乎总是 true"), "中途对话 prompt 应保留一轮后进入第二部分的节奏");
    }),
    test("AI-MBTI", "Qwen 字符串 tool 参数可恢复为访谈状态", () => {
      const malformedInput = `{"analysis":{"reasoning":"用户提供了职业身份。","background_summary":"用户是学生。"}
{"directive":{"action":"probe_new","hint":"追问 AI 使用场景"},"targetContext":{"role":"学生","recentUse":"使用 AI 完成日常任务","goal":"更有效地使用 AI","goalStatus":"missing","goalType":"learning"},"nextQuestions":[],"newEvidence":[{"quote":"学生","signal":"用户身份是学生","evidence_kind":"quote"}]}}`;
      const output = agentBOutputFromToolUses([
        {
          id: "call_qwen_tool_args",
          name: "update_session_state",
          input: malformedInput,
        },
      ], 1);

      assert(output, "应从 Qwen 字符串 tool 参数中恢复结构化输出");
      assert(output.targetContext, "应恢复 targetContext");
      assert(output.targetContext.role === "学生", `role 应恢复为学生，实际 ${output.targetContext.role}`);
      assert(output.directive.action === "probe_new", `directive.action 应恢复，实际 ${output.directive.action}`);
      assert(output.newEvidence, "应恢复 newEvidence");
      assert(output.newEvidence[0]?.quote === "学生", "newEvidence quote 应保留用户原话");
    }),
    test("AI-MBTI", "Qwen 字符串 tool 参数可恢复为第二批问卷", () => {
      const malformedInput = `{"analysis":{"reasoning":"生成第二批问卷。","background_summary":"学生使用 AI 写代码。"}
{"batchMode":"hybrid_batch2","targetContext":{"role":"学生","recentUse":"写代码","goal":"更有效地使用 AI","goalStatus":"missing","goalType":"coding_system"},"userFacingMessage":"第二部分问卷已准备好。","nextQuestions":[{"dimension":"Relation","scenario":"习惯","question":"我通常只把 AI 当成执行代码任务的工具。","reverse":true}],"newEvidence":[]}}`;
      const output = questionnaireBatchOutputFromToolUses([
        {
          id: "call_qwen_batch_args",
          name: "generate_questionnaire_batch",
          input: malformedInput,
        },
      ]);

      assert(output, "应从 Qwen 字符串 tool 参数中恢复第二批问卷输出");
      assert(output.nextQuestions?.length === 1, `应恢复 nextQuestions，实际 ${output.nextQuestions?.length ?? 0}`);
      assert(output.nextQuestions[0]?.dimension === "Relation", "应保留题目的维度");
      assert(output.userFacingMessage === "第二部分问卷已准备好。", "应恢复 userFacingMessage");
    }),
    test("AI-MBTI", "Phase 6 中途对话不泄漏内部提示", () => {
      assert(
        normalizeMidDialogueVisibleText("用更具体的日常行为场景引导用户描述：比如最近一次让 AI 写代码。") === "",
        "内部指令式文本不应作为中途对话正文"
      );
      assert(
        normalizeMidDialogueVisibleText("你平时用 AI 写代码时，哪一步最常让它参与？").startsWith("你平时"),
        "正常开放式追问应保留"
      );
      assert(
        normalizeMidDialogueTransitionRepairText("directive.hint: 用更具体的日常行为场景引导用户描述") === "",
        "过渡补句不应泄漏 directive.hint"
      );
      assert(
        normalizeMidDialogueTransitionRepairText("好，我会按你刚才说的写代码场景生成第二部分题目。").startsWith("好，我会"),
        "正常生成过渡句应保留"
      );
    }),
    test("AI-MBTI", "Phase 6 中途对话保留场景修正状态并直接进入第二部分", () => {
      const opening: Message = {
        role: "assistant",
        content: "第一部分答下来你觉得整体感觉怎么样？",
      };
      const userReply: Message = {
        role: "user",
        content: "这些题可以，但第二部分更希望围绕代码评审，不要问泛泛写作。",
      };
      const output: AgentBOutput = {
        analysis: {
          reasoning: "用户给出第二部分的真实场景修正。",
          background_summary: "用户希望围绕代码评审继续。",
        },
        directive: { action: "clarify" },
        nextQuestions: [],
        scenarioGuidance: {
          status: "refined",
          scenarioSummary: "代码评审",
          granularity: "specific",
          includeTopics: ["代码评审"],
          avoidTopics: ["泛泛写作"],
          userCorrectionQuote: userReply.content,
        },
        shouldGenerateNextBatch: false,
      };
      const normalized = normalizeMidDialogueOutput({
        agentBOutput: output,
        messages: [opening, userReply],
        sessionState: sessionState({
          phase: "mid_dialog1",
          midDialogues: { dialog1: [opening] },
        }),
        dialogKey: "dialog1",
      });
      assert(normalized.directive.action === "finish_mid_dialog", "中途对话应一轮后结束");
      assert(normalized.shouldGenerateNextBatch === true, "中途对话后应直接生成第二部分");
      assert(normalized.scenarioGuidance?.status === "refined", "应保留 refined 场景修正状态");
      assert(normalized.scenarioGuidance?.includeTopics.includes("代码评审"), "应保留 includeTopics");
    }),
    test("AI-MBTI", "四维报告总是补齐", () => {
      const scored = scoreQuestionnaireAnswers([answer("Relation", 6)]);
      assert(scored.length === 4, "应补齐四个维度");
      assert(DIMENSIONS.every((dimension) => scored.some((item) => item.dimension === dimension)), "四维缺失");
    }),
    test("AI-MBTI", "人格 code 判定", () => {
      const scored = scoreQuestionnaireAnswers([
        answer("Relation", 6),
        answer("Workflow", 6),
        answer("Epistemic", 6),
        answer("RepairScope", 6),
      ]);
      assert(getPersonalityCode(scored) === "CETL", `预期 CETL，实际 ${getPersonalityCode(scored)}`);
    }),
    test("AI-MBTI", "16 型人格配置完整", () => {
      const codes = Object.keys(PERSONALITY_PROFILES);
      assert(codes.length === 16, `应有 16 个 profile，实际 ${codes.length}`);
      for (const code of codes) {
        const profile = getPersonalityProfile(code);
        assert(profile.name.length > 0, `${code} 缺少 name`);
        assert(profile.signatureHeadline.length > 0, `${code} 缺少 signatureHeadline`);
        assert(profile.avatarPrompt.includes("MBTI"), `${code} avatarPrompt 未包含 MBTI 风格约束`);
      }
    }),
    test("AI-MBTI", "Phase 5 可携带产物兜底完整", () => {
      const scored = scoreQuestionnaireAnswers([
        answer("Relation", 2),
        answer("Workflow", 1, true),
        answer("Epistemic", 2, true),
        answer("RepairScope", 5),
      ]);
      const profile = getPersonalityProfile(getPersonalityCode(scored));
      const artifacts = completePortableArtifacts(
        {},
        profile,
        {
          role: "医生",
          recentUse: "科研写作和文献综述",
          goal: "提高论文初稿质量",
          goalStatus: "specific",
          goalType: "research_writing",
        },
        scored
      );
      const manifestoLength = Array.from(artifacts.collaborationManifesto).filter((char) => !/\s/.test(char)).length;
      assert(artifacts.styleOverview.corePattern.length > 0, "styleOverview.corePattern 缺失");
      assert(artifacts.styleOverview.strengthArea.length > 0, "styleOverview.strengthArea 缺失");
      assert(artifacts.styleOverview.growthDirection.includes("AI"), "growthDirection 应包含可执行 AI 动作");
      assert(manifestoLength >= 100 && manifestoLength <= 220, `manifesto 长度异常：${manifestoLength}`);
      assert(artifacts.collaborationManifesto.includes("医生"), "manifesto 应包含 role");
      assert(artifacts.collaborationManifesto.includes("科研写作"), "manifesto 应包含 recentUse");
      assert(artifacts.collaborationSignature.headline === profile.signatureHeadline, "signature headline 应来自固定 profile");
      assert(artifacts.collaborationSignature.detail.includes("从本次回答看"), "signature detail 应限定证据来源");
    }),
    test("AI-MBTI", "Phase 5 signature detail 不显示 JSON 包装", () => {
      const wrapped = "{\"detail\":\"从本次回答看，你会把 AI 当作一起搭结构的伙伴，同时保留自己核实细节和局部修正的节奏。\"}";
      const normalized = normalizeSignatureDetailText(wrapped);
      const nested = normalizeSignatureDetailText({
        detail: {
          detail: "从本次回答看，你会把 AI 当作一起搭结构的伙伴，同时保留自己核实细节和局部修正的节奏。",
        },
      });
      assert(normalized?.startsWith("从本次回答看"), "应解包 stringified JSON detail");
      assert(!normalized?.includes("{\"detail\""), "不应保留 JSON 包装");
      assert(nested?.startsWith("从本次回答看"), "应解包嵌套 detail 对象");

      const scored = scoreQuestionnaireAnswers([
        answer("Relation", 6),
        answer("Workflow", 5),
        answer("Epistemic", 2, true),
        answer("RepairScope", 5),
      ]);
      const artifacts = completePortableArtifacts(
        { collaborationSignature: { detail: wrapped } },
        getPersonalityProfile(getPersonalityCode(scored)),
        {
          role: "学生",
          recentUse: "写代码",
          goal: "完成个人项目",
          goalStatus: "specific",
          goalType: "coding_system",
        },
        scored
      );
      assert(artifacts.collaborationSignature.detail.startsWith("从本次回答看"), "signature detail 应使用解包后的正文");
      assert(!artifacts.collaborationSignature.detail.includes("{\"detail\""), "报告中不应显示 JSON 包装");
    }),
    test("AI-MBTI", "问卷题面合成", () => {
      const q: QuestionnaireQuestion = {
        dimension: "Workflow",
        scenario: "如果科研写作遇到结构不清",
        question: "我会先让 AI 给出几种路径，再选择其中一种继续打磨。",
        reverse: false,
      };
      const stem = buildQuestionStem(q);
      assert(stem.label === "目标场景", "场景题 label 应为目标场景");
      assert(stem.stem.startsWith("在科研写作遇到结构不清时"), `题面不自然：${stem.stem}`);
    }),
    test("AI-MBTI", "targetContext 兜底", () => {
      const inferred = inferTargetContextFromMessages([
        { role: "user", content: "医生，有用过 GPT 写科研相关报告，希望提高科研写作效率" },
      ]);
      const normalized = normalizeTargetContext(undefined, inferred);
      assert(normalized.role.includes("医生"), `role 推断异常：${normalized.role}`);
      assert(normalized.goalType === "research_writing", `goalType 应为 research_writing，实际 ${normalized.goalType}`);
    }),
  ];
}

export function runAiHqSelfTests(): SelfTestResult[] {
  return [
    test("AI-HQ", "固定 5 段推进", () => {
      for (let count = 0; count < HQ_ROUNDS.length; count++) {
        const state = getHQRoundState(userMessages(count));
        assert(!state.isComplete, `${count} 条用户回答时不应完成`);
        assert(state.round?.id === HQ_ROUNDS[count].id, `${count} 条用户回答时阶段错误`);
      }
      assert(getHQRoundState(userMessages(5)).isComplete, "5 条用户回答后应完成");
    }),
    test("AI-HQ", "probe 权重计分", () => {
      const scores = scoreHQProbeResults(
        hqProbeResults({
          route: [true, false, true],
          frame: [true, true, false, false, true, false, false, true],
          workflow: [true, false, true, false],
          repair: [true, true, false],
        })
      );
      assert(scores.route.score === 20, `route 应为 20，实际 ${scores.route.score}`);
      assert(scores.frame.score === 20, `frame 应为 20，实际 ${scores.frame.score}`);
      assert(scores.workflow.score === 14, `workflow 应为 14，实际 ${scores.workflow.score}`);
      assert(scores.repair.score === 15, `repair 应为 15，实际 ${scores.repair.score}`);
    }),
    test("AI-HQ", "等级门槛会降级", () => {
      const scores = scoreHQProbeResults(
        hqProbeResults({
          route: [true, true, true],
          frame: [true, true, true, true, true, true, true, true],
          workflow: [true, true, true, true],
          repair: [false, false, false],
        })
      );
      assert(scores.total === 80, `总分应为 80，实际 ${scores.total}`);
      assert(scores.level === "L1", `repair 不达 L2 门槛时应降级为 L1，实际 ${scores.level}`);
    }),
    test("AI-HQ", "B 输出校验", () => {
      assert(validateHQReportDraft(hqDraft({ route: [true, true, true] })), "合法 draft 应通过");
      const invalid = hqDraft({});
      invalid.probeResults.frame = invalid.probeResults.frame.slice(0, 2);
      assert(!validateHQReportDraft(invalid), "probe 长度错误应失败");
    }),
    test("AI-HQ", "报告合并由服务端计分", () => {
      const report = buildHQReportFromDraft(
        hqDraft({
          route: [true, true, true],
          frame: [true, true, true, true, true, true, true, true],
          workflow: [true, true, true, true],
          repair: [true, true, true],
        })
      );
      assert(report.scores.total === 100, `服务端应算出 100 分，实际 ${report.scores.total}`);
      assert(report.dimensions.every((dimension) => dimension.evidence.length > 0), "命中 probe 应合并 evidence");
      assert(report.promptTemplates.length >= 2, "报告应保留 prompt 模板");
    }),
    test("AI-HQ", "默认题目跨领域", () => {
      const text = HQ_ROUNDS.map((round) => `${round.question}\n${round.scenarioPrompt ?? ""}`).join("\n");
      assert(!/Cursor|Claude Code|coding|MBTI|代码/.test(text), "默认题目不应强依赖 coding 场景");
    }),
  ];
}

export function runSelfTests(): SelfTestResult[] {
  return [...runAiMbtiSelfTests(), ...runAiHqSelfTests()];
}

export function summarizeSelfTests(results: SelfTestResult[]) {
  const passed = results.filter((result) => result.status === "pass").length;
  return {
    passed,
    failed: results.length - passed,
    total: results.length,
  };
}
