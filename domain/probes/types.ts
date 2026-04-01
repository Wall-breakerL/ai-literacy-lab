import { z } from "zod";

const ProbeSceneIdSchema = z.enum(["apartment-tradeoff", "brand-naming-sprint"]);

export const RuleSignalSchema = z.enum([
  "direct_delegate",
  "criteria_first",
  "ask_matrix",
  "spot_hidden_blocker",
  "flag_hidden_violation",
  "global_reset",
  "local_patch",
  "restate_brief",
  "request_unknowns",
  "conservative_assumption",
  "compare_before_decide",
  "pick_by_vibe",
  "style_drift",
  "role_contract",
  "brief_conflict_check",
]);
export type RuleSignal = z.infer<typeof RuleSignalSchema>;

export const EvidenceSnippetSchema = z.object({
  text: z.string().min(1),
  source: z.enum(["user_message", "agent_a", "probe", "system"]),
});
export type EvidenceSnippet = z.infer<typeof EvidenceSnippetSchema>;

export const ProbeScoreDeltaSchema = z.object({
  mbti: z.object({
    relation: z.number().min(-1).max(1).optional(),
    workflow: z.number().min(-1).max(1).optional(),
    epistemic: z.number().min(-1).max(1).optional(),
    repair: z.number().min(-1).max(1).optional(),
  }),
  faa: z.object({
    SI: z.number().min(-1).max(1).optional(),
    RC: z.number().min(-1).max(1).optional(),
    LO: z.number().min(-1).max(1).optional(),
    SR: z.number().min(-1).max(1).optional(),
    CI: z.number().min(-1).max(1).optional(),
  }),
});
export type ProbeScoreDelta = z.infer<typeof ProbeScoreDeltaSchema>;

export const ProbeTriggerContextSchema = z.object({
  sessionId: z.string().min(1),
  sceneId: ProbeSceneIdSchema,
  stageId: z.string().min(1),
  turnIndex: z.number().int().min(0),
  ruleSignals: z.array(RuleSignalSchema),
  userMessage: z.string().min(1),
});
export type ProbeTriggerContext = z.infer<typeof ProbeTriggerContextSchema>;

export const ProbeIdSchema = z.enum([
  "apartment-tradeoff-probe-01",
  "apartment-tradeoff-probe-02",
  "apartment-tradeoff-probe-03",
  "apartment-tradeoff-probe-04",
  "apartment-tradeoff-probe-05",
  "brand-naming-probe-01",
  "brand-naming-probe-02",
  "brand-naming-probe-03",
  "brand-naming-probe-04",
  "brand-naming-probe-05",
  "brand-naming-probe-06",
  "brand-naming-probe-07",
]);
export type ProbeId = z.infer<typeof ProbeIdSchema>;

export const ProbeDefinitionSchema = z.object({
  id: ProbeIdSchema,
  sceneId: ProbeSceneIdSchema,
  label: z.string().min(1),
  weight: z.enum(["high", "medium", "low"]),
  purpose: z.string().min(1),
  /** Evaluator / orchestrator internal line (not shown verbatim to user). */
  injectMessageTemplate: z.string().min(1),
  /**
   * Hidden conversational objective for Agent A this turn: natural guidance,
   * no meta words like probe/评分/系统.
   */
  probeIntentZh: z.string().min(1),
  tailType: z.enum(["priority", "comparison", "uncertainty", "repair"]).default("comparison"),
  triggerOnSignalsAny: z.array(RuleSignalSchema).default([]),
  triggerStageIds: z.array(z.string().min(1)).default([]),
  scoreDelta: ProbeScoreDeltaSchema,
});
export type ProbeDefinition = z.infer<typeof ProbeDefinitionSchema>;
export type TailType = z.infer<typeof ProbeDefinitionSchema.shape.tailType>;
