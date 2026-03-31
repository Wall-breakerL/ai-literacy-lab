import { z } from "zod";
import { EvidenceRefSchema } from "@/domain/mbti/axes";

export const FaaDimensionIdSchema = z.enum(["SI", "RC", "LO", "SR", "CI"]);
export type FaaDimensionId = z.infer<typeof FaaDimensionIdSchema>;

export const FaaDimensionDefinitionSchema = z.object({
  id: FaaDimensionIdSchema,
  labelEn: z.string(),
  labelZh: z.string(),
});
export type FaaDimensionDefinition = z.infer<typeof FaaDimensionDefinitionSchema>;

export const FaaDimensionScoreSchema = z.number().min(0).max(1);
export type FaaDimensionScore = z.infer<typeof FaaDimensionScoreSchema>;

export const FaaDimensionStateSchema = z.object({
  id: FaaDimensionIdSchema,
  score: FaaDimensionScoreSchema,
  evidence: z.array(EvidenceRefSchema),
});
export type FaaDimensionState = z.infer<typeof FaaDimensionStateSchema>;

export const FaaProfileSchema = z.object({
  dimensions: z.array(FaaDimensionStateSchema).length(5),
  overall: FaaDimensionScoreSchema,
  pilotMethod: z.literal("equal_weight_average"),
});
export type FaaProfile = z.infer<typeof FaaProfileSchema>;

export const FAA_DIMENSION_DEFINITIONS: readonly FaaDimensionDefinition[] = [
  { id: "SI", labelEn: "Sensemaking Initiative", labelZh: "问题理解主动性" },
  { id: "RC", labelEn: "Resilience to Conflict", labelZh: "冲突应对韧性" },
  { id: "LO", labelEn: "Learning Orientation", labelZh: "学习迭代倾向" },
  { id: "SR", labelEn: "Self Regulation", labelZh: "自我调节能力" },
  { id: "CI", labelEn: "Collaboration Intelligence", labelZh: "协作智力" },
] as const;
