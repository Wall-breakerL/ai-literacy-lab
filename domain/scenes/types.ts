import { z } from "zod";
import { ProbeDefinitionSchema } from "@/domain/probes/types";
import { DecisionContextSchema } from "@/domain/scenes/decision-context";

export const SceneIdSchema = z.enum(["apartment-tradeoff", "brand-naming-sprint"]);
export type SceneId = z.infer<typeof SceneIdSchema>;

export const StageDefinitionSchema = z.object({
  id: z.string().min(1),
  titleZh: z.string().min(1),
  doneWhenSignalsAny: z.array(z.string().min(1)).default([]),
});
export type StageDefinition = z.infer<typeof StageDefinitionSchema>;

export const SceneBlueprintSchema = z.object({
  id: SceneIdSchema,
  titleEn: z.string().min(1),
  titleZh: z.string().min(1),
  briefingZh: z.string().min(1),
  internalFacts: z.array(z.string().min(1)).min(1),
  /** Optional structured listings + known vs to-verify (e.g. apartment trade-off). */
  decisionContext: DecisionContextSchema.optional(),
  stages: z.array(StageDefinitionSchema).min(1),
  deliverables: z.array(z.string().min(1)).min(1),
  probes: z.array(ProbeDefinitionSchema).min(1),
});
export type SceneBlueprint = z.infer<typeof SceneBlueprintSchema>;
