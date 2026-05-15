import { PERSONALITY_PROFILES, getPersonalityCode, getPersonalityProfile } from "@/lib/personalityProfiles";
import {
  FALLBACK_QUESTIONNAIRE,
  FALLBACK_QUESTIONNAIRE_BATCHES,
  FALLBACK_QUESTIONNAIRE_TOTAL,
} from "@/lib/fallbackQuestionnaire";
import { createSessionStateFromIntake } from "@/lib/intakeState";
import { buildScenarioGuidanceFromForm } from "@/lib/midFeedbackState";
import { buildQuestionStem } from "@/lib/questionText";
import { normalizeGeneratedQuestionBatch } from "@/lib/questionnaireBatchNormalize";
import {
  findSimilarQuestionText,
  isSpecificScenario,
  validateQuestionnaireBatch,
  validateQuestionnaireTotal,
} from "@/lib/questionnaireValidation";
import { questionnaireReadyMessageForBatchKey, questionnaireReadyMessageForBatchMode } from "@/lib/questionnaireReadyMessage";
import { flattenBatchAnswers, getBatchKeyForPhase, getNextBatchKey } from "@/lib/sessionState";
import { completePortableArtifacts, normalizeSignatureDetailText } from "@/lib/reportPortableArtifacts";
import { getFallbackPromptTemplate, getPersonalityNextAction, normalizeReportTaskLabel } from "@/lib/reportDisplayContext";
import { normalizeGeneratedReportDraft } from "@/lib/reportModelOutput";
import { completeReportToolbox } from "@/lib/reportToolbox";
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
import { isSkippedQuestionnaireAnswer, resolveReportQuestionnaireAnswers, scoreAnswer, scoreQuestionnaireAnswers } from "@/lib/reportScoring";
import { inferTargetContextFromMessages, normalizeTargetContext } from "@/lib/targetContext";
import { getQuestionnaireLoadingProgress, getReportLoadingProgress } from "@/lib/loadingProgress";
import {
  buildPublicAnalyticsSummary,
  sanitizeTestResultPayload,
  sanitizeVisitPayload,
} from "@/lib/analytics/shared";
import type { AgentBOutput, Dimension, Message, QuestionnaireAnswer, QuestionnaireQuestion, SessionState } from "@/lib/types";

export interface SelfTestResult {
  name: string;
  status: "pass" | "fail";
  detail: string;
  group: "AI-MBTI";
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

function assertQuestionTypes(
  questions: QuestionnaireQuestion[],
  expected: Record<NonNullable<QuestionnaireQuestion["questionType"]>, number>,
  label: string
) {
  for (const [type, count] of Object.entries(expected)) {
    const actual = questions.filter((question) => question.questionType === type).length;
    assert(actual === count, `${label} ${type} 应为 ${count} 题，实际 ${actual}`);
  }
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

function assertHybridBatchShape(
  questions: QuestionnaireQuestion[],
  label: string,
  expected: {
    count: number;
    perDimension: number;
    reversePerDimension: number;
    questionTypes: Record<NonNullable<QuestionnaireQuestion["questionType"]>, number>;
  }
) {
  assert(questions.length === expected.count, `${label} 应为 ${expected.count} 题`);
  assertQuestionTypes(questions, expected.questionTypes, label);
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
  assert(questions.length === 16, "总卷应为 16 题");
  assertQuestionTypes(questions, { universal: 4, semi_specific: 8, specific: 4 }, "总卷");
  for (const dimension of DIMENSIONS) {
    const items = questions.filter((question) => question.dimension === dimension);
    assert(items.length === 4, `总卷每维应有 4 题：${dimension}`);
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
    },
    evidence: [],
    openProbes: [],
    ...overrides,
  };
}

export function runAiMbtiSelfTests(): SelfTestResult[] {
  return [
    test("AI-MBTI", "信息收集页创建简化 SessionState", () => {
      const state = createSessionStateFromIntake({
        role: "产品经理",
        recentUse: "我用 Claude 写需求文档，并让它补充边界情况",
        tools: ["Claude", "Cursor"],
      });
      assert(state.phase === "questionnaire_batch1", "intake 后应进入第一轮问卷阶段");
      assert(state.background.role === "产品经理", "role 应来自表单");
      assert(state.background.tools.includes("Claude"), "tools 应来自表单");
      assert(!("goalStatus" in state.background), "新流程 background 不应包含 goalStatus");
      assert(!("goalType" in state.background), "新流程 background 不应包含 goalType");
      assert(state.questionnaireBatches?.batch1 === undefined, "intake 阶段不应已有题目");
    }),
    test("AI-MBTI", "中途反馈表单本地生成 ScenarioGuidance", () => {
      const guidance = buildScenarioGuidanceFromForm(
        {
          overallFeeling: "far",
          issueText: "第 3 题太抽象，没法回答",
          focusScenario: "写产品需求文档时补充边界情况",
        },
        "用 AI 写需求文档"
      );
      assert(guidance.status === "abstract_scenarios", "不太贴近应映射为 abstract_scenarios");
      assert(guidance.granularity === "specific", "填写聚焦场景后应为 specific");
      assert(guidance.includeTopics.includes("写产品需求文档时补充边界情况"), "应保留聚焦场景关键词");
      assert(guidance.userCorrectionQuote?.includes("第 3 题"), "应保留题号反馈原文");
    }),
    test("AI-MBTI", "正向题计分方向", () => {
      assert(scoreAnswer(answer("Relation", 5, false)) === 5, "正向题 5 应贡献 5 分");
      assert(scoreAnswer(answer("Relation", 0, false)) === 0, "正向题 0 应贡献 0 分");
    }),
    test("AI-MBTI", "不了解 / 没想好按 2.5 计分", () => {
      const skipped = answer("Epistemic", null, false);
      assert(isSkippedQuestionnaireAnswer(skipped), "跳过题应可被 UI 明确识别");
      assert(scoreAnswer(skipped) === 2.5, "跳过题应贡献中位数 2.5");
      const scored = scoreQuestionnaireAnswers([
        answer("Relation", 5),
        answer("Relation", null),
        answer("Relation", 3),
        answer("Relation", null),
      ]);
      const relation = scored.find((item) => item.dimension === "Relation");
      assert(relation?.answeredCount === 2, "Relation 已答题数应为 2");
      assert(relation?.skippedCount === 2, "Relation 跳过题数应为 2");
      assert(relation?.score === 13, `Relation 分数应为 13/20，实际 ${relation?.score}`);
      assert(relation?.scoreMax === 20, "Relation 满分应为 20");
    }),
    test("AI-MBTI", "16 题问卷计分", () => {
      const scored = scoreQuestionnaireAnswers(
        DIMENSIONS.flatMap((dimension) => repeatedAnswers(dimension, 4, 5))
      );
      assert(scored.length === 4, "应输出四个维度");
      assert(scored.every((dimension) => dimension.answeredCount === 4), "每个维度应有 4 道已答题");
      assert(scored.every((dimension) => dimension.confidence === "high"), "远离中点应为 high confidence");
      assert(scored.every((dimension) => dimension.score === 20), "4 道 5 分题应计为 20");
      assert(scored.every((dimension) => dimension.scorePercent === 100), "满分百分比应为 100");
    }),
    test("AI-MBTI", "双向锚定计分能区分高端和低端倾向", () => {
      const highEnd = scoreQuestionnaireAnswers([
        answer("Workflow", 5, false),
        answer("Workflow", 5, false),
        answer("Workflow", 0, true),
        answer("Workflow", 0, true),
      ]);
      const lowEnd = scoreQuestionnaireAnswers([
        answer("Workflow", 0, false),
        answer("Workflow", 0, false),
        answer("Workflow", 5, true),
        answer("Workflow", 5, true),
      ]);

      const highWorkflow = highEnd.find((item) => item.dimension === "Workflow");
      const lowWorkflow = lowEnd.find((item) => item.dimension === "Workflow");
      assert(highWorkflow?.tendencyLabel === "框架型", `高端锚定应判为框架型，实际 ${highWorkflow?.tendencyLabel}`);
      assert(highWorkflow?.score === 20, `高端锚定应为 20/20，实际 ${highWorkflow?.score}`);
      assert(lowWorkflow?.tendencyLabel === "探索型", `低端锚定应判为探索型，实际 ${lowWorkflow?.tendencyLabel}`);
      assert(lowWorkflow?.score === 0, `低端锚定应为 0/20，实际 ${lowWorkflow?.score}`);
    }),
    test("AI-MBTI", "四维极端行为应落到正确分数端", () => {
      const cases: Array<{
        label: string;
        dimension: Dimension;
        answers: QuestionnaireAnswer[];
        expectedScore: number;
        expectedLabel: string;
      }> = [
        {
          label: "工具型",
          dimension: "Relation",
          answers: [answer("Relation", 0, false), answer("Relation", 0, false), answer("Relation", 5, true), answer("Relation", 5, true)],
          expectedScore: 0,
          expectedLabel: "工具型",
        },
        {
          label: "伙伴型",
          dimension: "Relation",
          answers: [answer("Relation", 5, false), answer("Relation", 5, false), answer("Relation", 0, true), answer("Relation", 0, true)],
          expectedScore: 20,
          expectedLabel: "伙伴型",
        },
        {
          label: "探索型",
          dimension: "Workflow",
          answers: [answer("Workflow", 0, false), answer("Workflow", 0, false), answer("Workflow", 5, true), answer("Workflow", 5, true)],
          expectedScore: 0,
          expectedLabel: "探索型",
        },
        {
          label: "框架型",
          dimension: "Workflow",
          answers: [answer("Workflow", 5, false), answer("Workflow", 5, false), answer("Workflow", 0, true), answer("Workflow", 0, true)],
          expectedScore: 20,
          expectedLabel: "框架型",
        },
        {
          label: "信任型",
          dimension: "Epistemic",
          answers: [answer("Epistemic", 0, false), answer("Epistemic", 0, false), answer("Epistemic", 5, true), answer("Epistemic", 5, true)],
          expectedScore: 0,
          expectedLabel: "信任型",
        },
        {
          label: "审计型",
          dimension: "Epistemic",
          answers: [answer("Epistemic", 5, false), answer("Epistemic", 5, false), answer("Epistemic", 0, true), answer("Epistemic", 0, true)],
          expectedScore: 20,
          expectedLabel: "审计型",
        },
        {
          label: "局部调整型",
          dimension: "RepairScope",
          answers: [answer("RepairScope", 0, false), answer("RepairScope", 0, false), answer("RepairScope", 5, true), answer("RepairScope", 5, true)],
          expectedScore: 0,
          expectedLabel: "局部调整型",
        },
        {
          label: "全局重评型",
          dimension: "RepairScope",
          answers: [answer("RepairScope", 5, false), answer("RepairScope", 5, false), answer("RepairScope", 0, true), answer("RepairScope", 0, true)],
          expectedScore: 20,
          expectedLabel: "全局重评型",
        },
      ];

      for (const item of cases) {
        const dimension = scoreQuestionnaireAnswers(item.answers).find((result) => result.dimension === item.dimension);
        assert(dimension?.score === item.expectedScore, `${item.label} 应为 ${item.expectedScore}/20，实际 ${dimension?.score}`);
        assert(dimension?.tendencyLabel === item.expectedLabel, `${item.label} 应判为 ${item.expectedLabel}，实际 ${dimension?.tendencyLabel}`);
      }
    }),
    test("AI-MBTI", "legacy 16 题 fallback reverse 标记匹配维度方向", () => {
      const expected: Array<[string, boolean]> = [
        ["一起讨论、打磨思路", false],
        ["照我说的做就行", true],
        ["主动帮我拆解、追问", false],
        ["很少关心「协作过程」", true],
        ["目标、步骤和约束写清楚", false],
        ["先扔一个大概想法给 AI", true],
        ["先定目录/接口/清单", false],
        ["快速试几种提法", true],
        ["再查证、对比其他来源", false],
        ["直接使用 AI 的答案", true],
        ["检查 AI 的推理链条", false],
        ["相信 AI 的表述", true],
        ["局部修改、迭代", true],
        ["清空上下文、重新描述问题", false],
        ["一块块改", true],
        ["整段删掉、换提问方式重来", false],
      ];

      for (const [keyword, reverse] of expected) {
        const question = FALLBACK_QUESTIONNAIRE.find((item) => item.question.includes(keyword));
        assert(question, `应找到 legacy fallback 题：${keyword}`);
        assert(question.reverse === reverse, `${keyword} reverse 应为 ${String(reverse)}，实际 ${String(question.reverse)}`);
      }
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
      assert(scored.find((item) => item.dimension === "Epistemic")?.confidence === "low", "2 道 5 分题离中点不够远，应为 low");
      assert(scored.find((item) => item.dimension === "RepairScope")?.confidence === "low", "1 题应为 low");
    }),
    test("AI-MBTI", "Phase 6 跳过题按中位数计分但不计入有效题数", () => {
      const scored = scoreQuestionnaireAnswers([
        answer("Relation", 5),
        answer("Relation", 5),
        skippedAnswer("Relation", 1),
        skippedAnswer("Relation", null),
      ]);
      const relation = scored.find((item) => item.dimension === "Relation");
      assert(relation?.answeredCount === 2, "跳过题不应计入有效题数");
      assert(relation?.skippedCount === 2, "跳过题数应保留");
      assert(relation?.confidence === "medium", "2 道高分且偏离中点应为 medium");
      assert(relation?.score === 15, `2 道 5 分 + 2 道跳过应计为 15/20，实际 ${relation?.score}`);
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
        perDimension: 2,
        reversePerDimension: 1,
        questionTypes: { universal: 4, semi_specific: 4, specific: 0 },
      });
      assertHybridBatchShape(second, "hybrid_batch2 fallback", {
        count: 8,
        perDimension: 2,
        reversePerDimension: 1,
        questionTypes: { universal: 0, semi_specific: 4, specific: 4 },
      });
      assert(validateQuestionnaireBatch(first, "hybrid_batch1"), "hybrid_batch1 fallback 应合法");
      assert(validateQuestionnaireBatch(second, "hybrid_batch2"), "hybrid_batch2 fallback 应合法");
      assert(validateQuestionnaireTotal(FALLBACK_QUESTIONNAIRE_TOTAL), "两部分 fallback 合并后应是合法 16 题");
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
    test("AI-MBTI", "Phase 6 第二轮模型题型标签归一化", () => {
      const modelLabeledBatch: QuestionnaireQuestion[] = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2.map((question) => ({
        ...question,
        questionType: "specific",
      }));
      const normalized = normalizeGeneratedQuestionBatch(modelLabeledBatch, "hybrid_batch2");

      assertHybridBatchShape(normalized, "hybrid_batch2 normalized", {
        count: 8,
        perDimension: 2,
        reversePerDimension: 1,
        questionTypes: { universal: 0, semi_specific: 4, specific: 4 },
      });
      assert(validateQuestionnaireBatch(normalized, "hybrid_batch2"), "batch2 归一化后应合法");
      assert(
        normalized.every((question, index) => question.question === modelLabeledBatch[index]?.question),
        "归一化不应改写题干"
      );
    }),
    test("AI-MBTI", "Phase 6 第一轮通用题槽位归一化", () => {
      const modelLabeledBatch: QuestionnaireQuestion[] = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1.map((question) => ({
        ...question,
        scenario: "模型给出的场景",
        questionType: "specific",
      }));
      const normalized = normalizeGeneratedQuestionBatch(modelLabeledBatch, "hybrid_batch1");

      assertHybridBatchShape(normalized, "hybrid_batch1 normalized", {
        count: 8,
        perDimension: 2,
        reversePerDimension: 1,
        questionTypes: { universal: 4, semi_specific: 4, specific: 0 },
      });
      assert(validateQuestionnaireBatch(normalized, "hybrid_batch1"), "batch1 归一化后应合法");
      assert(
        normalized.filter((question) => question.questionType === "universal").every((question) => question.scenario === "通用"),
        "第一轮通用题场景应强制为通用"
      );
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
    test("AI-MBTI", "Phase 6 问卷去重阈值保持保守", () => {
      const exact = findSimilarQuestionText(
        [{
          dimension: "Workflow",
          scenario: "写需求文档",
          question: "写需求文档时，我会先明确目标和边界，再让 AI 开始工作。",
          reverse: false,
        }],
        [{
          dimension: "Workflow",
          scenario: "写需求文档",
          question: "写需求文档时，我会先明确目标和边界，再让 AI 开始工作！",
          reverse: false,
        }],
        0.98
      );
      const nearButNotExact = findSimilarQuestionText(
        [{
          dimension: "Workflow",
          scenario: "写需求文档",
          question: "写需求文档时，我会先明确目标和边界，再让 AI 开始工作。",
          reverse: false,
        }],
        [{
          dimension: "Workflow",
          scenario: "写需求文档",
          question: "写需求文档时，我会先明确任务结构，再让 AI 帮我扩展内容。",
          reverse: false,
        }],
        0.98
      );
      assert(exact && exact.similarity >= 0.98, "标点不同但语义完全相同的题应被保守阈值捕获");
      assert(!nearButNotExact, "只是同场景同维度但不完全相同的题不应被保守阈值拦截");
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

      assert(firstPrompt.includes("第一轮问卷（8题）"), "第一轮 prompt 应使用自然批次名称");
      assert(firstPrompt.includes("总题数：8 题"), "第一轮 prompt 应保留题数");
      assert(firstPrompt.includes("通用题 4 道 + 半具体题 4 道"), "第一轮 prompt 应保留题型分布");
      assert(firstPrompt.includes("Relation / Workflow / Epistemic / RepairScope 各 2 题"), "第一部分 prompt 应保留每维题数");
      assert(firstPrompt.includes("每个维度 1 题 reverse=false，1 题 reverse=true"), "第一轮 prompt 应声明正反向合约");
      assert(firstPrompt.includes("反向题"), "第一轮 prompt 应给出反向题写法约束");
      assert(firstPrompt.includes("计分方式：用户选择 0-5 分，跳过按 2.5 分计算"), "第一轮 prompt 应保留计分合约");
      assert(secondPrompt.includes("第二轮问卷（8题）"), "第二轮 prompt 应使用自然批次名称");
      assert(secondPrompt.includes("半具体题 4 道 + 具体题 4 道"), "第二轮 prompt 应保留题型分布");
      assert(secondPrompt.includes("每个维度 1 题 reverse=false，1 题 reverse=true"), "第二轮 prompt 应声明正反向合约");
    }),
    test("AI-MBTI", "Phase 6 batch validator 强制 active 正反向结构", () => {
      const invalidFirst = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1.map((question, index) => (
        index === 1 ? { ...question, reverse: false } : question
      ));
      const invalidSecond = FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2.map((question, index) => (
        index === 1 ? { ...question, reverse: false } : question
      ));

      assert(validateQuestionnaireBatch(FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1, "hybrid_batch1"), "batch1 每维 1 正 1 反应合法");
      assert(!validateQuestionnaireBatch(invalidFirst, "hybrid_batch1"), "batch1 缺少反向题应非法");
      assert(validateQuestionnaireBatch(FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2, "hybrid_batch2"), "batch2 每维 1 正 1 反应合法");
      assert(!validateQuestionnaireBatch(invalidSecond, "hybrid_batch2"), "batch2 缺少反向题应非法");
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
{"directive":{"action":"probe_new","hint":"追问 AI 使用场景"},"targetContext":{"role":"学生","recentUse":"使用 AI 完成日常任务","goal":"提高效率，并获得更多 idea/思路/选择/灵感","tools":[]},"nextQuestions":[],"newEvidence":[{"quote":"学生","signal":"用户身份是学生","evidence_kind":"quote"}]}}`;
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
{"batchMode":"hybrid_batch2","targetContext":{"role":"学生","recentUse":"写代码","goal":"提高效率，并获得更多 idea/思路/选择/灵感","tools":[]},"userFacingMessage":"第二部分问卷已准备好。","nextQuestions":[{"dimension":"Relation","scenario":"写代码","question":"写代码时，我期待 AI 主动补充可能遗漏的问题。","questionType":"specific","reverse":false}],"newEvidence":[]}}`;
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
        ...repeatedAnswers("Relation", 4, 5),
        ...repeatedAnswers("Workflow", 4, 5),
        ...repeatedAnswers("Epistemic", 4, 5),
        ...repeatedAnswers("RepairScope", 4, 5),
      ]);
      assert(getPersonalityCode(scored) === "CFAG", `预期 CFAG，实际 ${getPersonalityCode(scored)}`);
    }),
    test("AI-MBTI", "低区分度中点答案不强行判为董事长", () => {
      const scored = scoreQuestionnaireAnswers(
        DIMENSIONS.flatMap((dimension) => [
          answer(dimension, 2),
          answer(dimension, 3),
          answer(dimension, 2),
          answer(dimension, 3),
        ])
      );
      const code = getPersonalityCode(scored);
      assert(code === "BALANCED", `中点答案应返回 BALANCED，实际 ${code}`);
      assert(getPersonalityProfile(code).name === "待观察型", "BALANCED 应返回中性画像");
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
        },
        scored
      );
      assert(artifacts.styleOverview.corePattern.length > 0, "styleOverview.corePattern 缺失");
      assert(artifacts.styleOverview.strengthArea.length > 0, "styleOverview.strengthArea 缺失");
      assert(artifacts.styleOverview.growthDirection.includes("AI"), "growthDirection 应包含可执行 AI 动作");
      assert(artifacts.collaborationManifesto.includes("1."), "工作流应使用固定步骤");
      assert(artifacts.collaborationManifesto.includes("先和 AI 对齐目标"), "工作流应包含目标对齐步骤");
      assert(!artifacts.collaborationManifesto.includes("我是一名"), "工作流不应写成身份宣言");
      assert(artifacts.collaborationSignature.headline === profile.signatureHeadline, "signature headline 应来自固定 profile");
      assert(artifacts.collaborationSignature.detail.includes("从本次回答看"), "signature detail 应限定证据来源");
    }),
    test("AI-MBTI", "报告展示上下文清洗占位目标和口语场景", () => {
      assert(normalizeReportTaskLabel("主要用ai写代码") === "AI 辅助写代码", "recentUse 应清洗成自然任务名");
      const nextAction = getPersonalityNextAction("CETL");
      assert(nextAction.includes("下次"), "16 型固定小动作应是下一次可执行动作");
      assert(!nextAction.includes("更有效地使用 AI"), "16 型固定小动作不应使用占位目标");

      const artifacts = completePortableArtifacts(
        {},
        getPersonalityProfile("CETL"),
        {
          role: "学生",
          recentUse: "主要用ai写代码",
          goal: "更有效地使用 AI",
        },
        scoreQuestionnaireAnswers([
          answer("Relation", 6),
          answer("Workflow", 6),
          answer("Epistemic", 6),
          answer("RepairScope", 6),
        ])
      );
      const styleText = `${artifacts.styleOverview.strengthArea}\n${artifacts.styleOverview.growthDirection}`;
      assert(styleText.includes("AI 辅助写代码"), "场景发现应使用清洗后的任务名");
      assert(!styleText.includes("主要用ai写代码"), "场景发现不应展示原始口语 recentUse");
      assert(!styleText.includes("围绕「更有效地使用 AI」"), "下一步小动作不应围绕占位目标");
      assert(!styleText.includes("使用 AI」使用 AI"), "下一步小动作不应出现 AI 套娃表达");
      assert(artifacts.collaborationManifesto.includes("先和 AI 对齐目标"), "工作流应使用固定 fallback");
      assert(!artifacts.collaborationManifesto.includes("主要用 AI 做主要用ai写代码"), "工作流不应拼接口语场景");
      assert(!artifacts.collaborationManifesto.includes("当前目标是更有效地使用 AI"), "工作流不应展示占位目标");
    }),
    test("AI-MBTI", "How 页兜底 prompt 模板使用自然协作节奏", () => {
      const template = getFallbackPromptTemplate({
        role: "学生",
        recentUse: "主要用ai写代码",
        goal: "更有效地使用 AI",
      });
      const fullText = `${template.title}\n${template.useCase}\n${template.prompt}`;
      assert(template.prompt.startsWith("我在做 AI 辅助写代码"), "兜底模板应使用清洗后的具体任务");
      assert(/你先|我挑|再展开/.test(template.prompt), "兜底模板应有自然的协作节奏");
      assert(!fullText.includes("主要用ai写代码"), "兜底模板不应展示原始口语 recentUse");
      assert(!fullText.includes("更有效地使用 AI"), "兜底模板不应展示占位目标");
      assert(!fullText.includes("[一句话目标]"), "兜底模板不应依赖占位符");
      assert(!fullText.includes("开始前请你先做三件事"), "兜底模板不应退回三件事清单");
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
      assert(stem.label === "任务场景", "场景题 label 应为任务场景");
      assert(stem.stem === "我会先让 AI 给出几种路径，再选择其中一种继续打磨。", `题面不应额外拼接场景：${stem.stem}`);
    }),
    test("AI-MBTI", "问卷题面直接使用自包含题干", () => {
      // 通用题：直接使用
      const universal = buildQuestionStem({
        dimension: "Relation",
        scenario: "通用",
        question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具。",
        reverse: false,
        questionType: "universal",
      });
      assert(universal.stem === "我倾向于把 AI 当成讨论伙伴，而不只是执行工具。", `通用题应直接使用：${universal.stem}`);
      assert(universal.label === "通用倾向", `通用题标签错误：${universal.label}`);

      // 半具体题：题干已包含场景，直接使用
      const semiSpecific = buildQuestionStem({
        dimension: "Workflow",
        scenario: "写代码",
        question: "写代码时，我会先明确需求，再开始编写。",
        reverse: false,
        questionType: "semi_specific",
      });
      assert(semiSpecific.stem === "写代码时，我会先明确需求，再开始编写。", `半具体题应直接使用：${semiSpecific.stem}`);
      assert(semiSpecific.label === "任务场景", `半具体题标签错误：${semiSpecific.label}`);

      // 具体题：题干已包含场景，直接使用
      const specific = buildQuestionStem({
        dimension: "Workflow",
        scenario: "写产品需求文档",
        question: "在写产品需求文档过程中，我习惯先列大纲，再让 AI 帮我细化。",
        reverse: false,
        questionType: "specific",
      });
      assert(specific.stem === "在写产品需求文档过程中，我习惯先列大纲，再让 AI 帮我细化。", `具体题应直接使用：${specific.stem}`);
      assert(specific.label === "真实场景", `具体题标签错误：${specific.label}`);
    }),
    test("AI-MBTI", "加载进度曲线匹配真实等待时长", () => {
      const q30 = getQuestionnaireLoadingProgress(30_000);
      const q60 = getQuestionnaireLoadingProgress(60_000);
      const q90 = getQuestionnaireLoadingProgress(90_000);
      assert(q30 >= 50 && q30 <= 65, `问卷 30s 应已过半，实际 ${q30}`);
      assert(q60 >= 88 && q60 <= 92, `问卷 60s 应接近 90%，实际 ${q60}`);
      assert(q90 <= 95, `问卷等待态不应超过 95%，实际 ${q90}`);

      const r40 = getReportLoadingProgress(40_000);
      const r60 = getReportLoadingProgress(60_000);
      const r90 = getReportLoadingProgress(90_000);
      assert(r40 >= 65 && r40 <= 78, `报告 40s 应进入中后段，实际 ${r40}`);
      assert(r60 >= 88 && r60 <= 93, `报告 60s 应接近完成但不到 95%，实际 ${r60}`);
      assert(r90 <= 95, `报告等待态不应超过 95%，实际 ${r90}`);
    }),
    test("AI-MBTI", "targetContext 兜底", () => {
      const inferred = inferTargetContextFromMessages([
        { role: "user", content: "医生，有用过 GPT 写科研相关报告，希望提高科研写作效率" },
      ]);
      const normalized = normalizeTargetContext(undefined, inferred);
      assert(normalized.role.includes("医生"), `role 推断异常：${normalized.role}`);
      assert(normalized.recentUse.includes("GPT"), `recentUse 推断异常：${normalized.recentUse}`);
    }),
    test("AI-MBTI", "analytics 访问 payload 清洗", () => {
      const sanitized = sanitizeVisitPayload({
        visitId: "visit-1",
        visitorId: "visitor-1",
        path: "/report?x=1",
        referrer: "https://example.com/path?a=1",
        occurredAt: "2026-05-13T10:00:00.000Z",
      });

      assert(sanitized.ok, sanitized.ok ? "OK" : sanitized.error);
      if (sanitized.ok) {
        assert(sanitized.visit.path === "/report", `path 应去除 query，实际 ${sanitized.visit.path}`);
        assert(sanitized.visit.referrerHost === "example.com", `referrer host 应解析，实际 ${sanitized.visit.referrerHost}`);
      }
    }),
    test("AI-MBTI", "analytics 测试结果保留问卷样本但不收流程事件", () => {
      const sanitized = sanitizeTestResultPayload({
        resultId: "result-1",
        visitorId: "visitor-1",
        sessionId: "session_1_abc",
        role: "产品经理",
        tools: ["ChatGPT", "Claude"],
        personalityCode: "CEAL",
        personalityName: "外交官",
        dimensions: [{ dimension: "Relation", score: 16, scorePercent: 80, tendencyLabel: "伙伴型" }],
        questionnaireSamples: [{
          batchKey: "batch1",
          index: 1,
          dimension: "Relation",
          question: "当 AI 主动补充思路时，你通常会继续让它展开吗？",
          scenario: "需求讨论",
          reverse: false,
          score: 4,
          skipped: false,
        }],
        feedbackText: "不应该被保留",
        completedAt: "2026-05-13T10:00:00.000Z",
      });

      assert(sanitized.ok, sanitized.ok ? "OK" : sanitized.error);
      if (sanitized.ok) {
        assert(sanitized.result.role === "产品经理", "测试结果应保留职业");
        assert(sanitized.result.personalityCode === "CEAL", "测试结果应保留人格 code");
        assert(sanitized.result.questionnaireSamples.length === 1, "测试结果应保留问卷样本");
        assert(sanitized.result.questionnaireSamples[0].score === 4, "问卷样本应保留选择分数");
        assert(Array.isArray(sanitized.result.fallbackBatches), "fallbackBatches 应规范成数组");
        assert(!("feedbackText" in sanitized.result), "测试结果不应保留反馈正文");
      }
    }),
    test("AI-MBTI", "analytics 测试结果保留合法 fallback 批次", () => {
      const sanitized = sanitizeTestResultPayload({
        resultId: "result-2",
        visitorId: "visitor-2",
        sessionId: "session_2_abc",
        role: "学生",
        tools: ["ChatGPT"],
        personalityCode: "IFAG",
        personalityName: "系统架构师",
        dimensions: [{ dimension: "Workflow", score: 12, scorePercent: 60 }],
        questionnaireSamples: [],
        fallbackBatches: ["batch1", "batch1", "batch2", "unknown"],
        completedAt: "2026-05-13T10:00:00.000Z",
      });

      assert(sanitized.ok, sanitized.ok ? "OK" : sanitized.error);
      if (sanitized.ok) {
        assert(sanitized.result.fallbackBatches?.join(",") === "batch1,batch2", "应去重并过滤非法 fallback 批次");
      }
    }),
    test("AI-MBTI", "报告工具箱缺失时服务端补齐可展示内容", () => {
      const toolbox = completeReportToolbox(undefined, {
        role: "产品经理",
        tools: ["Claude"],
        recentUse: "整理用户反馈",
        goal: "提高需求判断质量",
      });

      assert(toolbox.promptTemplates.length > 0, "缺失 toolbox 时应补齐 prompt 模板");
      assert(toolbox.checklists.length > 0, "缺失 toolbox 时应补齐 checklist");
      assert(toolbox.workflow.steps.length >= 5, "缺失 toolbox 时应补齐工作流步骤");
    }),
    test("AI-MBTI", "报告模型 partial draft 缺 summary 时仍可进入服务端补齐", () => {
      const partial = normalizeGeneratedReportDraft({
        selectedScenario: "解释复杂教学概念",
        styleProfile: {
          behaviors: [{ behavior: "你会先定教学目标框架，再让 AI 发散类比和案例。" }],
          strengths: ["目标导向明确，能让 AI 输出围绕核心教学意图展开。"],
          weaknesses: ["如果框架和发散边界没有说清，AI 可能既受限又缺少惊喜。"],
        },
      }, { allowMissingSummary: true });
      const strict = normalizeGeneratedReportDraft({
        selectedScenario: "解释复杂教学概念",
        styleProfile: {
          behaviors: [{ behavior: "你会先定教学目标框架，再让 AI 发散类比和案例。" }],
        },
      });

      assert(partial, "partial draft 应该被保留以便 route 使用服务端 fallback 补齐");
      assert(partial.summary === undefined, "partial draft 应显式保留 summary 缺失状态");
      assert(partial.selectedScenario === "解释复杂教学概念", "应保留模型已经生成的场景");
      assert(strict === null, "严格解析仍应拒绝缺 summary 的完整报告");
    }),
    test("AI-MBTI", "analytics summary 使用访问人数作为公开主数字", () => {
      const summary = buildPublicAnalyticsSummary({
        total_visitors: 1280,
        today_visitors: 47,
        total_visits: 2140,
        completed_tests_total: 320,
      }, "2026-05-13T10:00:00.000Z");
      assert(summary.totalVisitors === 1280, "公开 summary 应包含累计访问人数");
      assert(summary.todayVisitors === 47, "公开 summary 应包含今日访问人数");
      assert(summary.totalVisits === 2140, "公开 summary 应包含累计访问次数");
      assert(summary.completedTestsTotal === 320, "公开 summary 可包含累计完成测试数");
    }),
  ];
}

export function runSelfTests(): SelfTestResult[] {
  return runAiMbtiSelfTests();
}

export function summarizeSelfTests(results: SelfTestResult[]) {
  const passed = results.filter((result) => result.status === "pass").length;
  return {
    passed,
    failed: results.length - passed,
    total: results.length,
  };
}
