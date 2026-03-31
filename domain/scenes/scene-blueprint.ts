import { z } from "zod";

export const SceneIdSchema = z.enum(["apartment-tradeoff", "brand-naming-sprint"]);
export type SceneId = z.infer<typeof SceneIdSchema>;

export const SceneStageSchema = z.enum(["onboarding", "explore", "refine", "wrapup"]);
export type SceneStage = z.infer<typeof SceneStageSchema>;

export const SceneBlueprintSchema = z.object({
  id: SceneIdSchema,
  order: z.number().int().min(1),
  titleEn: z.string(),
  titleZh: z.string(),
  objectiveZh: z.string(),
  briefingZh: z.string(),
  defaultStage: SceneStageSchema,
});
export type SceneBlueprint = z.infer<typeof SceneBlueprintSchema>;

export const FIXED_SCENES = SceneBlueprintSchema.array().length(2).parse([
  {
    id: "apartment-tradeoff",
    order: 1,
    titleEn: "Apartment Trade-off",
    titleZh: "公寓选择权衡",
    objectiveZh: "在预算、通勤、空间和生活品质冲突中完成结构化决策。",
    briefingZh:
      "你将与 Agent A 一起评估多个租房方案。请在不完整信息下持续调整策略，并解释你的取舍依据。",
    defaultStage: "onboarding",
  },
  {
    id: "brand-naming-sprint",
    order: 2,
    titleEn: "Brand Naming Sprint",
    titleZh: "品牌命名冲刺",
    objectiveZh: "在时间压力下完成候选命名、筛选与迭代修正。",
    briefingZh:
      "你需要快速提出并迭代品牌名，平衡创意、可记忆性与语义风险。Agent A 会显性引导，你负责最终判断。",
    defaultStage: "onboarding",
  },
]);

export const SCENE_BLUEPRINT_BY_ID = Object.fromEntries(
  FIXED_SCENES.map((scene) => [scene.id, scene]),
) as Record<SceneId, SceneBlueprint>;
