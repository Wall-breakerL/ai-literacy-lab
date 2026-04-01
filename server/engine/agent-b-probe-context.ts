import type { ProbeId } from "@/domain/probes/types";
import type { SessionEvent } from "@/domain/session/events";

/** Replay PROBE_FIRED / PROBE_CLOSED to find instances still awaiting user response. */
export function getOpenProbeInstances(
  events: SessionEvent[],
  sceneId: string,
): Array<{ probeInstanceId: string; probeId: ProbeId }> {
  const fired = new Map<string, { probeId: ProbeId }>();
  for (const e of events) {
    if (e.type === "PROBE_FIRED" && e.payload.sceneId === sceneId) {
      fired.set(e.payload.probeInstanceId, { probeId: e.payload.probeId });
    }
    if (e.type === "PROBE_CLOSED" && e.payload.sceneId === sceneId) {
      fired.delete(e.payload.probeInstanceId);
    }
  }
  return [...fired.entries()].map(([probeInstanceId, v]) => ({ probeInstanceId, probeId: v.probeId }));
}
