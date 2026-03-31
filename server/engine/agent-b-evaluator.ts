import { AgentBOutputSchema, type AgentBOutput } from "@/domain/agent/agent-b-output";
import type { ProbeDefinition, ProbeId, RuleSignal } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import type { SessionEvent } from "@/domain/session/events";
import { mergeSignalOnlyDeltas } from "@/server/engine/agent-b-scorer";
import { selectTriggeredProbes } from "@/server/engine/probe-orchestrator";
import { extractRuleSignals } from "@/server/engine/rule-extractor";
import { resolveSceneStageTransition } from "@/server/engine/scene-transition";
import { getLlmEnvConfig } from "@/server/providers/llm-env";
import { getLlmProvider } from "@/server/providers/llm-provider";

function extractRuleSignalsFromMessage(msg: string): RuleSignal[] {
  return extractRuleSignals(msg);
}

function getOpenProbeInstances(events: SessionEvent[], sceneId: string): Array<{ probeInstanceId: string; probeId: string }> {
  const fired = new Map<string, { probeId: string }>();
  for (const e of events) {
    if (e.type === "PROBE_FIRED" && e.payload.sceneId === sceneId) {
      fired.set(e.payload.probeInstanceId, { probeId: e.payload.probeId });
    }
    if (e.type === "PROBE_SCORED" && e.payload.sceneId === sceneId) {
      fired.delete(e.payload.probeInstanceId);
    }
  }
  return [...fired.entries()].map(([probeInstanceId, v]) => ({ probeInstanceId, probeId: v.probeId }));
}

function buildAgentBPrompt(input: {
  scene: SceneBlueprint;
  stageId: string;
  userMessage: string;
  recentTranscript: string;
  deliverables: string[];
  openProbes: Array<{ probeInstanceId: string; probeId: string }>;
  probeCatalog: ProbeDefinition[];
}): string {
  const open = input.openProbes.length
    ? input.openProbes.map((p) => `- ${p.probeInstanceId} (${p.probeId})`).join("\n")
    : "(none)";
  return [
    "You are Agent B: an invisible evaluator. Output ONLY valid JSON matching the schema discussed in the system message.",
    "",
    `Scene: ${input.scene.titleZh}`,
    `Stage: ${input.stageId}`,
    `Deliverables: ${input.deliverables.join(" | ")}`,
    "",
    "Open probe instances awaiting user response:",
    open,
    "",
    "Recent dialogue (truncated):",
    input.recentTranscript.slice(-6000),
    "",
    "Latest user message:",
    input.userMessage,
    "",
    "Probe catalog (ids you may recommend):",
    input.probeCatalog.map((p) => `- ${p.id}: ${p.purpose}`).join("\n"),
  ].join("\n");
}

export async function evaluateAgentB(input: {
  scene: SceneBlueprint;
  stageId: string;
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
  const signals: RuleSignal[] = input.completionRequested ? [] : extractRuleSignalsFromMessage(input.normalizedUserMessage);

  const openProbes = getOpenProbeInstances(input.events, input.scene.id);
  const recentTranscript = input.events
    .filter((e) => e.type === "USER_MESSAGE" || e.type === "AGENT_A_MESSAGE")
    .slice(-12)
    .map((e) => {
      if (e.type === "USER_MESSAGE") return `User: ${e.payload.message}`;
      return `AgentA: ${e.payload.message}`;
    })
    .join("\n");

  if (input.llmEnabled && cfg.apiKey) {
    try {
      const provider = getLlmProvider();
      const system = [
        "You are Agent B (evaluator). Return a single JSON object with these keys:",
        "user_intent_summary (string),",
        "evidence_excerpts (array of {text, source in user_message|agent_a|probe|system}),",
        "rule_signals (array of known signal strings from the catalog in instructions),",
        "score_deltas (array of objects with mbti and faa numeric patches),",
        "risk_flags (string array),",
        "recommended_probe_ids (probe ids from catalog),",
        "stage_completion_status: incomplete|ready|complete,",
        "next_stage_suggestion (string or null),",
        "can_advance_stage (boolean),",
        "confidence (0-1 number),",
        "probe_resolution: optional { probe_instance_id, should_apply_score, score_delta {mbti,faa}, evidence_excerpt }.",
        "If open probes exist, decide if the latest user message addresses the challenge; if yes set should_apply_score true and fill score_delta.",
      ].join(" ");

      const user = buildAgentBPrompt({
        scene: input.scene,
        stageId: input.stageId,
        userMessage: input.userMessage,
        recentTranscript,
        deliverables: input.scene.deliverables,
        openProbes,
        probeCatalog: input.scene.probes,
      });

      const { rawText } = await provider.completeStructuredJson({
        model: cfg.modelAgentB,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const parsed = JSON.parse(rawText) as unknown;
      const safe = AgentBOutputSchema.safeParse(parsed);
      if (safe.success) return { output: safe.data, source: "llm" };
    } catch {
      // fall through
    }
  }

  const firedProbes = selectTriggeredProbes(
    input.scene.probes,
    {
      sessionId: input.sessionId,
      sceneId: input.scene.id,
      stageId: input.stageId,
      turnIndex: input.turnIndex,
      ruleSignals: signals,
      userMessage: input.normalizedUserMessage,
    },
    input.firedHighWeightProbeIds,
  );

  const signalDelta = mergeSignalOnlyDeltas(signals);
  let probeResolution: AgentBOutput["probe_resolution"];
  if (openProbes.length > 0) {
    const target = openProbes[0];
    const def = input.scene.probes.find((p) => p.id === target.probeId);
    const adequate = input.normalizedUserMessage.length > 24 && signals.length > 0;
    probeResolution = {
      probe_instance_id: target.probeInstanceId,
      should_apply_score: adequate,
      score_delta: adequate && def ? def.scoreDelta : undefined,
      evidence_excerpt: input.normalizedUserMessage.slice(0, 160),
    };
  }

  const transition = resolveSceneStageTransition({
    scene: input.scene,
    currentStageId: input.stageId,
    userMessage: input.normalizedUserMessage,
    signals,
    completionRequested: input.completionRequested,
  });

  const canAdvance =
    transition.nextStageId !== input.stageId &&
    (signals.length > 0 || input.normalizedUserMessage.length > 36 || input.completionRequested);

  const output = AgentBOutputSchema.parse({
    user_intent_summary: "（规则回退）基于关键词信号与阶段启发式给出的本地评估。",
    evidence_excerpts: [{ text: input.normalizedUserMessage.slice(0, 200), source: "user_message" }],
    rule_signals: signals,
    score_deltas: probeResolution?.should_apply_score ? [] : [signalDelta],
    risk_flags: [],
    recommended_probe_ids: firedProbes.map((p) => p.id),
    stage_completion_status: transition.sceneCompleted ? "complete" : canAdvance ? "ready" : "incomplete",
    next_stage_suggestion: transition.nextStageId,
    can_advance_stage: canAdvance || transition.sceneCompleted,
    confidence: 0.35,
    probe_resolution: probeResolution,
  });

  return { output, source: "fallback" };
}
