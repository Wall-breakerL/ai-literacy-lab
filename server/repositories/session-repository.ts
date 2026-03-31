import type { SessionEvent, SessionId } from "@/domain";

export interface SessionRepository {
  create(sessionId: SessionId): void;
  exists(sessionId: SessionId): boolean;
  append(sessionId: SessionId, event: SessionEvent): void;
  list(sessionId: SessionId): SessionEvent[];
}
