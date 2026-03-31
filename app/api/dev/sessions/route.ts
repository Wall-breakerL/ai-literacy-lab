import { handleApiError } from "@/lib/http";
import { getSessionService } from "@/server/services/container";

export async function GET(): Promise<Response> {
  try {
    const service = getSessionService();
    const sessionIds = service.listSessionIds();
    const sessions = sessionIds.map((sessionId) => {
      const replay = service.getState(sessionId);
      return {
        sessionId,
        updatedAt: replay.state.updatedAt,
        assessmentState: replay.state.assessmentState,
      };
    });
    return Response.json({ sessions: sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch (error) {
    return handleApiError(error);
  }
}

