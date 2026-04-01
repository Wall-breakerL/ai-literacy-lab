import type { AgentBOutput } from "@/domain/agent/agent-b-output";
import type { SceneBlueprint } from "@/domain/scenes/types";
import { getLlmEnvConfig } from "@/server/providers/llm-env";
import { getLlmProvider } from "@/server/providers/llm-provider";
import { clampSingleProbe, normalizeLlmAgentBOutput, parseValidScoringEvents } from "@/server/engine/agent-b-output-post";

function buildAgentBUserPrompt(input: {
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

const AGENT_B_SYSTEM_PROMPT = [
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

export type AgentBLLMPathInput = {
  scene: SceneBlueprint;
  stageId: string;
  sceneContextPrompt: string;
  userMessage: string;
  recentTranscript: string;
  openProbes: Array<{ probeInstanceId: string; probeId: string }>;
  hasOpenProbe: boolean;
};

/**
 * Primary path: structured JSON from LLM. Returns null on failure so caller can use deterministic fallback.
 */
export async function tryEvaluateAgentBWithLlm(input: AgentBLLMPathInput): Promise<AgentBOutput | null> {
  const cfg = getLlmEnvConfig();
  if (!cfg.apiKey) return null;

  try {
    const provider = getLlmProvider();
    const user = buildAgentBUserPrompt({
      scene: input.scene,
      stageId: input.stageId,
      sceneContextPrompt: input.sceneContextPrompt,
      userMessage: input.userMessage,
      recentTranscript: input.recentTranscript,
      openProbes: input.openProbes,
      probeCatalog: input.scene.probes.map((p) => ({
        id: p.id,
        purpose: p.purpose,
        probeIntentZh: p.probeIntentZh,
      })),
    });

    const { rawText } = await provider.completeStructuredJson({
      model: cfg.modelAgentB,
      messages: [
        { role: "system", content: AGENT_B_SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    });

    const parsedJson = JSON.parse(rawText) as unknown;
    const normalized = normalizeLlmAgentBOutput(parsedJson, input.scene);
    if (!normalized) return null;

    const coerced = clampSingleProbe(normalized, input.hasOpenProbe, input.scene);
    return parseValidScoringEvents(coerced);
  } catch {
    return null;
  }
}
