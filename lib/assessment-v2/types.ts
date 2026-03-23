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

// ---------------------------------------------------------------------------
// Phase-level scoring (Plan C two-phase evaluation)
// ---------------------------------------------------------------------------

export type PhaseScore = {
  phase: "helper" | "talk";
  /** Weighted score for this phase alone (0–100 scale). */
  score: number;
  /** Per-dimension scores scoped to this phase. */
  dimensions: Record<V2DimensionKey, V2DimResult>;
  /** Event counts scoped to this phase. */
  eventCounts: Record<string, number>;
};

export type PhaseScores = {
  helper: PhaseScore;
  talk: PhaseScore;
  /** Phase weights used for final composition. */
  weights: { helper: number; talk: number };
};
