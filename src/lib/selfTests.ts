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
import { completePortableArtifacts, normalizeSignatureDetailText } from "@/lib/reportPortableArtifacts";
import {
  normalizeMidDialogueTransitionRepairText,
  normalizeMidDialogueVisibleText,
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
import type { Dimension, HQDimension, Message, QuestionnaireAnswer, QuestionnaireQuestion, SessionState } from "@/lib/types";

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
    test("AI-MBTI", "Phase 6 兜底批次结构合法", () => {
      assert(validateQuestionnaireBatch(FALLBACK_QUESTIONNAIRE_BATCHES.habit_batch, "habit_batch"), "habit_batch fallback 应合法");
      assert(validateQuestionnaireBatch(FALLBACK_QUESTIONNAIRE_BATCHES.scenario_batch, "scenario_batch"), "scenario_batch fallback 应合法");
      assert(validateQuestionnaireBatch(FALLBACK_QUESTIONNAIRE_BATCHES.mixed_batch, "mixed_batch"), "mixed_batch fallback 应合法");
      assert(validateQuestionnaireTotal(FALLBACK_QUESTIONNAIRE_TOTAL), "三批 fallback 合并后应是合法 24 题");
    }),
    test("AI-MBTI", "Phase 6 场景批次拒绝泛场景", () => {
      const genericScenarioBatch: QuestionnaireQuestion[] = FALLBACK_QUESTIONNAIRE_BATCHES.scenario_batch.map((question) => ({
        ...question,
        scenario: "日常使用 AI",
      }));
      assert(!isSpecificScenario("日常使用 AI"), "泛场景不应被视为具体场景");
      assert(!validateQuestionnaireBatch(genericScenarioBatch, "scenario_batch"), "scenario_batch 不应接受泛场景");
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
        normalizeMidDialogueTransitionRepairText("好，我会按你刚才说的写代码场景生成下一批题目。").startsWith("好，我会"),
        "正常生成过渡句应保留"
      );
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
