import { z } from "zod";
import { AssessmentFlowStateSchema, AssessmentBlueprintSchema } from "@/domain/assessment/registry";
import { FaaDimensionIdSchema } from "@/domain/faa/dimensions";
import { MbtiAxisIdSchema } from "@/domain/mbti/axes";
import { ProbeIdSchema, ProbeScoreDeltaSchema, RuleSignalSchema } from "@/domain/probes/types";
import { SceneIdSchema } from "@/domain/scenes/types";

export const SceneRunStateSchema = z.object({
  sceneId: SceneIdSchema,
  stageId: z.string().min(1),
  completed: z.boolean(),
  turnCount: z.number().int().min(0),
  firedHighWeightProbeIds: z.array(ProbeIdSchema),
});
export type SceneRunState = z.infer<typeof SceneRunStateSchema>;

export const SessionStateSchema = z.object({
  sessionId: z.string().min(1),
  assessmentId: AssessmentBlueprintSchema.shape.id,
  assessmentState: AssessmentFlowStateSchema,
  currentSceneId: SceneIdSchema,
  sceneStates: z.array(SceneRunStateSchema).length(2),
  mbti: z.record(MbtiAxisIdSchema, z.number().min(-1).max(1)),
  faa: z.record(FaaDimensionIdSchema, z.number().min(0).max(1)),
  eventCount: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export const TurnInputSchema = z.object({
  sessionId: z.string().min(1),
  userMessage: z.string().min(1),
});
export type TurnInput = z.infer<typeof TurnInputSchema>;

export const TurnOutputSchema = z.object({
  agentAMessage: z.string().min(1),
  currentSceneId: SceneIdSchema,
  currentStage: z.string().min(1),
  assessmentProgress: AssessmentFlowStateSchema,
  firedProbeIds: z.array(ProbeIdSchema),
  ruleSignals: z.array(RuleSignalSchema),
  probeDeltas: z.array(ProbeScoreDeltaSchema),
  updatedSessionSnapshot: SessionStateSchema,
});
export type TurnOutput = z.infer<typeof TurnOutputSchema>;
