import { z } from "zod";
import { ProbeIdSchema, ProbeScoreDeltaSchema, RuleSignalSchema } from "@/domain/probes/types";

/** Structured output from Agent B (evaluation, invisible to end user). */
export const AgentBOutputSchema = z.object({
  user_intent_summary: z.string().min(1),
  evidence_excerpts: z.array(
    z.object({
      text: z.string().min(1),
      source: z.enum(["user_message", "agent_a", "probe", "system"]),
    }),
  ),
  rule_signals: z.array(RuleSignalSchema),
  score_deltas: z.array(ProbeScoreDeltaSchema),
  risk_flags: z.array(z.string()),
  recommended_probe_ids: z.array(ProbeIdSchema),
  stage_completion_status: z.enum(["incomplete", "ready", "complete"]),
  next_stage_suggestion: z.string().nullable(),
  can_advance_stage: z.boolean(),
  confidence: z.number().min(0).max(1),
  /** If user is responding to an open probe instance, score when resolved. */
  probe_resolution: z
    .object({
      probe_instance_id: z.string().nullable(),
      should_apply_score: z.boolean(),
      score_delta: ProbeScoreDeltaSchema.optional(),
      evidence_excerpt: z.string().optional(),
    })
    .optional(),
});
export type AgentBOutput = z.infer<typeof AgentBOutputSchema>;
