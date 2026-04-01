import type { ProbeId, RuleSignal } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import type { SessionEvent } from "@/domain/session/events";
import type { AgentBOutput } from "@/domain/agent/agent-b-output";
import { tryEvaluateAgentBWithLlm } from "@/server/engine/agent-b-llm-path";
import { clampSingleProbe } from "@/server/engine/agent-b-output-post";
import { getOpenProbeInstances } from "@/server/engine/agent-b-probe-context";
import { buildFallbackAgentBOutput } from "@/server/engine/probe-behavior-fallback";
import { extractRuleSignals } from "@/server/engine/rule-extractor";
import { getLlmEnvConfig } from "@/server/providers/llm-env";

function buildRecentTranscript(events: SessionEvent[]): string {
  return events
    .filter((e) => e.type === "USER_MESSAGE" || e.type === "AGENT_A_MESSAGE")
    .slice(-12)
    .map((e) => {
      if (e.type === "USER_MESSAGE") return `User: ${e.payload.message}`;
      return `AgentA: ${e.payload.message}`;
    })
    .join("\n");
}

/**
 * Agent B: invisible evaluator. Orchestrates LLM path then deterministic fallback.
 */
export async function evaluateAgentB(input: {
  scene: SceneBlueprint;
  stageId: string;
  sceneContextPrompt: string;
  userMessage: string;
  normalizedUserMessage: string;
  events: SessionEvent[];
  sessionId: string;
  turnIndex: number;
  firedHighWeightProbeIds: ProbeId[];
  completionRequested: boolean;
  llmEnabled: boolean;
}): Promise<{ output: AgentBOutput; source: "llm" | "fallback" }> {
  const cfg = getLlmEnvConfig();
  const signals: RuleSignal[] = input.completionRequested ? [] : extractRuleSignals(input.normalizedUserMessage);

  const openProbes = getOpenProbeInstances(input.events, input.scene.id);
  const hasOpenProbe = openProbes.length > 0;
  const firstOpen = hasOpenProbe ? openProbes[0]! : null;

  const recentTranscript = buildRecentTranscript(input.events);

  if (input.llmEnabled && cfg.apiKey) {
    const llmOut = await tryEvaluateAgentBWithLlm({
      scene: input.scene,
      stageId: input.stageId,
      sceneContextPrompt: input.sceneContextPrompt,
      userMessage: input.userMessage,
      recentTranscript,
      openProbes,
      hasOpenProbe,
    });
    if (llmOut) {
      return { output: llmOut, source: "llm" };
    }
  }

  const fb = buildFallbackAgentBOutput({
    scene: input.scene,
    stageId: input.stageId,
    normalizedUserMessage: input.normalizedUserMessage,
    signals,
    completionRequested: input.completionRequested,
    openProbeInstanceId: firstOpen?.probeInstanceId ?? null,
    openProbeId: firstOpen?.probeId ?? null,
    firedHighWeightProbeIds: input.firedHighWeightProbeIds,
  });
  return { output: clampSingleProbe(fb, hasOpenProbe, input.scene), source: "fallback" };
}
