import {
  FAA_DIMENSION_DEFINITIONS,
  MBTI_AXIS_DEFINITIONS,
  type SceneId,
  type SessionEvent,
  type SessionState,
} from "@/domain";
import { SCENE_REGISTRY } from "@/domain/assessment/registry";
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
  /** 研究视图：协作追问时间线可读摘要（不向默认用户强调「探针」）。 */
  probeHighlights: string[];
  audit: {
    rawSnapshot: SessionState;
    /** Raw events for PROBE_FIRED / PROBE_CLOSED. */
    probeTimeline: SessionEvent[];
    /** Human-readable probe / scoring trail (default-friendly). */
    probeLifecycleReadable: Array<{
      timestamp: string;
      kind: "probe_fired" | "probe_closed" | "evaluation_applied";
      sceneId: SceneId;
      probeId?: string;
      probeInstanceId?: string;
      weight?: "high" | "medium" | "low";
      summary: string;
    }>;
    sceneDeltaSources: Array<{
      sceneId: SceneId;
      source: "probe" | "evaluation";
      probeId: string;
      probeInstanceId?: string;
      mbtiDeltas: Record<string, number>;
      faaScores: Record<string, number>;
      note?: string;
    }>;
  };
}

function axisLabel(axisId: string): string {
  return MBTI_AXIS_DEFINITIONS.find((axis) => axis.id === axisId)?.labelZh ?? axisId;
}

function sceneTitle(sceneId: SceneId): string {
  return sceneId === "apartment-tradeoff" ? "Apartment Trade-off" : "Brand Naming Sprint";
}

function sceneTitleZh(sceneId: SceneId): string {
  return SCENE_REGISTRY[sceneId].titleZh;
}

function resolveProbeLabel(sceneId: SceneId, probeId: string): string {
  return SCENE_REGISTRY[sceneId].probes.find((p) => p.id === probeId)?.label ?? probeId;
}

function buildProbeHighlights(events: SessionEvent[]): string[] {
  const lines: string[] = [];
  for (const event of events) {
    if (event.type === "PROBE_FIRED") {
      const label = resolveProbeLabel(event.payload.sceneId, event.payload.probeId);
      const hid = event.payload.hiddenObjectiveZh ? ` 协作意图：${event.payload.hiddenObjectiveZh.slice(0, 120)}` : "";
      lines.push(
        `「${sceneTitleZh(event.payload.sceneId)}」插入协作追问「${label}」：${event.payload.triggerReason.slice(0, 120)}${event.payload.triggerReason.length > 120 ? "…" : ""}${hid}`,
      );
    }
    if (event.type === "PROBE_CLOSED") {
      const label = resolveProbeLabel(event.payload.sceneId, event.payload.probeId);
      if (event.payload.scoreApplied) {
        lines.push(`「${sceneTitleZh(event.payload.sceneId)}」追问「${label}」已高质量回应并纳入评分：${event.payload.reason.slice(0, 100)}`);
      } else {
        lines.push(`「${sceneTitleZh(event.payload.sceneId)}」追问「${label}」结束（未计分）：${event.payload.reason.slice(0, 100)}`);
      }
    }
  }
  return lines.slice(-12);
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

function buildProbeLifecycleReadable(events: SessionEvent[]): SessionResultPayload["audit"]["probeLifecycleReadable"] {
  const rows: SessionResultPayload["audit"]["probeLifecycleReadable"] = [];
  for (const event of events) {
    if (event.type === "PROBE_FIRED") {
      rows.push({
        timestamp: event.timestamp,
        kind: "probe_fired",
        sceneId: event.payload.sceneId,
        probeId: event.payload.probeId,
        probeInstanceId: event.payload.probeInstanceId,
        weight: event.payload.weight,
        summary: `观察挑战「${resolveProbeLabel(event.payload.sceneId, event.payload.probeId)}」已触发（${event.payload.weight}）。${event.payload.triggerReason}`,
      });
    }
    if (event.type === "PROBE_CLOSED") {
      const scored = event.payload.scoreApplied && event.payload.outcome === "resolved";
      rows.push({
        timestamp: event.timestamp,
        kind: "probe_closed",
        sceneId: event.payload.sceneId,
        probeId: event.payload.probeId,
        probeInstanceId: event.payload.probeInstanceId,
        weight: undefined,
        summary: scored
          ? `「${resolveProbeLabel(event.payload.sceneId, event.payload.probeId)}」已回应并计分：${event.payload.reason}`
          : `「${resolveProbeLabel(event.payload.sceneId, event.payload.probeId)}」结案未计分：${event.payload.reason}`,
      });
    }
    if (event.type === "EVALUATION_SCORE_APPLIED") {
      const src =
        event.payload.sourceType === "probe_response"
          ? "追问回应后的行为评分"
          : event.payload.sourceType === "ordinary_collaboration"
            ? "日常协作行为评分"
            : "行为评分";
      const ex = event.payload.evidenceExcerpt ? ` 证据摘录：${event.payload.evidenceExcerpt.slice(0, 120)}` : "";
      rows.push({
        timestamp: event.timestamp,
        kind: "evaluation_applied",
        sceneId: event.payload.sceneId,
        probeId: "agent_b_signal",
        summary: `${src}：${event.payload.reason}${ex}`,
      });
    }
  }
  return rows;
}

export function buildSessionResult(snapshot: SessionState, events: SessionEvent[]): SessionResultPayload {
  const mbtiAxes = aggregateMbtiFromEvents(events);
  const faa = aggregateFaaFromEvents(events);
  const typeCode = buildMbtiTypeCode(mbtiAxes).code;
  const contextVariation = buildContextVariation(mbtiAxes);
  const probeTimeline = events.filter((event) => event.type === "PROBE_FIRED" || event.type === "PROBE_CLOSED");
  const probeLifecycleReadable = buildProbeLifecycleReadable(events);
  const sceneDeltaSources: SessionResultPayload["audit"]["sceneDeltaSources"] = [];
  for (const event of events) {
    if (event.type === "PROBE_CLOSED" && event.payload.scoreApplied) {
      sceneDeltaSources.push({
        sceneId: event.payload.sceneId,
        source: "probe",
        probeId: event.payload.probeId,
        probeInstanceId: event.payload.probeInstanceId,
        mbtiDeltas: event.payload.mbtiDeltas as Record<string, number>,
        faaScores: event.payload.faaScores as Record<string, number>,
        note: `${resolveProbeLabel(event.payload.sceneId, event.payload.probeId)} · ${event.payload.reason}`,
      });
    }
    if (event.type === "EVALUATION_SCORE_APPLIED") {
      const st =
        event.payload.sourceType === "probe_response"
          ? "追问回应"
          : event.payload.sourceType === "ordinary_collaboration"
            ? "日常协作"
            : "行为评分";
      const ex = event.payload.evidenceExcerpt ? ` · 证据：${event.payload.evidenceExcerpt.slice(0, 100)}` : "";
      sceneDeltaSources.push({
        sceneId: event.payload.sceneId,
        source: "evaluation",
        probeId: "agent_b_signal",
        mbtiDeltas: event.payload.mbtiDeltas as Record<string, number>,
        faaScores: event.payload.faaScores as Record<string, number>,
        note: `${st} · ${event.payload.reason}${ex}`,
      });
    }
  }

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
    probeHighlights: buildProbeHighlights(events),
    audit: {
      rawSnapshot: snapshot,
      probeTimeline,
      probeLifecycleReadable,
      sceneDeltaSources,
    },
  };
}

