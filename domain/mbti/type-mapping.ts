import { MBTI_AXIS_DEFINITIONS, type MbtiAxisId, type MbtiAxisLetter } from "@/domain/mbti/axes";
import type { MbtiAxisAggregate } from "@/domain/mbti/aggregate";

interface AxisLetterMapping {
  axisId: MbtiAxisId;
  negativeLetter: MbtiAxisLetter;
  positiveLetter: MbtiAxisLetter;
}

const AXIS_MAPPING: AxisLetterMapping[] = MBTI_AXIS_DEFINITIONS.map((definition) => ({
  axisId: definition.id,
  negativeLetter: definition.negativePole.letter,
  positiveLetter: definition.positivePole.letter,
}));

export interface MbtiLetterDecision {
  axisId: MbtiAxisId;
  letter: string;
  uncertain: boolean;
}

export function buildMbtiTypeCode(
  aggregates: MbtiAxisAggregate[],
  options?: { confidenceFloor?: number; midlineFloor?: number },
): { code: string; decisions: MbtiLetterDecision[] } {
  const confidenceFloor = options?.confidenceFloor ?? 45;
  const midlineFloor = options?.midlineFloor ?? 12;

  const decisions = AXIS_MAPPING.map((mapping) => {
    const axis = aggregates.find((item) => item.axisId === mapping.axisId);
    if (!axis) {
      return { axisId: mapping.axisId, letter: "-", uncertain: true };
    }
    const uncertain = axis.confidence < confidenceFloor || Math.abs(axis.score) < midlineFloor;
    if (uncertain) {
      return { axisId: mapping.axisId, letter: "-", uncertain: true };
    }
    const letter = axis.score >= 0 ? mapping.positiveLetter : mapping.negativeLetter;
    return { axisId: mapping.axisId, letter, uncertain: false };
  });

  return {
    code: decisions.map((item) => item.letter).join(""),
    decisions,
  };
}

