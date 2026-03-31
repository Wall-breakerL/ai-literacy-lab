import { z } from "zod";
import { SessionIdSchema } from "@/domain/session/events";
import { SceneIdSchema } from "@/domain/scenes/types";

export const ResearchTagSchema = z.enum([
  "criteria_first",
  "hidden_blocker_spotted",
  "brief_consistency_check",
  "global_reset",
  "local_patch",
  "synthesize_fragments",
]);
export type ResearchTag = z.infer<typeof ResearchTagSchema>;

export const TurnAnnotationSchema = z.object({
  id: z.string().min(1),
  sessionId: SessionIdSchema,
  turnEventId: z.string().min(1),
  sceneId: SceneIdSchema,
  tagger: z.string().min(1).default("researcher"),
  labels: z.array(ResearchTagSchema).min(1),
  note: z.string().default(""),
  updatedAt: z.string().datetime(),
});
export type TurnAnnotation = z.infer<typeof TurnAnnotationSchema>;

export const AnnotationUpsertRequestSchema = z.object({
  sessionId: SessionIdSchema,
  turnEventId: z.string().min(1),
  sceneId: SceneIdSchema,
  tagger: z.string().min(1).default("researcher"),
  labels: z.array(ResearchTagSchema).min(1),
  note: z.string().default(""),
});
export type AnnotationUpsertRequest = z.infer<typeof AnnotationUpsertRequestSchema>;

export const AnnotationQuerySchema = z.object({
  sessionId: SessionIdSchema.optional(),
  turnEventId: z.string().min(1).optional(),
});
export type AnnotationQuery = z.infer<typeof AnnotationQuerySchema>;

