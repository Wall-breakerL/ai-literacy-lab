import { DEFAULT_TARGET_CONTEXT } from "@/lib/targetContext";
import type {
  AgentBOutput,
  LegacyQuestionnaireBatchKey,
  Message,
  QuestionnaireAnswer,
  QuestionnaireBatchKey,
  QuestionnaireBatchMode,
  QuestionnaireQuestion,
  SessionEvidence,
  SessionPhase,
  SessionState,
  SessionStatePatch,
  TargetContext,
} from "@/lib/types";

const MAX_EVIDENCE = 12;
const MAX_OPEN_PROBES = 8;
/** 报告与旧会话展开顺序：含 legacy batch3 */
const LEGACY_BATCH_ORDER: LegacyQuestionnaireBatchKey[] = ["batch1", "batch2", "batch3"];
const PHASES = new Set<SessionPhase>([
  "interview",
  "questionnaire_batch1",
  "mid_dialog1",
  "questionnaire_batch2",
  "mid_dialog2",
  "questionnaire_batch3",
  "questionnaire",
  "recovery_interview",
  "recovery_questionnaire",
  "report",
]);

export function createInitialSessionState(sessionId: string): SessionState {
  return {
    sessionId,
    turn: 0,
    phase: "interview",
    background: {
      role: DEFAULT_TARGET_CONTEXT.role,
      tools: [],
      recentUse: DEFAULT_TARGET_CONTEXT.recentUse,
      goal: DEFAULT_TARGET_CONTEXT.goal,
      summary: "",
    },
    evidence: [],
    openProbes: [],
  };
}

export function isSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SessionState>;
  return (
    typeof state.sessionId === "string" &&
    typeof state.turn === "number" &&
    typeof state.phase === "string" &&
    PHASES.has(state.phase as SessionPhase) &&
    Boolean(state.background) &&
    typeof state.background === "object" &&
    Array.isArray(state.evidence) &&
    Array.isArray(state.openProbes)
  );
}

export function applySessionStatePatch(
  state: SessionState,
  patch: SessionStatePatch,
  options?: { turn?: number; phase?: SessionPhase }
): SessionState {
  const turn = options?.turn ?? state.turn + 1;
  const phase = options?.phase ?? patch.phase ?? state.phase;
  const backgroundPatch = patch.background ?? {};
  const tools = mergeStrings(toStringList(state.background.tools), backgroundPatch.tools);
  const evidence = mergeEvidence(Array.isArray(state.evidence) ? state.evidence : [], patch.newEvidence ?? []);

  return {
    ...state,
    turn,
    phase,
    background: {
      ...state.background,
      ...compactBackground(backgroundPatch),
      tools,
    },
    evidence,
    openProbes: mergeStrings([], patch.openProbes ?? toStringList(state.openProbes)).slice(0, MAX_OPEN_PROBES),
    questionnaire: patch.questionnaire ?? state.questionnaire,
    answers: patch.answers ?? state.answers,
    questionnaireBatches: mergeBatchRecord(state.questionnaireBatches, patch.questionnaireBatches),
    batchAnswers: mergeBatchRecord(state.batchAnswers, patch.batchAnswers),
    midDialogues: patch.midDialogues
      ? { ...(state.midDialogues ?? {}), ...patch.midDialogues }
      : state.midDialogues,
    refinedTargetContext: patch.refinedTargetContext ?? state.refinedTargetContext,
    scenarioGuidance: patch.scenarioGuidance ?? state.scenarioGuidance,
  };
}

export function buildSessionStatePatchFromAgentBOutput(
  agentBOutput: AgentBOutput,
  turn: number
): SessionStatePatch {
  const target = agentBOutput.targetContext;
  return {
    background: target
      ? {
          role: target.role,
          tools: target.tools,
          recentUse: target.recentUse,
          goal: target.goal,
          summary: agentBOutput.analysis.background_summary,
        }
      : {
          summary: agentBOutput.analysis.background_summary,
        },
    newEvidence: evidenceFromAgentBOutput(agentBOutput, turn),
    openProbes: agentBOutput.directive.hint ? [agentBOutput.directive.hint] : undefined,
    questionnaire: agentBOutput.nextQuestions,
    refinedTargetContext: agentBOutput.targetContext,
    scenarioGuidance: agentBOutput.scenarioGuidance,
    phase: agentBOutput.directive.action === "start_questionnaire" ? "questionnaire" : "interview",
  };
}

export function summarizeSessionStateForPrompt(state: SessionState): string {
  const evidenceText = state.evidence
    .slice(-6)
    .map((item) => `- ${item.dimension ?? "背景"} / ${item.signal} / ${item.evidenceKind}：${item.quote}`)
    .join("\n") || "（暂无）";
  const tools = toStringList(state.background.tools);
  const openProbes = toStringList(state.openProbes);
  const probes = openProbes.length > 0 ? openProbes.join("；") : "（暂无）";
  const target = getEffectiveTargetContext(state);
  const guidance = state.scenarioGuidance
    ? `状态：${state.scenarioGuidance.status}；粒度：${state.scenarioGuidance.granularity}；场景：${state.scenarioGuidance.scenarioSummary || "（暂无）"}；包含：${state.scenarioGuidance.includeTopics.join("、") || "（暂无）"}；避免：${state.scenarioGuidance.avoidTopics.join("、") || "（暂无）"}${state.scenarioGuidance.userCorrectionQuote ? `；用户修正：${state.scenarioGuidance.userCorrectionQuote}` : ""}`
    : "（暂无）";
  return `【SessionState】
身份：${state.background.role}
工具：${tools.join("、") || "未明确"}
近期使用：${state.background.recentUse}
目标：${state.background.goal}
摘要：${state.background.summary || "（暂无）"}
当前有效目标上下文：${target.role} / ${target.recentUse} / ${target.goal}
问卷批次：${formatBatchSummary(state)}
场景调整：${guidance}
证据：
${evidenceText}
待覆盖话题：${probes}`;
}

export function getEffectiveTargetContext(state: SessionState): TargetContext {
  return state.refinedTargetContext ?? {
    role: state.background.role,
    tools: state.background.tools,
    recentUse: state.background.recentUse,
    goal: state.background.goal,
  };
}

export function flattenQuestionnaireBatches(
  batches: SessionState["questionnaireBatches"] | undefined
): QuestionnaireQuestion[] {
  return LEGACY_BATCH_ORDER.flatMap((key) => batches?.[key] ?? []);
}

export function flattenBatchAnswers(
  batchAnswers: SessionState["batchAnswers"] | undefined
): QuestionnaireAnswer[] {
  return LEGACY_BATCH_ORDER.flatMap((key) => batchAnswers?.[key] ?? []);
}

/** 当前主动流程问卷阶段 → 批次键（不含旧版 questionnaire_batch3；旧数据靠 flatten 展开） */
export function getBatchKeyForPhase(phase: SessionPhase): QuestionnaireBatchKey | undefined {
  if (phase === "questionnaire_batch1") return "batch1";
  if (phase === "questionnaire_batch2") return "batch2";
  return undefined;
}

export function getBatchModeForKey(key: QuestionnaireBatchKey): QuestionnaireBatchMode {
  return key === "batch1" ? "hybrid_batch1" : "hybrid_batch2";
}

export function getNextBatchKey(key: QuestionnaireBatchKey): QuestionnaireBatchKey | undefined {
  if (key === "batch1") return "batch2";
  return undefined;
}

export function getBatchSkipRate(answers: QuestionnaireAnswer[] | undefined): number {
  if (!answers?.length) return 0;
  const skipped = answers.filter((answer) => answer.skipped || answer.score == null).length;
  return skipped / answers.length;
}

export function pruneOldTranscript(messages: Message[], keepLastN = 2): Message[] {
  if (messages.length <= keepLastN * 2) return messages;
  return [
    { role: "assistant", content: "（更早的对话已总结到 sessionState 中。）" },
    ...messages.slice(-keepLastN * 2),
  ];
}

function compactBackground(background: Partial<SessionState["background"]>): Partial<SessionState["background"]> {
  return Object.fromEntries(
    Object.entries(background).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && String(value).trim() !== "";
    })
  ) as Partial<SessionState["background"]>;
}

function mergeStrings(current: string[] | undefined, incoming?: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const item of [...toStringList(current), ...toStringList(incoming)]) {
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    merged.push(clean);
  }
  return merged;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mergeBatchRecord<T>(
  current: Partial<Record<LegacyQuestionnaireBatchKey, T[]>> | undefined,
  incoming: Partial<Record<LegacyQuestionnaireBatchKey, T[]>> | undefined
): Partial<Record<LegacyQuestionnaireBatchKey, T[]>> | undefined {
  if (!incoming) return current;
  return { ...(current ?? {}), ...incoming };
}

function formatBatchSummary(state: SessionState): string {
  const questionParts = LEGACY_BATCH_ORDER.map((key) => {
    const questions = state.questionnaireBatches?.[key]?.length ?? 0;
    const answers = state.batchAnswers?.[key]?.length ?? 0;
    return `${key}: ${questions}题/${answers}答`;
  });
  const flatAnswers = state.answers?.length ?? 0;
  return `${questionParts.join("；")}；扁平答案：${flatAnswers}`;
}

function mergeEvidence(current: SessionEvidence[], incoming: SessionEvidence[]): SessionEvidence[] {
  const seen = new Set<string>();
  const merged: SessionEvidence[] = [];
  for (const item of [...current, ...incoming]) {
    const quote = item.quote.trim();
    if (!quote) continue;
    const key = `${item.evidenceKind}|${item.dimension ?? ""}|${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...item, quote });
  }
  return merged.slice(-MAX_EVIDENCE);
}

function evidenceFromAgentBOutput(agentBOutput: AgentBOutput, turn: number): SessionEvidence[] {
  if (agentBOutput.newEvidence?.length) {
    return agentBOutput.newEvidence.map((item) => ({
      ...item,
      turn,
      quote: item.quote.trim().slice(0, 120),
      evidenceKind: item.evidenceKind ?? "quote",
    }));
  }
  const summary = agentBOutput.analysis.background_summary?.trim();
  if (!summary) return [];
  return [{ turn, quote: summary.slice(0, 120), signal: "weak", evidenceKind: "summary" }];
}
