import { CreateSessionRequestSchema, CreateSessionResponseSchema } from "@/domain";
import { handleApiError } from "@/lib/http";
import { createAssessmentSession } from "@/server/services/create-session";
import { getSessionService } from "@/server/services/container";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request
      .json()
      .catch(() => ({}))
      .then((value) => CreateSessionRequestSchema.parse(value));

    // Reserved for future participant metadata.
    void body;

    const snapshot = getSessionService().createSession();
    const payload = CreateSessionResponseSchema.parse(createAssessmentSession(snapshot));
    return Response.json(payload, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
