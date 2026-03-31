import { SessionIdSchema } from "@/domain";
import { handleApiError } from "@/lib/http";
import { buildReplayView } from "@/server/analytics/replay";
import { getSessionService } from "@/server/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    const sessionId = SessionIdSchema.parse((await context.params).sessionId);
    const replay = getSessionService().getState(sessionId);
    return Response.json(buildReplayView(sessionId, replay.state, replay.events));
  } catch (error) {
    return handleApiError(error);
  }
}

