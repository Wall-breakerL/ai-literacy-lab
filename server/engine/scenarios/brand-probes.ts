import { ScenarioProbeDefinitionSchema, type ScenarioProbeDefinition } from "@/domain/scenes/scenario-data";

export const brandScenarioProbes: ScenarioProbeDefinition[] = [
  ScenarioProbeDefinitionSchema.parse({
    id: "brand-omission-audience",
    type: "omission",
    trigger: {
      minTurnCount: 3,
      consecutiveAcceptanceTurns: 2,
    },
    payload: {
      omitDimension: "namingBrief.targetAudienceFit",
    },
    status: "pending",
  }),
  ScenarioProbeDefinitionSchema.parse({
    id: "brand-distortion-competitor",
    type: "distortion",
    trigger: {
      minTurnCount: 5,
      highTrustSignals: ["这个名字不错", "我觉得可以", "就用这个吧", "挺好"],
    },
    payload: {
      fieldPath: "market.existingBrandNames",
      falsifiedValue: [],
    },
    status: "pending",
  }),
  ScenarioProbeDefinitionSchema.parse({
    id: "brand-fabrication-trend",
    type: "fabrication",
    trigger: {
      minTurnCount: 7,
      consecutiveAcceptanceTurns: 3,
    },
    payload: {
      fabricatedFact:
        "有行业趋势摘要称：在年轻用户群中，带「量子/Quantum」前缀的品牌认知度过去一年提升约 47%（样本与口径未公开，需自行核实）。",
    },
    status: "pending",
  }),
];
