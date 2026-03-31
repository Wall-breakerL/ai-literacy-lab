import type { SessionEvent } from "@/domain/session/events";
import type { FaaDimensionId } from "@/domain/faa/dimensions";
import type { SceneId } from "@/domain/scenes/types";

const DIMENSION_IDS: FaaDimensionId[] = ["SI", "RC", "LO", "SR", "CI"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPercentage(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export interface FaaDimensionAggregate {
  dimensionId: FaaDimensionId;
  score: number;
  confidence: number;
  lowConfidence: boolean;
  sceneContribution: Record<SceneId, number>;
  evidenceCount: number;
  keyEvidence: Array<{ sceneId: SceneId; excerpt: string; probeId: string; delta: number }>;
}

export interface FaaAggregateResult {
  dimensions: FaaDimensionAggregate[];
  overall: number;
}

export function aggregateFaaFromEvents(events: SessionEvent[]): FaaAggregateResult {
  const probeScored = events.filter((event) => event.type === "PROBE_SCORED");
  const dimensions = DIMENSION_IDS.map((dimensionId) => {
    const sceneContribution = {
      "apartment-tradeoff": 0,
      "brand-naming-sprint": 0,
    } as Record<SceneId, number>;
    const evidences: Array<{ sceneId: SceneId; excerpt: string; probeId: string; delta: number }> = [];

    for (const event of probeScored) {
      const delta = event.payload.faaScores[dimensionId] ?? 0;
      if (delta === 0) continue;
      sceneContribution[event.payload.sceneId] += delta;
      evidences.push({
        sceneId: event.payload.sceneId,
        excerpt: event.payload.evidenceExcerpt,
        probeId: event.payload.probeId,
        delta,
      });
    }

    const totalDelta = sceneContribution["apartment-tradeoff"] + sceneContribution["brand-naming-sprint"];
    const score = toPercentage(clamp(50 + totalDelta * 50, 0, 100));
    const evidenceCount = evidences.length;
    const signalStrength = clamp(Math.abs(totalDelta) / 0.4, 0, 1);
    const evidenceCoverage = clamp(evidenceCount / 4, 0, 1);
    const confidence = Math.round((signalStrength * 0.56 + evidenceCoverage * 0.44) * 100);
    const lowConfidence = confidence < 45;
    const keyEvidence = [...evidences].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);

    return {
      dimensionId,
      score,
      confidence,
      lowConfidence,
      sceneContribution: {
        "apartment-tradeoff": toPercentage(clamp(50 + sceneContribution["apartment-tradeoff"] * 50, 0, 100)),
        "brand-naming-sprint": toPercentage(clamp(50 + sceneContribution["brand-naming-sprint"] * 50, 0, 100)),
      },
      evidenceCount,
      keyEvidence,
    };
  });

  const overall = toPercentage(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  return { dimensions, overall };
}

