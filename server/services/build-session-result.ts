import {
  FAA_DIMENSION_DEFINITIONS,
  MBTI_AXIS_DEFINITIONS,
  type SceneId,
  type SessionEvent,
  type SessionState,
} from "@/domain";
import { aggregateFaaFromEvents } from "@/domain/faa/aggregate";
import { aggregateMbtiFromEvents } from "@/domain/mbti/aggregate";
import { buildMbtiTypeCode } from "@/domain/mbti/type-mapping";

interface SceneContribution {
  sceneId: SceneId;
  title: string;
  mbti: Record<string, number>;
  faa: Record<string, number>;
  probeIds: string[];
}

interface ContextVariation {
  axisId: string;
  status: "stable" | "sensitive" | "insufficient";
  note: string;
}

export interface SessionResultPayload {
  sessionId: string;
  summary: string;
  mbtiTypeCode: string;
  mbtiAxes: ReturnType<typeof aggregateMbtiFromEvents>;
  faaDimensions: ReturnType<typeof aggregateFaaFromEvents>["dimensions"];
  faaOverall: number;
  sceneContribution: SceneContribution[];
  contextVariation: ContextVariation[];
  evidenceCards: Array<{ dimensionId: string; label: string; evidence: Array<{ sceneId: SceneId; excerpt: string; probeId: string }> }>;
  strengths: string[];
  blindspots: string[];
  suggestions: string[];
  lowConfidenceNotes: string[];
  shareCopy: string;
  audit: {
    rawSnapshot: SessionState;
    probeTimeline: SessionEvent[];
    sceneDeltaSources: Array<{ sceneId: SceneId; probeId: string; mbtiDeltas: Record<string, number>; faaScores: Record<string, number> }>;
  };
}

function axisLabel(axisId: string): string {
  return MBTI_AXIS_DEFINITIONS.find((axis) => axis.id === axisId)?.labelZh ?? axisId;
}

function sceneTitle(sceneId: SceneId): string {
  return sceneId === "apartment-tradeoff" ? "Apartment Trade-off" : "Brand Naming Sprint";
}

function buildContextVariation(axes: ReturnType<typeof aggregateMbtiFromEvents>): ContextVariation[] {
  return axes.map((axis) => {
    const apartment = axis.sceneContribution["apartment-tradeoff"];
    const brand = axis.sceneContribution["brand-naming-sprint"];
    const sameDirection = Math.sign(apartment) !== 0 && Math.sign(apartment) === Math.sign(brand);
    const fluctuation = Math.abs(apartment - brand);
    if (axis.lowConfidence || axis.evidenceCount < 2) {
      return {
        axisId: axis.axisId,
        status: "insufficient",
        note: `${axisLabel(axis.axisId)}证据较少，暂不判断稳定性。`,
      };
    }
    if (sameDirection && fluctuation < 28) {
      return {
        axisId: axis.axisId,
        status: "stable",
        note: `${axisLabel(axis.axisId)}在两段任务中方向一致，表现为较稳定的协作偏好。`,
      };
    }
    return {
      axisId: axis.axisId,
      status: "sensitive",
      note: `${axisLabel(axis.axisId)}在不同情境下波动较明显，显示出情境敏感性。`,
    };
  });
}

export function buildSessionResult(snapshot: SessionState, events: SessionEvent[]): SessionResultPayload {
  const mbtiAxes = aggregateMbtiFromEvents(events);
  const faa = aggregateFaaFromEvents(events);
  const typeCode = buildMbtiTypeCode(mbtiAxes).code;
  const contextVariation = buildContextVariation(mbtiAxes);
  const probeTimeline = events.filter((event) => event.type === "PROBE_FIRED" || event.type === "PROBE_SCORED");
  const sceneDeltaSources = events
    .filter((event) => event.type === "PROBE_SCORED")
    .map((event) => ({
      sceneId: event.payload.sceneId,
      probeId: event.payload.probeId,
      mbtiDeltas: event.payload.mbtiDeltas as Record<string, number>,
      faaScores: event.payload.faaScores as Record<string, number>,
    }));

  const sceneContribution: SceneContribution[] = (["apartment-tradeoff", "brand-naming-sprint"] as const).map((sceneId) => ({
    sceneId,
    title: sceneTitle(sceneId),
    mbti: Object.fromEntries(mbtiAxes.map((axis) => [axis.axisId, axis.sceneContribution[sceneId]])),
    faa: Object.fromEntries(faa.dimensions.map((item) => [item.dimensionId, item.sceneContribution[sceneId]])),
    probeIds: events.flatMap((event) => {
      if (event.type !== "PROBE_FIRED") return [];
      if (event.payload.sceneId !== sceneId) return [];
      return [event.payload.probeId];
    }),
  }));

  const evidenceCards = [
    ...mbtiAxes.map((axis) => ({
      dimensionId: axis.axisId,
      label: `AI-MBTI / ${axisLabel(axis.axisId)}`,
      evidence: axis.keyEvidence.map((item) => ({
        sceneId: item.sceneId,
        excerpt: item.excerpt,
        probeId: item.probeId,
      })),
    })),
    ...faa.dimensions.map((dimension) => ({
      dimensionId: dimension.dimensionId,
      label: `FAA / ${FAA_DIMENSION_DEFINITIONS.find((item) => item.id === dimension.dimensionId)?.labelZh ?? dimension.dimensionId}`,
      evidence: dimension.keyEvidence.map((item) => ({
        sceneId: item.sceneId,
        excerpt: item.excerpt,
        probeId: item.probeId,
      })),
    })),
  ];

  const strongestAxis = [...mbtiAxes].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const weakestFaa = [...faa.dimensions].sort((a, b) => a.score - b.score)[0];
  const strongestFaa = [...faa.dimensions].sort((a, b) => b.score - a.score)[0];
  const lowConfidenceNotes = [...mbtiAxes, ...faa.dimensions]
    .filter((item) => item.lowConfidence)
    .map((item) => `${"axisId" in item ? axisLabel(item.axisId) : item.dimensionId} 证据不足，结果仅供参考。`);

  const summary =
    "结果来自同一 session 的两段连续任务行为证据。AI-MBTI 反映当前情境下的协作风格偏好，不代表固定人格；FAA 反映你在陌生任务中的 AI 适配能力。";

  return {
    sessionId: snapshot.sessionId,
    summary,
    mbtiTypeCode: typeCode,
    mbtiAxes,
    faaDimensions: faa.dimensions,
    faaOverall: faa.overall,
    sceneContribution,
    contextVariation,
    evidenceCards,
    strengths: [
      `${axisLabel(strongestAxis.axisId)}方向信号较清晰，决策取向稳定度较高。`,
      `${strongestFaa.dimensionId} 维度表现相对更强。`,
    ],
    blindspots: [
      `${weakestFaa.dimensionId} 维度相对偏弱，建议在后续任务中补足该类行为证据。`,
      "若某些轴低置信度，说明当前证据链仍不足以做强判断。",
    ],
    suggestions: [
      "在下一次任务中持续记录“判断-证据-修正”链条，提升可审计性。",
      "遇到跨情境切换时，先复盘约束再调用 AI，减少策略漂移。",
    ],
    lowConfidenceNotes,
    shareCopy: `我在 Human-AI Performance Lab 完成了连续双任务协作测评。当前类型倾向 ${typeCode}，FAA 总分 ${faa.overall.toFixed(
      1,
    )}。这不是考试，而是一次可审计的人机协作复盘。`,
    audit: {
      rawSnapshot: snapshot,
      probeTimeline,
      sceneDeltaSources,
    },
  };
}

