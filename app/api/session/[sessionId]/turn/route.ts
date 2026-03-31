import { SessionIdSchema, TurnInputSchema, TurnOutputSchema } from "@/domain";
import { handleApiError } from "@/lib/http";
import { getSessionService } from "@/server/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    const sessionId = SessionIdSchema.parse((await context.params).sessionId);
    const body = TurnInputSchema.parse(await request.json());
    if (body.sessionId !== sessionId) {
      throw new Error("SESSION_ID_MISMATCH");
    }
    const output = await getSessionService().runTurn(sessionId, body.userMessage);
    return Response.json(TurnOutputSchema.parse(output));
  } catch (error) {
    return handleApiError(error);
  }
}
