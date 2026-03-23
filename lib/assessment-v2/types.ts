import type { V2DimensionKey } from "./weights";

export type V2DimResult = {
  score: number;
  max: number;
  evidence: string[];
  reason: string;
};

export type JudgeOutputV2 = {
  rubricVersion: string;
  scenarioId: string;
  identityId?: string;
  dimensions: Record<V2DimensionKey, V2DimResult>;
  flags: string[];
  suggestions: string[];
  blindSpots: string[];
  nextRecommendedScenarios: string[];
  nextRecommendedProbes: string[];
};

export type V2DimensionScores = Record<V2DimensionKey, number>;
