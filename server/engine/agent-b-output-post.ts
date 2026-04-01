import { AgentBOutputSchema, type AgentBOutput } from "@/domain/agent/agent-b-output";
import { AgentBScoringEventSchema } from "@/domain/agent/agent-b-output";
import type { SceneBlueprint } from "@/domain/scenes/types";
import { ProbeScoreDeltaSchema } from "@/domain/probes/types";

/** Normalize raw LLM JSON into AgentBOutput shape (incl. score_deltas → scoring_events). */
export function normalizeLlmAgentBOutput(raw: unknown, scene: SceneBlueprint): AgentBOutput | null {
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

/** At most one open probe: suppress new fires when one is active; fill hidden objective from catalog when missing. */
export function clampSingleProbe(output: AgentBOutput, hasOpenProbe: boolean, scene: SceneBlueprint): AgentBOutput {
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

export function parseValidScoringEvents(output: AgentBOutput): AgentBOutput {
  const eventsClean = output.scoring_events
    .map((e) => AgentBScoringEventSchema.safeParse(e))
    .filter((r): r is { success: true; data: (typeof output.scoring_events)[0] } => r.success)
    .map((r) => r.data);
  return { ...output, scoring_events: eventsClean };
}
