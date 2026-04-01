import { z } from "zod";
import { ProbeIdSchema, ProbeScoreDeltaSchema, RuleSignalSchema } from "@/domain/probes/types";
import { SceneIdSchema } from "@/domain/scenes/types";

export const ScoreObservationSchema = z.object({
  observationId: z.string().min(1),
  sessionId: z.string().min(1),
  sceneId: SceneIdSchema,
  probeId: ProbeIdSchema.nullable(),
  userTurnId: z.number().int().min(0),
  signalIds: z.array(RuleSignalSchema),
  evidenceText: z.string().min(1),
  mbtiDelta: ProbeScoreDeltaSchema.shape.mbti,
  faaDelta: ProbeScoreDeltaSchema.shape.faa,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  source: z.enum(["probe", "spontaneous"]),
  decayMultiplier: z.number().min(0).max(1).default(1),
});
export type ScoreObservation = z.infer<typeof ScoreObservationSchema>;

