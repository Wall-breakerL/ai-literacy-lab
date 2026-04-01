import type { SceneBlueprint } from "@/domain/scenes/types";
import { buildAgentAMessage } from "@/server/engine/agent-a-runner";
import {
  buildAgentASystemPrompt,
  buildAgentAUserPrompt,
} from "@/server/engine/agent-a-prompt";
import { getLlmEnvConfig } from "@/server/providers/llm-env";
import { getLlmProvider } from "@/server/providers/llm-provider";

export async function generateAgentAReply(input: {
  scene: SceneBlueprint;
  bridgeToNextScene?: boolean;
  sceneContextPrompt: string;
  scenarioDataForLLM: Record<string, unknown> | null;
  userMessagePreview: string;
  agentBIntentSummary: string;
  llmEnabled: boolean;
}): Promise<string> {
  if (input.bridgeToNextScene) {
    return buildAgentAMessage({
      scene: input.scene,
      bridgeToNextScene: true,
      sceneContextPrompt: input.sceneContextPrompt,
    });
  }

  const cfg = getLlmEnvConfig();
  if (input.llmEnabled && cfg.apiKey) {
    try {
      const provider = getLlmProvider();
      const system = buildAgentASystemPrompt();
      const user = buildAgentAUserPrompt({
        sceneContextPrompt: input.sceneContextPrompt,
        scenarioDataForLLM: input.scenarioDataForLLM,
        userMessagePreview: input.userMessagePreview,
        agentBIntentSummary: input.agentBIntentSummary,
      });

      return await provider.completeText({
        model: cfg.modelAgentA,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
    } catch {
      // fallback below
    }
  }

  return buildAgentAMessage({
    scene: input.scene,
    bridgeToNextScene: input.bridgeToNextScene,
    sceneContextPrompt: input.sceneContextPrompt,
  });
}
