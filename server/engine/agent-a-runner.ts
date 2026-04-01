import type { SceneBlueprint } from "@/domain/scenes/types";
import { buildAgentAFallbackCopy } from "@/server/engine/agent-a-prompt";
import { composeAgentAResponse } from "@/server/engine/response-composer";

export function buildAgentAMessage(input: {
  scene: SceneBlueprint;
  bridgeToNextScene?: boolean;
  sceneContextPrompt: string;
}): string {
  const dc = input.scene.decisionContext;
  if (dc && !input.bridgeToNextScene) {
    const response = composeAgentAResponse({
      knownFacts: dc.knownInfo,
      openUnknowns: dc.mustVerifyQuestions,
      currentDraft: `先在 ${dc.optionCatalog[0]?.id ?? "A"} / ${dc.optionCatalog[1]?.id ?? "B"} 中形成主备建议`,
      nextMove: "先确认 1-2 个关键未知项，再收敛推荐",
    });
    return response.tailQuestion ? `${response.content}\n${response.tailQuestion}` : response.content;
  }
  return buildAgentAFallbackCopy({
    scene: input.scene,
    bridgeToNextScene: input.bridgeToNextScene,
    sceneContextPrompt: input.sceneContextPrompt,
  });
}
