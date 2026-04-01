import { AgentBOutputSchema, type AgentBOutput } from "@/domain/agent/agent-b-output";
import { AgentBScoringEventSchema } from "@/domain/agent/agent-b-output";
import type { ProbeId, RuleSignal } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import type { SessionEvent } from "@/domain/session/events";
import { buildFallbackAgentBOutput } from "@/server/engine/probe-behavior-fallback";
import { extractRuleSignals } from "@/server/engine/rule-extractor";
import { getLlmEnvConfig } from "@/server/providers/llm-env";
import { getLlmProvider } from "@/server/providers/llm-provider";
import { ProbeScoreDeltaSchema } from "@/domain/probes/types";

function getOpenProbeInstances(events: SessionEvent[], sceneId: string): Array<{ probeInstanceId: string; probeId: ProbeId }> {
  const fired = new Map<string, { probeId: ProbeId }>();
  for (const e of events) {
    if (e.type === "PROBE_FIRED" && e.payload.sceneId === sceneId) {
      fired.set(e.payload.probeInstanceId, { probeId: e.payload.probeId });
    }
    if (e.type === "PROBE_CLOSED" && e.payload.sceneId === sceneId) {
      fired.delete(e.payload.probeInstanceId);
    }
  }
  return [...fired.entries()].map(([probeInstanceId, v]) => ({ probeInstanceId, probeId: v.probeId }));
}

function buildAgentBPrompt(input: {
  scene: SceneBlueprint;
  stageId: string;
  sceneContextPrompt: string;
  userMessage: string;
  recentTranscript: string;
  openProbes: Array<{ probeInstanceId: string; probeId: string }>;
  probeCatalog: { id: string; purpose: string; probeIntentZh: string }[];
}): string {
  const open = input.openProbes.length
    ? input.openProbes.map((p) => `- instance ${p.probeInstanceId} probe ${p.probeId}`).join("\n")
    : "(none — at most one open probe allowed)";
  return [
    "You are Agent B: an invisible evaluator. Output ONLY valid JSON matching the system schema.",
    "",
    "--- Scene context packet (full; use for judgments) ---",
    input.sceneContextPrompt,
    "--- End scene context ---",
    "",
    `Legacy internal stage id: ${input.stageId}`,
    "",
    "Open probe instances (user is expected to respond naturally; do not mention probes to the user):",
    open,
    "",
    "Recent dialogue (truncated):",
    input.recentTranscript.slice(-6000),
    "",
    "Latest user message:",
    input.userMessage,
    "",
    "Probe catalog (choose at most ONE to recommend per turn when should_fire_probe is true):",
    input.probeCatalog.map((p) => `- ${p.id}: ${p.purpose} | hidden intent for Agent A: ${p.probeIntentZh}`).join("\n"),
    "",
    "Rules:",
    "- Prefer evidence-driven scoring_events over empty scoring.",
    "- Each scoring_event must include evidence_excerpt (short quote or paraphrase tied to user text) and why_this_matters.",
    "- should_fire_probe true ONLY if open list is empty and user behavior warrants a hidden challenge (early closure, single metric, ignoring must-verify items, etc.).",
    "- If open probe exists: set should_fire_probe false; fill probe_resolution about whether the user adequately responded.",
    "- When should_fire_probe true: set recommended_probe_id and hidden_conversational_objective_zh (natural Chinese, colleague tone, NOT a system alert).",
    "- Do NOT reward merely because a probe fired; reward quality of user collaboration and probe responses.",
    "- working_summary_update: 1-3 short Chinese sentences capturing what the user has committed to so far.",
    "- phase_suggestion: orient | work | wrap (internal coarse phase).",
  ].join("\n");
}

function normalizeLlmAgentBOutput(raw: unknown, scene: SceneBlueprint): AgentBOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const scoring_events: unknown[] = [];
  if (Array.isArray(o.scoring_events) && o.scoring_events.length > 0) {
    scoring_events.push(...o.scoring_events);
  } else if (Array.isArray(o.score_deltas) && o.score_deltas.length > 0) {
    for (const d of o.score_deltas) {
      const delta = ProbeScoreDeltaSchema.safeParse(d);
      if (delta.success) {
        scoring_events.push({
          source_type: "ordinary_collaboration",
          evidence_excerpt: typeof o.user_intent_summary === "string" ? o.user_intent_summary.slice(0, 200) : "（无摘录）",
          why_this_matters: "模型返回了 score_deltas（兼容字段），已转为证据评分事件。",
          score_delta: delta.data,
        });
      }
    }
  }

  const merged = {
    ...o,
    user_intent_summary:
      typeof o.user_intent_summary === "string" && o.user_intent_summary.trim().length > 0
        ? o.user_intent_summary
        : "（模型未提供意图摘要）",
    scoring_events,
    score_deltas: [],
    rule_signals: Array.isArray(o.rule_signals) ? o.rule_signals : [],
    risk_flags: Array.isArray(o.risk_flags) ? o.risk_flags : [],
    recommended_probe_ids: [],
    working_summary_update:
      typeof o.working_summary_update === "string" && o.working_summary_update.trim().length > 0
        ? o.working_summary_update
        : typeof o.user_intent_summary === "string"
          ? o.user_intent_summary.slice(0, 400)
          : "（无摘要）",
    phase_suggestion: typeof o.phase_suggestion === "string" ? o.phase_suggestion : "work",
    should_fire_probe: Boolean(o.should_fire_probe),
    recommended_probe_id: typeof o.recommended_probe_id === "string" ? o.recommended_probe_id : null,
  };

  const parsed = AgentBOutputSchema.safeParse(merged);
  if (!parsed.success) return null;

  let out = parsed.data;
  const validIds = new Set(scene.probes.map((p) => p.id));

  if (out.should_fire_probe && out.recommended_probe_id && !validIds.has(out.recommended_probe_id)) {
    out = { ...out, should_fire_probe: false, recommended_probe_id: null };
  }

  return out;
}

function clampSingleProbe(output: AgentBOutput, hasOpenProbe: boolean, scene: SceneBlueprint): AgentBOutput {
  const validIds = new Set(scene.probes.map((p) => p.id));
  if (hasOpenProbe) {
    return {
      ...output,
      should_fire_probe: false,
      recommended_probe_id: null,
      hidden_conversational_objective_zh: undefined,
    };
  }
  if (!output.should_fire_probe || !output.recommended_probe_id || !validIds.has(output.recommended_probe_id)) {
    return { ...output, should_fire_probe: false, recommended_probe_id: null, hidden_conversational_objective_zh: undefined };
  }
  const def = scene.probes.find((p) => p.id === output.recommended_probe_id);
  return {
    ...output,
    hidden_conversational_objective_zh:
      output.hidden_conversational_objective_zh?.trim() || def?.probeIntentZh || output.hidden_conversational_objective_zh,
  };
}

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
        "You are Agent B (evaluator). Return a single JSON object with EXACTLY these keys:",
        "user_intent_summary (string),",
        "working_summary_update (string Chinese),",
        "phase_suggestion (orient|work|wrap),",
        "evidence_excerpts (array of {text, source}),",
        "rule_signals (string[]),",
        "scoring_events (array of {source_type: ordinary_collaboration|probe_response, evidence_excerpt, why_this_matters, score_delta:{mbti:{...}, faa:{...}}}),",
        "risk_flags (string[]),",
        "should_fire_probe (boolean),",
        "recommended_probe_id (probe id or null),",
        "hidden_conversational_objective_zh (string, optional),",
        "stage_completion_status (incomplete|ready|complete),",
        "next_stage_suggestion (string|null),",
        "can_advance_stage (boolean),",
        "confidence (0-1),",
        "probe_resolution optional { probe_instance_id, should_apply_score, outcome resolved|unresolved, score_delta, evidence_excerpt, reason }.",
        "If an open probe exists, focus probe_resolution; set should_fire_probe false.",
        "Never include score_deltas top-level key; use scoring_events.",
      ].join(" ");

      const user = buildAgentBPrompt({
        scene: input.scene,
        stageId: input.stageId,
        sceneContextPrompt: input.sceneContextPrompt,
        userMessage: input.userMessage,
        recentTranscript,
        openProbes,
        probeCatalog: input.scene.probes.map((p) => ({
          id: p.id,
          purpose: p.purpose,
          probeIntentZh: p.probeIntentZh,
        })),
      });

      const { rawText } = await provider.completeStructuredJson({
        model: cfg.modelAgentB,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const parsedJson = JSON.parse(rawText) as unknown;
      const normalized = normalizeLlmAgentBOutput(parsedJson, input.scene);
      if (normalized) {
        const coerced = clampSingleProbe(normalized, hasOpenProbe, input.scene);
        /** Validate scoring event shapes */
        const eventsClean = coerced.scoring_events
          .map((e) => AgentBScoringEventSchema.safeParse(e))
          .filter((r): r is { success: true; data: (typeof coerced.scoring_events)[0] } => r.success)
          .map((r) => r.data);
        return { output: { ...coerced, scoring_events: eventsClean }, source: "llm" };
      }
    } catch {
      // fall through
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
