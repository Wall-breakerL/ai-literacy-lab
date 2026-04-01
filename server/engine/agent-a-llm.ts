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
  const cfg = getLlmEnvConfig();
  const canUseLlm = Boolean(input.llmEnabled && cfg.apiKey);
  console.debug("[AgentA][LLM] runtime", {
    sceneId: input.scene.id,
    llmEnabledFlag: input.llmEnabled,
    cfgEnabled: cfg.enabled,
    hasApiKey: Boolean(cfg.apiKey),
    baseUrl: cfg.baseUrl,
    model: cfg.modelAgentA,
    timeoutMs: cfg.timeoutMs,
    canUseLlm,
  });

  if (input.bridgeToNextScene) {
    console.debug("[AgentA][LLM] fallback reason=bridge_to_next_scene");
    return buildAgentAMessage({
      scene: input.scene,
      bridgeToNextScene: true,
      sceneContextPrompt: input.sceneContextPrompt,
    });
  }

  if (canUseLlm) {
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
    } catch (error) {
      console.debug("[AgentA][LLM] fallback reason=provider_error", {
        message: error instanceof Error ? error.message : String(error),
        timeoutMs: cfg.timeoutMs,
      });
    }
  } else {
    console.debug("[AgentA][LLM] fallback reason=disabled_or_missing_key", {
      llmEnabledFlag: input.llmEnabled,
      cfgEnabled: cfg.enabled,
      hasApiKey: Boolean(cfg.apiKey),
    });
  }

  console.debug("[AgentA][LLM] using local fallback message builder");
  return buildAgentAMessage({
    scene: input.scene,
    bridgeToNextScene: input.bridgeToNextScene,
    sceneContextPrompt: input.sceneContextPrompt,
  });
}
