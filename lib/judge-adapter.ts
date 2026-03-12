import type { DimensionScores, DimensionScore, JudgeOutputRich, UserProfile } from "./types";
import { DIMENSION_KEYS } from "./constants";
import { RUBRIC_WEIGHTS } from "./constants";

/**
 * 从富结构提取五维得分（0–100），供规则校正层使用。
 */
export function richToScores(rich: JudgeOutputRich): DimensionScores {
  const s: Record<string, DimensionScore> = {};
  for (const k of DIMENSION_KEYS) {
    const level = rich.dimensions[k]?.level ?? 0;
    s[k] = Math.min(100, Math.max(0, Math.round(Number(level))));
  }
  return s as DimensionScores;
}

/**
 * 将校正后的 dimensionScores 写回富结构（仅覆盖 level），并可选覆盖 suggestions。
 */
export function applyCorrectedScoresToRich(
  rich: JudgeOutputRich,
  correctedScores: DimensionScores,
  suggestions?: string[]
): JudgeOutputRich {
  const dimensions = { ...rich.dimensions };
  for (const k of DIMENSION_KEYS) {
    if (dimensions[k]) {
      dimensions[k] = { ...dimensions[k], level: correctedScores[k] };
    }
  }
  return {
    ...rich,
    dimensions,
    suggestions: suggestions ?? rich.suggestions,
  };
}

/**
 * 由规则 Judge 的简化输出构造最小富结构（仅 level，evidence/reason 为空）。
 */
export function scoresToMinimalRich(
  scenarioId: string,
  profile: UserProfile,
  dimensionScores: DimensionScores,
  suggestions: string[],
  rubricVersion: string
): JudgeOutputRich {
  const dimensions = {} as JudgeOutputRich["dimensions"];
  for (const k of DIMENSION_KEYS) {
    dimensions[k] = {
      level: dimensionScores[k],
      evidence: [],
      reason: "",
    };
  }
  return {
    rubricVersion,
    scenarioId,
    profile,
    dimensions,
    flags: [],
    suggestions,
  };
}

/** 五维 0–100 加权得到总分 0–100 */
export function computeWeightedScore(scores: DimensionScores): number {
  const sum =
    scores.clarity * RUBRIC_WEIGHTS.clarity +
    scores.context * RUBRIC_WEIGHTS.context +
    scores.steering * RUBRIC_WEIGHTS.steering +
    scores.judgment * RUBRIC_WEIGHTS.judgment +
    scores.safetyOwnership * RUBRIC_WEIGHTS.safetyOwnership;
  return Math.round(sum / 100);
}
