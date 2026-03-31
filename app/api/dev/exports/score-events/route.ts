import { handleApiError } from "@/lib/http";
import { getSessionService } from "@/server/services/container";

export async function GET(): Promise<Response> {
  try {
    const rows = [
      "sessionId,sceneId,eventId,probeId,timestamp,mbti_relation,mbti_workflow,mbti_epistemic,mbti_repair,faa_SI,faa_RC,faa_LO,faa_SR,faa_CI",
    ];
    const service = getSessionService();
    for (const sessionId of service.listSessionIds()) {
      const replay = service.getState(sessionId);
      for (const event of replay.events) {
        if (event.type !== "PROBE_SCORED") continue;
        rows.push(
          [
            sessionId,
            event.payload.sceneId,
            event.id,
            event.payload.probeId,
            event.timestamp,
            event.payload.mbtiDeltas.relation ?? "",
            event.payload.mbtiDeltas.workflow ?? "",
            event.payload.mbtiDeltas.epistemic ?? "",
            event.payload.mbtiDeltas.repair ?? "",
            event.payload.faaScores.SI ?? "",
            event.payload.faaScores.RC ?? "",
            event.payload.faaScores.LO ?? "",
            event.payload.faaScores.SR ?? "",
            event.payload.faaScores.CI ?? "",
          ].join(","),
        );
      }
    }
    return new Response(`${rows.join("\n")}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="score-events.csv"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

