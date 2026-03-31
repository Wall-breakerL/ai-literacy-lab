import { z } from "zod";
import { BRAND_NAMING_SPRINT_SCENE } from "@/domain/scenes/brand-naming-sprint";
import { APARTMENT_TRADEOFF_SCENE } from "@/domain/scenes/apartment-tradeoff";
import { SceneBlueprintSchema, SceneIdSchema } from "@/domain/scenes/types";

export const AssessmentFlowStateSchema = z.enum([
  "onboarding",
  "apartment",
  "bridge",
  "brand",
  "synthesis",
  "completed",
]);
export type AssessmentFlowState = z.infer<typeof AssessmentFlowStateSchema>;

export const AssessmentBlueprintSchema = z.object({
  id: z.literal("core-sequential-v1"),
  brandName: z.literal("Human-AI Performance Lab"),
  flowStates: z.array(AssessmentFlowStateSchema).length(6),
  sceneSequence: z.tuple([SceneIdSchema, SceneIdSchema]),
  scenes: z.array(SceneBlueprintSchema).length(2),
});
export type AssessmentBlueprint = z.infer<typeof AssessmentBlueprintSchema>;

export const CORE_ASSESSMENT_BLUEPRINT = AssessmentBlueprintSchema.parse({
  id: "core-sequential-v1",
  brandName: "Human-AI Performance Lab",
  flowStates: ["onboarding", "apartment", "bridge", "brand", "synthesis", "completed"],
  sceneSequence: ["apartment-tradeoff", "brand-naming-sprint"],
  scenes: [APARTMENT_TRADEOFF_SCENE, BRAND_NAMING_SPRINT_SCENE],
});

export const CORE_SEQUENTIAL_ASSESSMENT = CORE_ASSESSMENT_BLUEPRINT;

export const SCENE_REGISTRY = {
  "apartment-tradeoff": APARTMENT_TRADEOFF_SCENE,
  "brand-naming-sprint": BRAND_NAMING_SPRINT_SCENE,
} as const;

export const SCENE_BLUEPRINT_BY_ID = SCENE_REGISTRY;
