import type { SessionEvent, SessionId } from "@/domain";
import type { SessionRepository } from "@/server/repositories/session-repository";

export class InMemorySessionRepository implements SessionRepository {
  private readonly eventsBySession = new Map<SessionId, SessionEvent[]>();

  create(sessionId: SessionId): void {
    if (!this.eventsBySession.has(sessionId)) {
      this.eventsBySession.set(sessionId, []);
    }
  }

  exists(sessionId: SessionId): boolean {
    return this.eventsBySession.has(sessionId);
  }

  append(sessionId: SessionId, event: SessionEvent): void {
    const events = this.eventsBySession.get(sessionId);
    if (!events) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    events.push(event);
  }

  list(sessionId: SessionId): SessionEvent[] {
    const events = this.eventsBySession.get(sessionId);
    if (!events) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return [...events];
  }
}
