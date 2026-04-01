import type { SceneId } from "@/domain/scenes/types";
import type { SessionEvent } from "@/domain/session/events";

/** Debug-only aggregation of one probe instance lifecycle (fired → awaiting → closed → scored or not). */
export interface ProbeInstanceLifecycleDebug {
  probeInstanceId: string;
  probeId: string;
  sceneId: SceneId;
  weight: "high" | "medium" | "low";
  firedAt: string;
  hiddenObjectivePreview: string;
  /** open = fired and not yet PROBE_CLOSED */
  status: "open" | "closed";
  closedAt?: string;
  outcome?: "resolved" | "unresolved";
  scoreApplied?: boolean;
  closeReason?: string;
  timeline: Array<{ at: string; label: string; detail: string }>;
}

function pushTimeline(
  row: ProbeInstanceLifecycleDebug,
  at: string,
  label: string,
  detail: string,
) {
  row.timeline.push({ at, label, detail });
}

/**
 * Replays PROBE_FIRED / PROBE_CLOSED for a scene and returns open instances + recently closed chains.
 * EVALUATION_SCORE_APPLIED is listed separately (no probeInstanceId on event).
 */
export function buildProbeLifecycleDebugView(
  events: SessionEvent[],
  sceneId: SceneId,
): {
  openInstances: ProbeInstanceLifecycleDebug[];
  recentClosed: ProbeInstanceLifecycleDebug[];
  recentEvaluations: Array<{ at: string; sourceType?: string; reason: string; excerpt?: string }>;
} {
  const byInstance = new Map<string, ProbeInstanceLifecycleDebug>();
  const order: string[] = [];

  for (const e of events) {
    if (e.type === "PROBE_FIRED" && e.payload.sceneId === sceneId) {
      const row: ProbeInstanceLifecycleDebug = {
        probeInstanceId: e.payload.probeInstanceId,
        probeId: e.payload.probeId,
        sceneId: e.payload.sceneId,
        weight: e.payload.weight,
        firedAt: e.timestamp,
        hiddenObjectivePreview: (e.payload.hiddenObjectiveZh ?? e.payload.prompt).slice(0, 120),
        status: "open",
        timeline: [],
      };
      pushTimeline(row, e.timestamp, "fired", `probe ${e.payload.probeId} (${e.payload.weight}) · ${e.payload.triggerReason.slice(0, 100)}`);
      byInstance.set(e.payload.probeInstanceId, row);
      order.push(e.payload.probeInstanceId);
    }
    if (e.type === "PROBE_CLOSED" && e.payload.sceneId === sceneId) {
      const row = byInstance.get(e.payload.probeInstanceId);
      if (row) {
        row.status = "closed";
        row.closedAt = e.timestamp;
        row.outcome = e.payload.outcome;
        row.scoreApplied = e.payload.scoreApplied;
        row.closeReason = e.payload.reason;
        const scored = e.payload.scoreApplied && e.payload.outcome === "resolved";
        pushTimeline(
          row,
          e.timestamp,
          "closed",
          scored ? "resolved · 分数已写入 reducer" : `${e.payload.outcome ?? "?"} · 未计分`,
        );
      }
    }
  }

  const openInstances = order
    .map((id) => byInstance.get(id))
    .filter((r): r is ProbeInstanceLifecycleDebug => !!r && r.status === "open");

  const closed = order
    .map((id) => byInstance.get(id))
    .filter((r): r is ProbeInstanceLifecycleDebug => !!r && r.status === "closed");
  const recentClosed = closed.slice(-8);

  const recentEvaluations: Array<{ at: string; sourceType?: string; reason: string; excerpt?: string }> = [];
  for (const e of events) {
    if (e.type === "EVALUATION_SCORE_APPLIED" && e.payload.sceneId === sceneId) {
      recentEvaluations.push({
        at: e.timestamp,
        sourceType: e.payload.sourceType,
        reason: e.payload.reason,
        excerpt: e.payload.evidenceExcerpt,
      });
    }
  }

  return {
    openInstances,
    recentClosed,
    recentEvaluations: recentEvaluations.slice(-12),
  };
}
