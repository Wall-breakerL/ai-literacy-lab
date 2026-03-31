import { z } from "zod";
import { AssessmentBlueprintSchema } from "@/domain/assessment/registry";
import { FaaDimensionIdSchema } from "@/domain/faa/dimensions";
import { MbtiAxisIdSchema } from "@/domain/mbti/axes";
import { ProbeIdSchema } from "@/domain/probes/types";
import { SceneIdSchema } from "@/domain/scenes/types";

export const SessionEventTypeSchema = z.enum([
  "SESSION_CREATED",
  "ASSESSMENT_STARTED",
  "SCENE_ENTERED",
  "BRIEF_SHOWN",
  "USER_MESSAGE",
  "AGENT_A_MESSAGE",
  "PROBE_FIRED",
  "PROBE_SCORED",
  "EVALUATION_SCORE_APPLIED",
  "STAGE_CHANGED",
  "SCENE_COMPLETED",
  "ASSESSMENT_COMPLETED",
]);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

export const SessionIdSchema = z.string().min(1);
export type SessionId = z.infer<typeof SessionIdSchema>;

const EventMetaSchema = z.object({
  id: z.string().min(1),
  sessionId: SessionIdSchema,
  timestamp: z.string().datetime(),
});

const MbtiDeltaSchema = z.object({
  relation: z.number().min(-1).max(1).optional(),
  workflow: z.number().min(-1).max(1).optional(),
  epistemic: z.number().min(-1).max(1).optional(),
  repair: z.number().min(-1).max(1).optional(),
});

const FaaScorePatchSchema = z.object({
  SI: z.number().min(-1).max(1).optional(),
  RC: z.number().min(-1).max(1).optional(),
  LO: z.number().min(-1).max(1).optional(),
  SR: z.number().min(-1).max(1).optional(),
  CI: z.number().min(-1).max(1).optional(),
});

export const SessionCreatedEventSchema = EventMetaSchema.extend({
  type: z.literal("SESSION_CREATED"),
  payload: z.object({
    assessmentId: AssessmentBlueprintSchema.shape.id,
  }),
});

export const AssessmentStartedEventSchema = EventMetaSchema.extend({
  type: z.literal("ASSESSMENT_STARTED"),
  payload: z.object({
    assessmentId: AssessmentBlueprintSchema.shape.id,
  }),
});

export const SceneEnteredEventSchema = EventMetaSchema.extend({
  type: z.literal("SCENE_ENTERED"),
  payload: z.object({
    sceneId: SceneIdSchema,
    sceneIndex: z.number().int().min(0),
  }),
});

export const BriefShownEventSchema = EventMetaSchema.extend({
  type: z.literal("BRIEF_SHOWN"),
  payload: z.object({
    sceneId: SceneIdSchema,
    briefing: z.string(),
  }),
});

export const UserMessageEventSchema = EventMetaSchema.extend({
  type: z.literal("USER_MESSAGE"),
  payload: z.object({
    sceneId: SceneIdSchema,
    message: z.string().min(1),
  }),
});

export const AgentAMessageEventSchema = EventMetaSchema.extend({
  type: z.literal("AGENT_A_MESSAGE"),
  payload: z.object({
    sceneId: SceneIdSchema,
    message: z.string().min(1),
  }),
});

export const ProbeFiredEventSchema = EventMetaSchema.extend({
  type: z.literal("PROBE_FIRED"),
  payload: z.object({
    sceneId: SceneIdSchema,
    probeId: ProbeIdSchema,
    /** Stable id for probe lifecycle (fired → scored on resolution). */
    probeInstanceId: z.string().min(1),
    weight: z.enum(["high", "medium", "low"]),
    prompt: z.string().min(1),
  }),
});

export const ProbeScoredEventSchema = EventMetaSchema.extend({
  type: z.literal("PROBE_SCORED"),
  payload: z.object({
    sceneId: SceneIdSchema,
    probeId: ProbeIdSchema,
    probeInstanceId: z.string().min(1),
    mbtiDeltas: MbtiDeltaSchema,
    faaScores: FaaScorePatchSchema,
    evidenceExcerpt: z.string().min(1),
  }),
});

/** Non-probe scoring from Agent B (e.g. rule_signals aggregate). */
export const EvaluationScoreAppliedEventSchema = EventMetaSchema.extend({
  type: z.literal("EVALUATION_SCORE_APPLIED"),
  payload: z.object({
    sceneId: SceneIdSchema,
    mbtiDeltas: MbtiDeltaSchema,
    faaScores: FaaScorePatchSchema,
    reason: z.string().min(1),
  }),
});

export const StageChangedEventSchema = EventMetaSchema.extend({
  type: z.literal("STAGE_CHANGED"),
  payload: z.object({
    sceneId: SceneIdSchema,
    fromStage: z.string().min(1),
    toStage: z.string().min(1),
  }),
});

export const SceneCompletedEventSchema = EventMetaSchema.extend({
  type: z.literal("SCENE_COMPLETED"),
  payload: z.object({
    sceneId: SceneIdSchema,
    sceneIndex: z.number().int().min(0),
  }),
});

export const AssessmentCompletedEventSchema = EventMetaSchema.extend({
  type: z.literal("ASSESSMENT_COMPLETED"),
  payload: z.object({
    assessmentId: AssessmentBlueprintSchema.shape.id,
  }),
});

export const SessionEventSchema = z.discriminatedUnion("type", [
  SessionCreatedEventSchema,
  AssessmentStartedEventSchema,
  SceneEnteredEventSchema,
  BriefShownEventSchema,
  UserMessageEventSchema,
  AgentAMessageEventSchema,
  ProbeFiredEventSchema,
  ProbeScoredEventSchema,
  EvaluationScoreAppliedEventSchema,
  StageChangedEventSchema,
  SceneCompletedEventSchema,
  AssessmentCompletedEventSchema,
]);
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const EventEvidenceSourceSchema = z.enum(["user_message", "agent_a", "probe", "system"]);
export type EventEvidenceSource = z.infer<typeof EventEvidenceSourceSchema>;

export const MbtiAxisScorePatchSchema = z.record(MbtiAxisIdSchema, z.number().min(-1).max(1));
export const FaaDimensionScorePatchSchema = z.record(FaaDimensionIdSchema, z.number().min(0).max(1));
