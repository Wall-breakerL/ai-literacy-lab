import { handleApiError } from "@/lib/http";
import { getSessionService } from "@/server/services/container";

export async function GET(): Promise<Response> {
  try {
    const service = getSessionService();
    const lines: string[] = [];
    for (const sessionId of service.listSessionIds()) {
      const replay = service.getState(sessionId);
      for (const event of replay.events) {
        if (event.type !== "USER_MESSAGE" && event.type !== "AGENT_A_MESSAGE") continue;
        lines.push(
          JSON.stringify({
            sessionId,
            eventId: event.id,
            timestamp: event.timestamp,
            sceneId: event.payload.sceneId,
            speaker: event.type === "USER_MESSAGE" ? "user" : "agent_a",
            message: event.payload.message,
          }),
        );
      }
    }
    return new Response(`${lines.join("\n")}\n`, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": 'attachment; filename="transcript.jsonl"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

