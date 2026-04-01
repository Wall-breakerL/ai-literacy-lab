import type { SceneBlueprint } from "@/domain/scenes/types";
import { buildAgentAFallbackCopy } from "@/server/engine/agent-a-prompt";

export function buildAgentAMessage(input: {
  scene: SceneBlueprint;
  bridgeToNextScene?: boolean;
  sceneContextPrompt: string;
}): string {
  return buildAgentAFallbackCopy({
    scene: input.scene,
    bridgeToNextScene: input.bridgeToNextScene,
    sceneContextPrompt: input.sceneContextPrompt,
  });
}
