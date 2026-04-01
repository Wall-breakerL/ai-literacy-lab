import { ScenarioDataLayerSchema } from "@/domain/scenes/scenario-data";
import { brandScenarioProbes } from "@/server/engine/scenarios/brand-probes";

export const brandScenarioData = ScenarioDataLayerSchema.parse({
  sceneId: "brand-naming-sprint",
  publicInfo: {
    product: {
      positioning: "轻预算、共同记账向产品，未来可扩展到共同支出",
      tone: "友好、不说教，避免金融机构/理财管家感",
      avoid: ["省钱口号硬推销", "教训用户", "银行理财话术"],
    },
    namingBrief: {
      goal: "3 个候选名 + 每个一句理由 + tagline + 淘汰标准",
      targetAudienceFit: "年轻用户、轻量协作场景；名字要易记、可扩展",
      semanticGuards: ["避免硬核记账联想", "避免说教语气"],
    },
    market: {
      existingBrandNames: ["随手记", "薄荷记账", "钱迹", "小青账"],
      collisionRiskNote: "发布前建议检索商标与域名可用性（以下列表仅为示例，非法律意见）",
    },
  },
  hiddenInfo: [
    {
      triggerKeywords: ["竞品", "撞名", "商标", "域名"],
      data: {
        "market.trademarkNote": "若走向商用，建议委托专业机构做商标与域名检索。",
      },
    },
  ],
  probeOverrides: brandScenarioProbes,
});
