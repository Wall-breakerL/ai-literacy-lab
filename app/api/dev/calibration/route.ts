import { handleApiError } from "@/lib/http";
import { buildCalibrationReport } from "@/server/analytics/calibration";
import { buildCoverageReport } from "@/server/analytics/coverage-report";
import { getSessionService } from "@/server/services/container";

export async function GET(): Promise<Response> {
  try {
    const service = getSessionService();
    const sessions = service.listSessionIds().map((sessionId) => {
      const replay = service.getState(sessionId);
      return {
        sessionId,
        snapshot: replay.state,
        events: replay.events,
      };
    });
    const calibration = buildCalibrationReport(sessions);
    const coverage = buildCoverageReport(calibration);
    return Response.json({ calibration, coverage });
  } catch (error) {
    return handleApiError(error);
  }
}

