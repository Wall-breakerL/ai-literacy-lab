import { GetSessionResponseSchema, SessionIdSchema } from "@/domain";
import { handleApiError } from "@/lib/http";
import { getSessionService } from "@/server/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    const sessionId = SessionIdSchema.parse((await context.params).sessionId);
    const replay = getSessionService().getState(sessionId);
    return Response.json(GetSessionResponseSchema.parse({ sessionId, snapshot: replay.state, events: replay.events }));
  } catch (error) {
    return handleApiError(error);
  }
}
