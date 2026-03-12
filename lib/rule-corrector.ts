import type { DimensionScores, DimensionScore, JudgeOutput, EvalEventRecord, EvalEvent } from "./types";
import { RUBRIC_WEIGHTS } from "./constants";

/** Which events support each dimension (for no-evidence cap). */
export const DIMENSION_EVENTS: Record<keyof DimensionScores, EvalEvent[]> = {
  clarity: ["goal_specified", "constraint_specified", "recipient_specified"],
  context: ["context_added", "example_added"],
  steering: ["revision_requested", "comparison_requested"],
  judgment: ["verification_requested", "comparison_requested"],
  safetyOwnership: ["risk_noticed"],
};

/** 无事件支撑时该维上限（百分制，原 2/5 → 40） */
const MAX_SCORE_WHEN_NO_EVIDENCE = 40;
/** 敏感信息裸贴且无 risk_noticed 时 Safety 上限（百分制，原 1/5 → 20） */
const SAFETY_CAP_WHEN_SENSITIVE_WITHOUT_RISK = 20;

export type CorrectedOutput = JudgeOutput & {
  suggestions?: string[];
};

/**
 * Apply rule-based corrections to raw Judge output.
 * - No evidence for a dimension → cap that dimension at 2.
 * - sensitive_info_shared without risk_noticed → penalize safetyOwnership (and optionally total).
 */
export function applyRuleCorrections(
  raw: JudgeOutput,
  events: EvalEventRecord[]
): CorrectedOutput {
  const eventTypes = new Set(events.map((e) => e.event));
  const hasSensitiveWithoutRisk =
    eventTypes.has("sensitive_info_shared") && !eventTypes.has("risk_noticed");

  const scores = { ...raw.dimensionScores };

  for (const dim of Object.keys(DIMENSION_EVENTS) as (keyof DimensionScores)[]) {
    const supporting = DIMENSION_EVENTS[dim];
    const hasEvidence = supporting.some((ev) => eventTypes.has(ev));
    if (!hasEvidence && scores[dim] > MAX_SCORE_WHEN_NO_EVIDENCE) {
      scores[dim] = Math.min(scores[dim], MAX_SCORE_WHEN_NO_EVIDENCE);
    }
  }

  if (hasSensitiveWithoutRisk) {
    scores.safetyOwnership = Math.min(scores.safetyOwnership, SAFETY_CAP_WHEN_SENSITIVE_WITHOUT_RISK);
  }

  const weightedScore = Math.round(
    (scores.clarity * RUBRIC_WEIGHTS.clarity +
      scores.context * RUBRIC_WEIGHTS.context +
      scores.steering * RUBRIC_WEIGHTS.steering +
      scores.judgment * RUBRIC_WEIGHTS.judgment +
      scores.safetyOwnership * RUBRIC_WEIGHTS.safetyOwnership) /
      100
  );

  const suggestions = buildSuggestions(scores, hasSensitiveWithoutRisk);

  return {
    ...raw,
    dimensionScores: scores,
    weightedScore,
    suggestions,
  };
}

/** 百分制下「较弱」阈值（原 2/5 ≈ 40） */
const LOW_THRESHOLD = 40;

function buildSuggestions(
  scores: DimensionScores,
  hadSensitiveRisk: boolean
): string[] {
  const list: string[] = [];
  if (scores.clarity <= LOW_THRESHOLD) {
    list.push("可以说清任务目标、约束和受众，便于助手更好理解。");
  }
  if (scores.context <= LOW_THRESHOLD) {
    list.push("适当补充背景或例子，能减少反复澄清。");
  }
  if (scores.steering <= LOW_THRESHOLD) {
    list.push("需要调整方向时，可以明确要求改写或对比。");
  }
  if (scores.judgment <= LOW_THRESHOLD) {
    list.push("对不确定的信息可以追问核实，再采纳结果。");
  }
  if (scores.safetyOwnership <= LOW_THRESHOLD || hadSensitiveRisk) {
    list.push("注意敏感信息边界，避免在对话中暴露个人隐私。");
  }
  return list.slice(0, 3);
}
