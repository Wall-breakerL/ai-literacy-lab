import { handleApiError } from "@/lib/http";
import { buildSessionResult } from "@/server/services/build-session-result";
import { getSessionService } from "@/server/services/container";

export async function GET(): Promise<Response> {
  try {
    const rows = ["sessionId,assessmentState,mbtiType,faaOverall,lowConfidenceCount,contextSensitiveAxes"];
    const service = getSessionService();
    for (const sessionId of service.listSessionIds()) {
      const replay = service.getState(sessionId);
      const result = buildSessionResult(replay.state, replay.events);
      rows.push(
        [
          sessionId,
          replay.state.assessmentState,
          result.mbtiTypeCode,
          result.faaOverall.toFixed(1),
          result.lowConfidenceNotes.length,
          result.contextVariation.filter((item) => item.status === "sensitive").length,
        ].join(","),
      );
    }
    return new Response(`${rows.join("\n")}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="session-summary.csv"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

