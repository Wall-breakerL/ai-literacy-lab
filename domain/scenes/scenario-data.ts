import { z } from "zod";
import { SceneIdSchema } from "@/domain/scenes/types";

/** Runtime status for scenario injection probes (server-side only). */
export const ScenarioProbeStatusSchema = z.enum(["pending", "triggered", "detected", "undetected"]);
export type ScenarioProbeStatus = z.infer<typeof ScenarioProbeStatusSchema>;

export const ScenarioProbeTypeSchema = z.enum(["omission", "distortion", "fabrication"]);
export type ScenarioProbeType = z.infer<typeof ScenarioProbeTypeSchema>;

export const ScenarioProbeTriggerSchema = z.object({
  minTurnCount: z.number().int().min(0),
  consecutiveAcceptanceTurns: z.number().int().min(1).optional(),
  highTrustSignals: z.array(z.string().min(1)).optional(),
});
export type ScenarioProbeTrigger = z.infer<typeof ScenarioProbeTriggerSchema>;

export const ScenarioProbePayloadSchema = z.object({
  fieldPath: z.string().min(1).optional(),
  falsifiedValue: z.unknown().optional(),
  omitDimension: z.string().min(1).optional(),
  fabricatedFact: z.string().min(1).optional(),
});
export type ScenarioProbePayload = z.infer<typeof ScenarioProbePayloadSchema>;

/** Probe definition for LLM scenario injection (not Agent B catalog probes). */
export const ScenarioProbeDefinitionSchema = z.object({
  id: z.string().min(1),
  type: ScenarioProbeTypeSchema,
  trigger: ScenarioProbeTriggerSchema,
  payload: ScenarioProbePayloadSchema,
  status: ScenarioProbeStatusSchema.default("pending"),
  triggeredAtTurn: z.number().int().min(0).optional(),
});
export type ScenarioProbeDefinition = z.infer<typeof ScenarioProbeDefinitionSchema>;

export const ScenarioHiddenInfoBlockSchema = z.object({
  triggerKeywords: z.array(z.string().min(1)),
  data: z.record(z.string(), z.unknown()),
});
export type ScenarioHiddenInfoBlock = z.infer<typeof ScenarioHiddenInfoBlockSchema>;

export const ScenarioDataLayerSchema = z.object({
  sceneId: SceneIdSchema,
  publicInfo: z.record(z.string(), z.unknown()),
  hiddenInfo: z.array(ScenarioHiddenInfoBlockSchema).default([]),
  probeOverrides: z.array(ScenarioProbeDefinitionSchema).default([]),
});
export type ScenarioDataLayer = z.infer<typeof ScenarioDataLayerSchema>;

/** Mutable runtime copy of a scenario probe (deep-cloned per session). */
export const ScenarioProbeRuntimeSchema = ScenarioProbeDefinitionSchema.extend({
  status: ScenarioProbeStatusSchema,
});
export type ScenarioProbeRuntime = z.infer<typeof ScenarioProbeRuntimeSchema>;
