import { NextRequest, NextResponse } from "next/server";
import {
  RESEARCHER_FALLBACK_MODEL,
  RESEARCHER_MAX_TOKENS,
  RESEARCHER_MODEL,
  assertQwenApiConfig,
  createQwenMessageWithTools,
  getUpstreamErrorMessage,
} from "@/lib/qwen";
import { getFallbackQuestionnaireBatch } from "@/lib/fallbackQuestionnaire";
import { questionnaireReadyMessageForBatchMode } from "@/lib/questionnaireReadyMessage";
import {
  validateQuestionnaireBatch,
  validateQuestionnaireTotal,
} from "@/lib/questionnaireValidation";
import {
  applySessionStatePatch,
  getEffectiveTargetContext,
  isSessionState,
} from "@/lib/sessionState";
import {
  GENERATE_QUESTIONNAIRE_BATCH_TOOL,
  buildQuestionnaireBatchPrompt,
  buildResearcherSystemPrompt,
  getQuestionnaireBatchToolChoice,
  questionnaireBatchOutputFromToolUses,
} from "@/lib/researcher";
import type {
  AgentBOutput,
  Dimension,
  MidDialogueStatus,
  QuestionnaireBatchKey,
  QuestionnaireBatchMode,
  QuestionnaireQuestion,
  ScenarioGuidance,
  SessionState,
} from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const BATCH_MODES: QuestionnaireBatchMode[] = ["hybrid_batch1", "hybrid_batch2"];
const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];
const MID_DIALOGUE_STATUSES: MidDialogueStatus[] = [
  "confirmed",
  "refined",
  "abstract_scenarios",
  "needs_more_context",
  "exit_requested",
];
const BATCH_KEYS: QuestionnaireBatchKey[] = ["batch1", "batch2"];

const MODE_TO_BATCH_KEY: Record<QuestionnaireBatchMode, QuestionnaireBatchKey> = {
  hybrid_batch1: "batch1",
  hybrid_batch2: "batch2",
};

const MODE_TO_PHASE: Record<QuestionnaireBatchMode, SessionState["phase"]> = {
  hybrid_batch1: "questionnaire_batch1",
  hybrid_batch2: "questionnaire_batch2",
};

type GenerationSource = "model" | "fallback";

type BatchGenerationResult = {
  questions: QuestionnaireQuestion[];
  agentBOutput?: AgentBOutput;
  retryCount: number;
  validationIssue?: string;
  /** Actual upstream model ID when LLM generation succeeded（含主模型失败后备用模型生效） */
  modelUsed?: string;
  debug?: QuestionnaireGenerateDebug;
};

type QuestionnaireGenerateDebug = {
  enabled: true;
  attempts: QuestionnaireGenerateDebugAttempt[];
  routeValidationIssue?: string;
  upstreamError?: string;
};

type QuestionnaireGenerateDebugAttempt = {
  attempt: number;
  model: string;
  stopReason?: string;
  textBlocks: string[];
  toolUses: Array<{
    name: string;
    inputKeys: string[];
    inputPreview: unknown;
  }>;
  parsedQuestionCount: number;
  parsedQuestions: QuestionnaireQuestion[];
  validationIssue?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | {
        sessionState?: unknown;
        batchMode?: unknown;
        existingQuestions?: unknown;
        scenarioGuidance?: unknown;
        debug?: unknown;
      }
    | null;

  if (!body || !isSessionState(body.sessionState) || !isQuestionnaireBatchMode(body.batchMode)) {
    return NextResponse.json(
      { error: "bad_request", detail: "请求体需要包含 sessionState 与有效 batchMode。" },
      { status: 400 }
    );
  }

  const started = performance.now();
  const sessionState = body.sessionState;
  const batchMode = body.batchMode;
  const existingQuestions = parseQuestionnaireQuestions(body.existingQuestions);
  const scenarioGuidance = parseScenarioGuidance(body.scenarioGuidance) ?? sessionState.scenarioGuidance;
  const fallbackQuestions = getFallbackQuestionnaireBatch(batchMode, {
    targetContext: getEffectiveTargetContext(sessionState),
    scenarioGuidance,
  });

  const warnings: string[] = [];
  const debugEnabled = isQuestionnaireGenerateDebugEnabled(req, body.debug);
  let source: GenerationSource = "model";
  let result: BatchGenerationResult | null = null;
  let upstreamDebug: QuestionnaireGenerateDebug | undefined;

  const missing = assertQwenApiConfig();
  if (missing) {
    warnings.push(missing);
  } else {
    result = await generateWithOneRetry({
      sessionState,
      batchMode,
      existingQuestions,
      scenarioGuidance,
      debugEnabled,
    }).catch((error) => {
      const message = getUpstreamErrorMessage(error) ?? String(error);
      warnings.push(message);
      if (debugEnabled) {
        upstreamDebug = {
          enabled: true,
          attempts: [],
          upstreamError: message,
        };
      }
      return null;
    });
  }

  if (!result) {
    source = "fallback";
    result = {
      questions: fallbackQuestions,
      retryCount: 0,
      validationIssue: warnings[warnings.length - 1],
      debug: debugEnabled
        ? {
            enabled: true,
            attempts: upstreamDebug?.attempts ?? [],
            upstreamError: upstreamDebug?.upstreamError ?? warnings[warnings.length - 1],
          }
        : undefined,
    };
  }

  const questions = result.questions;
  const validationIssue = validateBatchForRoute(questions, batchMode, source === "model" ? existingQuestions : []);
  if (validationIssue) {
    source = "fallback";
    warnings.push(`模型输出未通过最终校验：${validationIssue}`);
    result = {
      questions: fallbackQuestions,
      retryCount: result.retryCount,
      validationIssue,
      debug: result.debug
        ? {
            ...result.debug,
            routeValidationIssue: validationIssue,
          }
        : undefined,
    };
  }

  const nextSessionState = buildNextSessionState({
    sessionState,
    batchMode,
    questions: result.questions,
    agentBOutput: result.agentBOutput,
    scenarioGuidance,
  });

  const responseModel =
    source === "model" ? (result.modelUsed ?? RESEARCHER_MODEL) : "deterministic";

  const responseBody = {
    questions: result.questions,
    sessionState: nextSessionState,
    message: questionnaireReadyMessageForBatchMode(batchMode),
    batchMode,
    source,
    model: responseModel,
    thinkDurationSec: (performance.now() - started) / 1000,
    retryCount: result.retryCount,
    validationIssue: result.validationIssue,
    warnings,
    ...(debugEnabled && result.debug ? { debug: result.debug } : {}),
  };

  if (debugEnabled) {
    console.info("[questionnaire/generate debug]", JSON.stringify({
      sessionId: sessionState.sessionId,
      batchMode,
      source,
      model: responseModel,
      retryCount: result.retryCount,
      validationIssue: result.validationIssue,
      attempts: result.debug?.attempts.map((attempt) => ({
        attempt: attempt.attempt,
        model: attempt.model,
        stopReason: attempt.stopReason,
        toolUses: attempt.toolUses.map((toolUse) => ({
          name: toolUse.name,
          inputKeys: toolUse.inputKeys,
        })),
        parsedQuestionCount: attempt.parsedQuestionCount,
        validationIssue: attempt.validationIssue,
      })),
      warnings,
    }, null, 2));
  }

  return NextResponse.json(responseBody);
}

async function generateWithOneRetry({
  sessionState,
  batchMode,
  existingQuestions,
  scenarioGuidance,
  debugEnabled,
}: {
  sessionState: SessionState;
  batchMode: QuestionnaireBatchMode;
  existingQuestions: QuestionnaireQuestion[];
  scenarioGuidance?: ScenarioGuidance;
  debugEnabled: boolean;
}): Promise<BatchGenerationResult | null> {
  let retryReason: string | undefined;
  let lastValidationIssue: string | undefined;
  const debugAttempts: QuestionnaireGenerateDebugAttempt[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { output, model, raw } = await callResearcherBatchTool({
      sessionState,
      batchMode,
      existingQuestions,
      scenarioGuidance,
      retryReason,
    });
    const questions = output?.nextQuestions ?? [];
    const validationIssue = validateBatchForRoute(questions, batchMode, existingQuestions);
    if (debugEnabled) {
      debugAttempts.push({
        attempt,
        model,
        stopReason: raw.stopReason,
        textBlocks: raw.textBlocks.map((text) => truncateString(text, 2000)),
        toolUses: raw.toolUses.map((toolUse) => ({
          name: toolUse.name,
          inputKeys: toolUse.input && typeof toolUse.input === "object"
            ? Object.keys(toolUse.input as Record<string, unknown>)
            : [],
          inputPreview: truncateUnknown(toolUse.input, 5000),
        })),
        parsedQuestionCount: questions.length,
        parsedQuestions: questions,
        validationIssue,
      });
    }
    if (!validationIssue) {
      return {
        questions,
        agentBOutput: output ?? undefined,
        retryCount: attempt,
        modelUsed: model,
        debug: debugEnabled
          ? {
              enabled: true,
              attempts: debugAttempts,
            }
          : undefined,
      };
    }
    lastValidationIssue = validationIssue;
    retryReason = validationIssue;
  }
  return {
    questions: [],
    retryCount: 1,
    validationIssue: lastValidationIssue,
    debug: debugEnabled
      ? {
          enabled: true,
          attempts: debugAttempts,
        }
      : undefined,
  };
}

async function callResearcherBatchTool({
  sessionState,
  batchMode,
  existingQuestions,
  scenarioGuidance,
  retryReason,
}: {
  sessionState: SessionState;
  batchMode: QuestionnaireBatchMode;
  existingQuestions: QuestionnaireQuestion[];
  scenarioGuidance?: ScenarioGuidance;
  retryReason?: string;
}): Promise<{ output: AgentBOutput | null; model: string; raw: Awaited<ReturnType<typeof createQwenMessageWithTools>> }> {
  const params = {
    system: buildResearcherSystemPrompt(sessionState),
    messages: [
      {
        role: "user" as const,
        content: buildQuestionnaireBatchPrompt({
          sessionState,
          batchMode,
          existingQuestions,
          scenarioGuidance,
          retryReason,
        }),
      },
    ],
    tools: [GENERATE_QUESTIONNAIRE_BATCH_TOOL],
    toolChoice: getQuestionnaireBatchToolChoice(),
    temperature: retryReason ? 0.2 : 0.35,
    maxTokens: Math.min(RESEARCHER_MAX_TOKENS, 4096),
  };

  try {
    const apiResult = await createQwenMessageWithTools({
      ...params,
      model: RESEARCHER_MODEL,
    });
    return {
      output: questionnaireBatchOutputFromToolUses(apiResult.toolUses, apiResult.textBlocks),
      model: RESEARCHER_MODEL,
      raw: apiResult,
    };
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    const apiResult = await createQwenMessageWithTools({
      ...params,
      model: RESEARCHER_FALLBACK_MODEL,
    });
    return {
      output: questionnaireBatchOutputFromToolUses(apiResult.toolUses, apiResult.textBlocks),
      model: RESEARCHER_FALLBACK_MODEL,
      raw: apiResult,
    };
  }
}

function isQuestionnaireGenerateDebugEnabled(req: NextRequest, requested: unknown): boolean {
  if (process.env.NODE_ENV === "production") return requested === "force";
  if (requested === false) return false;
  if (requested === true || requested === "1" || requested === "true") return true;
  return req.nextUrl.searchParams.get("debug") === "1" || process.env.QUESTIONNAIRE_GENERATE_DEBUG === "1";
}

function truncateString(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…[truncated]` : value;
}

function truncateUnknown(value: unknown, maxLength: number): unknown {
  try {
    const text = JSON.stringify(value);
    if (!text || text.length <= maxLength) return value;
    return `${text.slice(0, maxLength)}…[truncated]`;
  } catch {
    return "[unserializable]";
  }
}

function validateBatchForRoute(
  questions: QuestionnaireQuestion[],
  batchMode: QuestionnaireBatchMode,
  existingQuestions: QuestionnaireQuestion[]
): string | undefined {
  if (!validateQuestionnaireBatch(questions, batchMode)) {
    const expected = batchMode === "hybrid_batch1"
      ? "8 题、四维各 2 题、每维 2 正 0 反、4 道习惯题 + 4 道场景题"
      : "16 题、四维各 4 题、每维 2 正 2 反、8 道习惯题 + 8 道场景题";
    return `${batchMode} 必须是 ${expected}，并满足该部分的场景和正反向规则。实际输出：${describeQuestionnaireBatchShape(questions)}。`;
  }
  if (batchMode === "hybrid_batch2" && existingQuestions.length >= 8) {
    const total = [...existingQuestions, ...questions];
    if (!validateQuestionnaireTotal(total)) {
      return "两部分合计必须是 24 题；每维 6 题、4 正向 + 2 反向，并且总计 12 道习惯题 + 12 道场景题。";
    }
  }
  return undefined;
}

function describeQuestionnaireBatchShape(questions: QuestionnaireQuestion[]): string {
  if (!Array.isArray(questions)) return "不是数组";
  const habitCount = questions.filter((question) => question.scenario.trim() === "习惯").length;
  const dimensionSummary = DIMENSIONS.map((dimension) => {
    const items = questions.filter((question) => question.dimension === dimension);
    const reverseCount = items.filter((question) => question.reverse).length;
    return `${dimension} ${items.length}题/${items.length - reverseCount}正${reverseCount}反`;
  }).join("；");
  const scenarios = questions
    .map((question) => question.scenario.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join("、");
  return `${questions.length}题，${habitCount}道习惯题，${dimensionSummary}，场景：${scenarios || "无"}`;
}

function buildNextSessionState({
  sessionState,
  batchMode,
  questions,
  agentBOutput,
  scenarioGuidance,
}: {
  sessionState: SessionState;
  batchMode: QuestionnaireBatchMode;
  questions: QuestionnaireQuestion[];
  agentBOutput?: AgentBOutput;
  scenarioGuidance?: ScenarioGuidance;
}): SessionState {
  const batchKey = MODE_TO_BATCH_KEY[batchMode];
  const questionnaireBatches = {
    ...(sessionState.questionnaireBatches ?? {}),
    [batchKey]: questions,
  };
  const flatQuestions = BATCH_KEYS.flatMap((key) => questionnaireBatches[key] ?? []);

  return applySessionStatePatch(
    sessionState,
    {
      questionnaireBatches: { [batchKey]: questions },
      questionnaire: flatQuestions,
      refinedTargetContext: agentBOutput?.targetContext,
      scenarioGuidance: agentBOutput?.scenarioGuidance ?? scenarioGuidance,
    },
    {
      turn: sessionState.turn,
      phase: MODE_TO_PHASE[batchMode],
    }
  );
}

function isQuestionnaireBatchMode(value: unknown): value is QuestionnaireBatchMode {
  return typeof value === "string" && BATCH_MODES.includes(value as QuestionnaireBatchMode);
}

function parseQuestionnaireQuestions(value: unknown): QuestionnaireQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      !DIMENSIONS.includes(record.dimension as Dimension) ||
      typeof record.scenario !== "string" ||
      typeof record.question !== "string" ||
      typeof record.reverse !== "boolean"
    ) {
      return [];
    }
    return [{
      dimension: record.dimension as Dimension,
      scenario: record.scenario,
      question: record.question,
      reverse: record.reverse,
    }];
  });
}

function parseScenarioGuidance(value: unknown): ScenarioGuidance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (
    !MID_DIALOGUE_STATUSES.includes(record.status as MidDialogueStatus) ||
    (record.granularity !== "specific" &&
      record.granularity !== "balanced" &&
      record.granularity !== "abstract") ||
    typeof record.scenarioSummary !== "string"
  ) {
    return undefined;
  }
  return {
    status: record.status as MidDialogueStatus,
    scenarioSummary: record.scenarioSummary.trim(),
    granularity: record.granularity,
    avoidTopics: parseStringList(record.avoidTopics),
    includeTopics: parseStringList(record.includeTopics),
    userCorrectionQuote:
      typeof record.userCorrectionQuote === "string" && record.userCorrectionQuote.trim()
        ? record.userCorrectionQuote.trim().slice(0, 120)
        : undefined,
  };
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    items.push(clean.slice(0, 40));
  }
  return items.slice(0, 8);
}
