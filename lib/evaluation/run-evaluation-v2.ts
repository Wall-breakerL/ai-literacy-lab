import type { ChatMessage } from "../types";
import { extractEventsV2 } from "../assessment-v2/extract-events-v2";
import type { EvalEventRecordV2 } from "../assessment-v2/extract-events-v2";
import { resolveBlueprintById } from "../scenario-v2/resolver";
import type { ScenarioBlueprint } from "../scenario-v2/types";
import { isTwoPhaseBlueprint } from "../scenario-v2/types";
import { callJudgeApiV2, judgePromptVersionV2 } from "../llm/judge-v2";
import { runRuleJudgeV2 } from "../judge-rule-v2";
import { applyRuleCorrectionsV2, computeWeightedScoreV2 } from "../rule-corrector-v2";
import type { JudgeOutputV2, PhaseScore, PhaseScores, V2DimResult } from "../assessment-v2/types";
import type { V2DimensionKey } from "../assessment-v2/weights";
import { V2_DIMENSION_KEYS, V2_DIMENSION_MAX } from "../assessment-v2/weights";
import { VERSION } from "../constants";
import { RUBRIC_VERSION_V2, EVENT_SCHEMA_VERSION_V2 } from "../assessment-v2/weights";

const DEFAULT_PHASE_WEIGHTS = { helper: 0.55, talk: 0.45 };

export type EvaluationV2Input = {
  sessionId: string;
  scenarioId: string;
  messages: ChatMessage[];
  identityId?: string;
  identityCompiledPrompt?: string | null;
  identityVersion?: string;
  talkPrompt?: string;
};

export type EvaluationResultV2Payload = JudgeOutputV2 & {
  weightedScore: number;
  rubricVersion: string;
  scenarioVersion: string;
  blueprintVersion: string;
  eventSchemaVersion: string;
  memorySchemaVersion: string;
  judgePromptVersion: string;
  judgeModel: string;
  identityVersion?: string;
  scoredAt: string;
  rawJudgeJson?: unknown;
  events?: { event: string; turnIndex?: number; phase?: string }[];
  /** Present only for two-phase blueprints. */
  phaseScores?: PhaseScores;
  talkPrompt?: string;
  phaseSwitchTurn?: number;
};

/**
 * Detect where helper→talk phase switch happened by looking for the talk opening message.
 * Returns the user-turn index at which talk phase began, or undefined if not found.
 */
function detectPhaseSwitchTurn(messages: ChatMessage[], blueprint: ScenarioBlueprint | null): number | undefined {
  if (!blueprint || !isTwoPhaseBlueprint(blueprint)) return undefined;
  const talkOpening = blueprint.phases!.talk.openingMessage;
  let userTurnIdx = 0;
  for (const m of messages) {
    if (m.role === "assistant" && m.content === talkOpening && userTurnIdx > 0) {
      return userTurnIdx;
    }
    if (m.role === "user") userTurnIdx++;
  }
  return undefined;
}

/**
 * Build a PhaseScore from a subset of events.
 */
function buildPhaseScore(
  phaseId: "helper" | "talk",
  events: EvalEventRecordV2[],
  fullDimensions: JudgeOutputV2["dimensions"]
): PhaseScore {
  const phaseEvents = events.filter((e) => e.phase === phaseId);
  const eventCounts: Record<string, number> = {};
  for (const e of phaseEvents) {
    eventCounts[e.event] = (eventCounts[e.event] ?? 0) + 1;
  }

  // For phase-level dimension scores, we take the full-session scores as the base
  // and adjust coverage based on phase events. This is a lightweight heuristic —
  // a future version could run separate judge calls per phase.
  const dimensions = {} as Record<V2DimensionKey, V2DimResult>;
  for (const k of V2_DIMENSION_KEYS) {
    const fullDim = fullDimensions[k];
    const phaseEvidence = phaseEvents
      .filter((e) => fullDim.evidence.some((ev) => ev.includes(e.event) || e.event.includes(ev)))
      .map((e) => e.event);
    dimensions[k] = {
      score: fullDim.score,
      max: fullDim.max,
      evidence: phaseEvidence.length ? phaseEvidence : fullDim.evidence,
      reason: fullDim.reason,
    };
  }

  const score = computeWeightedScoreV2(dimensions);

  return { phase: phaseId, score, dimensions, eventCounts };
}

export async function runEvaluationV2(input: EvaluationV2Input): Promise<EvaluationResultV2Payload> {
  const { sessionId, scenarioId, messages, identityId, identityCompiledPrompt, identityVersion, talkPrompt } = input;
  const blueprint = await resolveBlueprintById(scenarioId);
  const twoPhase = blueprint ? isTwoPhaseBlueprint(blueprint) : false;
  const phaseSwitchTurn = twoPhase ? detectPhaseSwitchTurn(messages, blueprint) : undefined;

  const events = extractEventsV2(messages, phaseSwitchTurn);

  const hasKey = Boolean(process.env.OPENAI_JUDGE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
  let judgeModel = hasKey
    ? (process.env.OPENAI_JUDGE_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "llm")
    : "rule-based";

  let rich = await callJudgeApiV2(
    sessionId,
    scenarioId,
    blueprint,
    identityCompiledPrompt ?? null,
    messages,
    events,
    identityId,
    phaseSwitchTurn
  );
  let rawJudgeJson: unknown = rich;

  if (!rich) {
    rich = runRuleJudgeV2(scenarioId, sessionId, events, identityId);
    judgeModel = "rule-based";
    rawJudgeJson = rich;
  }

  const corrected = applyRuleCorrectionsV2(rich, events);
  const weightedScore = computeWeightedScoreV2(corrected.dimensions);

  // Phase-level scoring for two-phase blueprints
  let phaseScores: PhaseScores | undefined;
  if (twoPhase && phaseSwitchTurn !== undefined) {
    const helperPhase = buildPhaseScore("helper", events, corrected.dimensions);
    const talkPhase = buildPhaseScore("talk", events, corrected.dimensions);
    phaseScores = {
      helper: helperPhase,
      talk: talkPhase,
      weights: DEFAULT_PHASE_WEIGHTS,
    };
  }

  return {
    ...corrected,
    identityId,
    weightedScore,
    rubricVersion: RUBRIC_VERSION_V2,
    scenarioVersion: VERSION.scenarioVersion,
    blueprintVersion: blueprint?.version ?? "unknown",
    eventSchemaVersion: EVENT_SCHEMA_VERSION_V2,
    memorySchemaVersion: VERSION.memorySchemaVersion,
    judgePromptVersion: judgePromptVersionV2(),
    judgeModel,
    identityVersion,
    scoredAt: new Date().toISOString(),
    events,
    phaseScores,
    talkPrompt,
    phaseSwitchTurn,
  };
}
