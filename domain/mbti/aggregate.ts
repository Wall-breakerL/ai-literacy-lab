import type { SessionEvent } from "@/domain/session/events";
import type { MbtiAxisId } from "@/domain/mbti/axes";
import type { SceneId } from "@/domain/scenes/types";

const AXIS_IDS: MbtiAxisId[] = ["relation", "workflow", "epistemic", "repair"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPercentage(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export interface MbtiAxisAggregate {
  axisId: MbtiAxisId;
  score: number;
  confidence: number;
  lowConfidence: boolean;
  sceneContribution: Record<SceneId, number>;
  evidenceCount: number;
  keyEvidence: Array<{ sceneId: SceneId; excerpt: string; probeId: string; delta: number }>;
}

export function aggregateMbtiFromEvents(events: SessionEvent[]): MbtiAxisAggregate[] {
  const probeScored = events.filter((event) => event.type === "PROBE_SCORED");

  return AXIS_IDS.map((axisId) => {
    const sceneContribution = {
      "apartment-tradeoff": 0,
      "brand-naming-sprint": 0,
    } as Record<SceneId, number>;
    const evidences: Array<{ sceneId: SceneId; excerpt: string; probeId: string; delta: number }> = [];

    for (const event of probeScored) {
      const delta = event.payload.mbtiDeltas[axisId] ?? 0;
      if (delta === 0) continue;
      sceneContribution[event.payload.sceneId] += delta;
      evidences.push({
        sceneId: event.payload.sceneId,
        excerpt: event.payload.evidenceExcerpt,
        probeId: event.payload.probeId,
        delta,
      });
    }

    const total = sceneContribution["apartment-tradeoff"] + sceneContribution["brand-naming-sprint"];
    const score = toPercentage(clamp(total * 100, -100, 100));
    const evidenceCount = evidences.length;
    const signalStrength = clamp(Math.abs(total) / 0.35, 0, 1);
    const evidenceCoverage = clamp(evidenceCount / 4, 0, 1);
    const confidence = Math.round((signalStrength * 0.58 + evidenceCoverage * 0.42) * 100);
    const lowConfidence = confidence < 45 || Math.abs(score) < 12;
    const keyEvidence = [...evidences].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);

    return {
      axisId,
      score,
      confidence,
      lowConfidence,
      sceneContribution: {
        "apartment-tradeoff": toPercentage(clamp(sceneContribution["apartment-tradeoff"] * 100, -100, 100)),
        "brand-naming-sprint": toPercentage(clamp(sceneContribution["brand-naming-sprint"] * 100, -100, 100)),
      },
      evidenceCount,
      keyEvidence,
    };
  });
}

