import { CreateSessionResponseSchema, type CreateSessionResponse, type SessionState } from "@/domain";

export function createAssessmentSession(snapshot: SessionState): CreateSessionResponse {
  return CreateSessionResponseSchema.parse({
    sessionId: snapshot.sessionId,
    snapshot,
  });
}
