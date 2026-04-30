import { NextRequest, NextResponse } from "next/server";
import {
  RESEARCHER_FALLBACK_MODEL,
  RESEARCHER_MAX_TOKENS,
  RESEARCHER_MODEL,
  assertClaudeApiKey,
  createClaudeMessageWithTools,
  getUpstreamErrorMessage,
} from "@/lib/claude";
import { getFallbackQuestionnaireBatch } from "@/lib/fallbackQuestionnaire";
import {
  findSimilarQuestionText,
  validateQuestionnaireBatch,
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

const BATCH_MODES: QuestionnaireBatchMode[] = ["habit_batch", "scenario_batch", "mixed_batch"];
const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];
const MID_DIALOGUE_STATUSES: MidDialogueStatus[] = [
  "confirmed",
  "refined",
  "abstract_scenarios",
  "needs_more_context",
  "exit_requested",
];
const BATCH_KEYS: QuestionnaireBatchKey[] = ["batch1", "batch2", "batch3"];
const SIMILARITY_THRESHOLD = 0.72;

const MODE_TO_BATCH_KEY: Record<QuestionnaireBatchMode, QuestionnaireBatchKey> = {
  habit_batch: "batch1",
  scenario_batch: "batch2",
  mixed_batch: "batch3",
};

const MODE_TO_PHASE: Record<QuestionnaireBatchMode, SessionState["phase"]> = {
  habit_batch: "questionnaire_batch1",
  scenario_batch: "questionnaire_batch2",
  mixed_batch: "questionnaire_batch3",
};

type GenerationSource = "model" | "fallback";

type BatchGenerationResult = {
  questions: QuestionnaireQuestion[];
  agentBOutput?: AgentBOutput;
  retryCount: number;
  validationIssue?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | {
        sessionState?: unknown;
        batchMode?: unknown;
        existingQuestions?: unknown;
        scenarioGuidance?: unknown;
      }
    | null;

  if (!body || !isSessionState(body.sessionState) || !isQuestionnaireBatchMode(body.batchMode)) {
    return NextResponse.json(
      { error: "bad_request", detail: "请求体需要包含 sessionState 与有效 batchMode。" },
      { status: 400 }
    );
  }

  const sessionState = body.sessionState;
  const batchMode = body.batchMode;
  const existingQuestions = parseQuestionnaireQuestions(body.existingQuestions);
  const scenarioGuidance = parseScenarioGuidance(body.scenarioGuidance) ?? sessionState.scenarioGuidance;
  const fallbackQuestions = getFallbackQuestionnaireBatch(batchMode, {
    targetContext: getEffectiveTargetContext(sessionState),
    scenarioGuidance,
  });

  const warnings: string[] = [];
  let source: GenerationSource = "model";
  let result: BatchGenerationResult | null = null;

  const missing = assertClaudeApiKey();
  if (missing) {
    warnings.push(missing);
  } else {
    result = await generateWithOneRetry({
      sessionState,
      batchMode,
      existingQuestions,
      scenarioGuidance,
    }).catch((error) => {
      warnings.push(getUpstreamErrorMessage(error) ?? String(error));
      return null;
    });
  }

  if (!result) {
    source = "fallback";
    result = {
      questions: fallbackQuestions,
      retryCount: 0,
      validationIssue: warnings[warnings.length - 1],
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
    };
  }

  const nextSessionState = buildNextSessionState({
    sessionState,
    batchMode,
    questions: result.questions,
    agentBOutput: result.agentBOutput,
    scenarioGuidance,
  });

  return NextResponse.json({
    questions: result.questions,
    sessionState: nextSessionState,
    message: buildBatchReadyMessage(batchMode, result.agentBOutput, source),
    batchMode,
    source,
    retryCount: result.retryCount,
    validationIssue: result.validationIssue,
    warnings,
  });
}

function buildBatchReadyMessage(
  batchMode: QuestionnaireBatchMode,
  agentBOutput: AgentBOutput | undefined,
  source: GenerationSource
): string | undefined {
  const generated = agentBOutput?.userFacingMessage?.trim();
  if (generated) return generated.slice(0, 140);

  const label =
    batchMode === "habit_batch"
      ? "第一批习惯题"
      : batchMode === "scenario_batch"
        ? "第二批场景题"
        : "最后一批混合题";
  if (source === "fallback") {
    return `${label}已经准备好了。我会先按当前信息出题，作答时遇到不贴近的题可以直接选「不了解 / 没想好」。`;
  }
  return undefined;
}

async function generateWithOneRetry({
  sessionState,
  batchMode,
  existingQuestions,
  scenarioGuidance,
}: {
  sessionState: SessionState;
  batchMode: QuestionnaireBatchMode;
  existingQuestions: QuestionnaireQuestion[];
  scenarioGuidance?: ScenarioGuidance;
}): Promise<BatchGenerationResult | null> {
  let retryReason: string | undefined;
  let lastValidationIssue: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await callResearcherBatchTool({
      sessionState,
      batchMode,
      existingQuestions,
      scenarioGuidance,
      retryReason,
    });
    const questions = output?.nextQuestions ?? [];
    const validationIssue = validateBatchForRoute(questions, batchMode, existingQuestions);
    if (!validationIssue) {
      return {
        questions,
        agentBOutput: output ?? undefined,
        retryCount: attempt,
      };
    }
    lastValidationIssue = validationIssue;
    retryReason = validationIssue;
  }
  return {
    questions: [],
    retryCount: 1,
    validationIssue: lastValidationIssue,
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
}): Promise<AgentBOutput | null> {
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
    const result = await createClaudeMessageWithTools({
      ...params,
      model: RESEARCHER_MODEL,
    });
    return questionnaireBatchOutputFromToolUses(result.toolUses);
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    const result = await createClaudeMessageWithTools({
      ...params,
      model: RESEARCHER_FALLBACK_MODEL,
    });
    return questionnaireBatchOutputFromToolUses(result.toolUses);
  }
}

function validateBatchForRoute(
  questions: QuestionnaireQuestion[],
  batchMode: QuestionnaireBatchMode,
  existingQuestions: QuestionnaireQuestion[]
): string | undefined {
  if (!validateQuestionnaireBatch(questions, batchMode)) {
    return `${batchMode} 必须是 8 题、四维各 2 题、每维正反各 1，并满足该批次的场景规则。`;
  }
  const similar = findSimilarQuestionText(questions, existingQuestions, SIMILARITY_THRESHOLD);
  if (similar) {
    return `题干过于相似（${Math.round(similar.similarity * 100)}%）：「${similar.question}」≈「${similar.existingQuestion}」`;
  }
  return undefined;
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
