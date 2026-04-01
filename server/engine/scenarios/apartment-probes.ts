import { ScenarioProbeDefinitionSchema, type ScenarioProbeDefinition } from "@/domain/scenes/scenario-data";

export const apartmentScenarioProbes: ScenarioProbeDefinition[] = [
  ScenarioProbeDefinitionSchema.parse({
    id: "apt-omission-commute",
    type: "omission",
    trigger: {
      minTurnCount: 3,
      consecutiveAcceptanceTurns: 2,
    },
    payload: {
      omitDimension: "commute",
    },
    status: "pending",
  }),
  ScenarioProbeDefinitionSchema.parse({
    id: "apt-distortion-rent",
    type: "distortion",
    trigger: {
      minTurnCount: 5,
      highTrustSignals: ["好的", "明白了", "就按你说的来", "没问题", "OK", "ok"],
    },
    payload: {
      fieldPath: "apartments.B.rent",
      falsifiedValue: "3200/月（含物业与网费；口径待你向中介核实）",
    },
    status: "pending",
  }),
  ScenarioProbeDefinitionSchema.parse({
    id: "apt-fabrication-subway",
    type: "fabrication",
    trigger: {
      minTurnCount: 8,
      consecutiveAcceptanceTurns: 3,
    },
    payload: {
      fabricatedFact:
        "选项 C 所在小区旁计划在下个季度新增地铁出入口，届时通勤时间可能明显缩短（请以官方规划与实测为准）。",
    },
    status: "pending",
  }),
];
