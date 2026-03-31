import { z } from "zod";
import { SceneBlueprintSchema, SceneIdSchema, FIXED_SCENES } from "@/domain/scenes/scene-blueprint";

export const AssessmentIdSchema = z.literal("core-sequential-v1");
export type AssessmentId = z.infer<typeof AssessmentIdSchema>;

export const AssessmentBlueprintSchema = z.object({
  id: AssessmentIdSchema,
  brandName: z.literal("Human-AI Performance Lab"),
  sceneSequence: z.tuple([SceneIdSchema, SceneIdSchema]),
  scenes: z.array(SceneBlueprintSchema).length(2),
});
export type AssessmentBlueprint = z.infer<typeof AssessmentBlueprintSchema>;

export const CORE_SEQUENTIAL_ASSESSMENT = AssessmentBlueprintSchema.parse({
  id: "core-sequential-v1",
  brandName: "Human-AI Performance Lab",
  sceneSequence: ["apartment-tradeoff", "brand-naming-sprint"],
  scenes: FIXED_SCENES,
});
