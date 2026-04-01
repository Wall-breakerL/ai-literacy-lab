import type { SessionEvent } from "@/domain/session/events";
import type { SceneId } from "@/domain/scenes/types";
import type { ChatTurn } from "@/server/engine/probe-injector";

/**
 * Build ordered user/assistant turns for a single scene (for probe timing / injection).
 */
export function buildChatTurnsForScene(events: SessionEvent[], sceneId: SceneId): ChatTurn[] {
  const out: ChatTurn[] = [];
  let inScene = false;
  for (const e of events) {
    if (e.type === "SCENE_ENTERED") {
      inScene = e.payload.sceneId === sceneId;
    }
    if (e.type === "SCENE_COMPLETED" && e.payload.sceneId === sceneId) {
      inScene = false;
    }
    if (!inScene) continue;
    if (e.type === "USER_MESSAGE" && e.payload.sceneId === sceneId) {
      out.push({ role: "user", content: e.payload.message });
    }
    if (e.type === "AGENT_A_MESSAGE" && e.payload.sceneId === sceneId) {
      out.push({ role: "assistant", content: e.payload.message });
    }
  }
  return out;
}
