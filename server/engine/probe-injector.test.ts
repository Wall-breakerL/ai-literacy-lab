import { describe, expect, it } from "vitest";
import { ScenarioDataLayerSchema, type ScenarioProbeRuntime } from "@/domain/scenes/scenario-data";
import { ProbeInjector } from "@/server/engine/probe-injector";

describe("ProbeInjector", () => {
  it("merges hidden info when keywords match", () => {
    const layer = ScenarioDataLayerSchema.parse({
      sceneId: "apartment-tradeoff",
      publicInfo: { apartments: { A: { commute: "10min" } } },
      hiddenInfo: [
        {
          triggerKeywords: ["隔音"],
          data: { "apartments.A.sound": "一般" },
        },
      ],
      probeOverrides: [],
    });
    const probes: ScenarioProbeRuntime[] = [];
    const inj = new ProbeInjector();
    const out = inj.processBeforeLLMCall({
      layer,
      conversationHistory: [{ role: "user", content: "我比较在意隔音" }],
      currentTurn: 2,
      probes,
    });
    expect((out.scenarioDataForLLM.apartments as { A: { sound?: string } }).A.sound).toBe("一般");
  });

  it("triggers distortion and mutates scenario data once", () => {
    const layer = ScenarioDataLayerSchema.parse({
      sceneId: "apartment-tradeoff",
      publicInfo: { apartments: { B: { rent: "6100" } } },
      hiddenInfo: [],
      probeOverrides: [
        {
          id: "t1",
          type: "distortion",
          trigger: { minTurnCount: 1, highTrustSignals: ["好的"] },
          payload: { fieldPath: "apartments.B.rent", falsifiedValue: "3200" },
          status: "pending",
        },
      ],
    });
    const probes: ScenarioProbeRuntime[] = JSON.parse(JSON.stringify(layer.probeOverrides)) as ScenarioProbeRuntime[];
    const inj = new ProbeInjector();
    const out = inj.processBeforeLLMCall({
      layer,
      conversationHistory: [{ role: "user", content: "好的" }],
      currentTurn: 3,
      probes,
    });
    expect(out.triggeredProbeId).toBe("t1");
    expect((out.scenarioDataForLLM.apartments as { B: { rent: string } }).B.rent).toBe("3200");
    expect(probes[0]!.status).toBe("triggered");
  });

  it("omits dotted path for brand-style omission", () => {
    const layer = ScenarioDataLayerSchema.parse({
      sceneId: "brand-naming-sprint",
      publicInfo: { namingBrief: { targetAudienceFit: "young", goal: "x" } },
      hiddenInfo: [],
      probeOverrides: [
        {
          id: "o1",
          type: "omission",
          trigger: { minTurnCount: 1, highTrustSignals: ["x"] },
          payload: { omitDimension: "namingBrief.targetAudienceFit" },
          status: "pending",
        },
      ],
    });
    const probes: ScenarioProbeRuntime[] = JSON.parse(JSON.stringify(layer.probeOverrides)) as ScenarioProbeRuntime[];
    const inj = new ProbeInjector();
    const out = inj.processBeforeLLMCall({
      layer,
      conversationHistory: [{ role: "user", content: "x" }],
      currentTurn: 2,
      probes,
    });
    expect(out.triggeredProbeId).toBe("o1");
    expect((out.scenarioDataForLLM.namingBrief as Record<string, unknown>).targetAudienceFit).toBeUndefined();
  });
});
