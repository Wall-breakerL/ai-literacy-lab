import { z } from "zod";
import { ProbeIdSchema, ProbeScoreDeltaSchema, RuleSignalSchema } from "@/domain/probes/types";
import { ScenePhaseSchema } from "@/domain/scenes/scene-phase";

/** One evidence-driven score patch for audit / aggregation. */
export const AgentBScoringEventSchema = z.object({
  source_type: z.enum(["ordinary_collaboration", "probe_response"]),
  evidence_excerpt: z.string().min(1),
  why_this_matters: z.string().min(1),
  score_delta: ProbeScoreDeltaSchema,
});
export type AgentBScoringEvent = z.infer<typeof AgentBScoringEventSchema>;

/** Structured output from Agent B (evaluation, invisible to end user). */
export const AgentBOutputSchema = z.object({
  user_intent_summary: z.string().min(1),
  /** 1–3 句中文，写入场景工作摘要供下一轮注入。 */
  working_summary_update: z.string().min(1),
  /** 粗粒度阶段建议（内部，不给用户看关卡）。 */
  phase_suggestion: ScenePhaseSchema,
  evidence_excerpts: z.array(
    z.object({
      text: z.string().min(1),
      source: z.enum(["user_message", "agent_a", "probe", "system"]),
    }),
  ),
  /** 可选；仅作回退辅助，不作为主触发依据。 */
  rule_signals: z.array(RuleSignalSchema).default([]),
  /** 证据驱动评分事件（优先于 score_deltas）。 */
  scoring_events: z.array(AgentBScoringEventSchema).default([]),
  /** 兼容旧字段；新引擎优先用 scoring_events。 */
  score_deltas: z.array(ProbeScoreDeltaSchema).default([]),
  risk_flags: z.array(z.string()).default([]),
  /** 至多一个待插入的观察探针；与 should_fire_probe 配合。 */
  should_fire_probe: z.boolean().default(false),
  recommended_probe_id: ProbeIdSchema.nullable().default(null),
  /** 给 Agent A 的自然语言隐藏目标（勿照抄模板给用户）。 */
  hidden_conversational_objective_zh: z.string().min(1).optional(),
  /** 兼容旧多探针推荐（弃用，保持空数组）。 */
  recommended_probe_ids: z.array(ProbeIdSchema).default([]),
  stage_completion_status: z.enum(["incomplete", "ready", "complete"]),
  next_stage_suggestion: z.string().nullable(),
  can_advance_stage: z.boolean(),
  confidence: z.number().min(0).max(1),
  /** 若用户正在回应已触发的探针实例，判断是否结案与计分。 */
  probe_resolution: z
    .object({
      probe_instance_id: z.string().nullable(),
      should_apply_score: z.boolean(),
      outcome: z.enum(["resolved", "unresolved"]).optional(),
      score_delta: ProbeScoreDeltaSchema.optional(),
      evidence_excerpt: z.string().optional(),
      reason: z.string().optional(),
    })
    .optional(),
});
export type AgentBOutput = z.infer<typeof AgentBOutputSchema>;
