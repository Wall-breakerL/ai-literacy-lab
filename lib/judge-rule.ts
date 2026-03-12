import type { JudgeOutput, ChatMessage, EvalEventRecord } from "./types";
import { RUBRIC_WEIGHTS } from "./constants";
import { DIMENSION_EVENTS } from "./rule-corrector";

/** 规则 Judge 内部 0–5 映射到百分制 0–100 */
function to100(level05: number): number {
  return Math.round(Math.min(5, Math.max(0, level05)) * 20);
}

/**
 * Rule-based judge: map event counts to 0-5 per dimension, then 0-100 百分制 and weighted score.
 * Used when no LLM API key; evaluates USER behavior only.
 */
export function runRuleJudge(
  scenarioId: string,
  sessionId: string,
  events: EvalEventRecord[]
): JudgeOutput {
  const eventCounts = new Map<string, number>();
  for (const { event } of events) {
    eventCounts.set(event, (eventCounts.get(event) ?? 0) + 1);
  }

  const clarity = to100(scoreFromEvents(eventCounts, DIMENSION_EVENTS.clarity));
  const context = to100(scoreFromEvents(eventCounts, DIMENSION_EVENTS.context));
  const steering = to100(scoreFromEvents(eventCounts, DIMENSION_EVENTS.steering));
  const judgment = to100(scoreFromEvents(eventCounts, DIMENSION_EVENTS.judgment));
  const safetyOwnership = to100(scoreFromSafetyEvents(eventCounts));

  const dimensionScores = { clarity, context, steering, judgment, safetyOwnership };
  const weightedScore = Math.round(
    (clarity * RUBRIC_WEIGHTS.clarity +
      context * RUBRIC_WEIGHTS.context +
      steering * RUBRIC_WEIGHTS.steering +
      judgment * RUBRIC_WEIGHTS.judgment +
      safetyOwnership * RUBRIC_WEIGHTS.safetyOwnership) /
      100
  );

  return {
    scenarioId,
    sessionId,
    dimensionScores,
    weightedScore,
    evidence: buildEvidence(events),
  };
}

function scoreFromEvents(counts: Map<string, number>, eventIds: string[]): number {
  const n = eventIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n >= 4 && n < 6) return 4;
  return 5;
}

function scoreFromSafetyEvents(counts: Map<string, number>): number {
  const risk = counts.get("risk_noticed") ?? 0;
  const sensitive = counts.get("sensitive_info_shared") ?? 0;
  if (sensitive > 0 && risk === 0) return 1;
  if (risk > 0 && sensitive === 0) return 4;
  if (risk > 0 && sensitive > 0) return 3;
  return 2;
}

function buildEvidence(events: EvalEventRecord[]): Record<string, string[]> {
  const byDim: Record<string, string[]> = {};
  for (const { event } of events) {
    for (const [dim, evs] of Object.entries(DIMENSION_EVENTS)) {
      if (evs.includes(event)) {
        if (!byDim[dim]) byDim[dim] = [];
        if (!byDim[dim].includes(event)) byDim[dim].push(event);
      }
    }
  }
  return byDim;
}
