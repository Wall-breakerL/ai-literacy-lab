import { z } from "zod";
import { AssessmentIdSchema } from "@/domain/assessment/blueprint";
import { FaaProfileSchema } from "@/domain/faa/dimensions";
import { MbtiProfileSchema } from "@/domain/mbti/axes";
import { SceneIdSchema, SceneStageSchema } from "@/domain/scenes/scene-blueprint";
import { SessionEventSchema, SessionIdSchema } from "@/domain/session/events";

export const SceneProgressStatusSchema = z.enum(["pending", "active", "completed"]);
export type SceneProgressStatus = z.infer<typeof SceneProgressStatusSchema>;

export const SceneProgressSchema = z.object({
  sceneId: SceneIdSchema,
  sceneIndex: z.number().int().min(0),
  status: SceneProgressStatusSchema,
  stage: SceneStageSchema,
  briefing: z.string().optional(),
  lastUserMessage: z.string().optional(),
});
export type SceneProgress = z.infer<typeof SceneProgressSchema>;

export const AssessmentProgressSchema = z.object({
  assessmentId: AssessmentIdSchema,
  sceneOrder: z.array(SceneIdSchema).length(2),
  currentSceneIndex: z.number().int().min(0).max(1),
  scenes: z.array(SceneProgressSchema).length(2),
  isCompleted: z.boolean(),
  resultUnlocked: z.boolean(),
});
export type AssessmentProgress = z.infer<typeof AssessmentProgressSchema>;

export const SessionSnapshotSchema = z.object({
  sessionId: SessionIdSchema,
  assessmentId: AssessmentIdSchema,
  progress: AssessmentProgressSchema,
  mbti: MbtiProfileSchema,
  faa: FaaProfileSchema,
  eventCount: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

export const SessionReplaySchema = z.object({
  sessionId: SessionIdSchema,
  snapshot: SessionSnapshotSchema,
  events: z.array(SessionEventSchema),
});
export type SessionReplay = z.infer<typeof SessionReplaySchema>;
