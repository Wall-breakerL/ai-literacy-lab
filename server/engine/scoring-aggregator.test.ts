import { describe, expect, it } from "vitest";
import { SCENE_REGISTRY } from "@/domain/assessment/registry";
import { buildObservations } from "@/server/engine/scoring-aggregator";

describe("scoring aggregator", () => {
  it("creates observation with evidence and rationale", () => {
    const scene = SCENE_REGISTRY["apartment-tradeoff"];
    const out = buildObservations({
      scene,
      signals: ["request_unknowns"],
      activeProbe: scene.probes[0] ?? null,
      evidenceText: "这个点未知，我想先核验合同。",
      userTurnIndex: 2,
      sessionId: "s1",
      similarPastSignals: [],
    });
    expect(out.length).toBe(1);
    expect(out[0]?.evidenceText).toContain("未知");
    expect(out[0]?.rationale.length).toBeGreaterThan(0);
    expect(out[0]?.confidence).toBeGreaterThan(0.5);
  });

  it("decays repeated signal multiplier", () => {
    const scene = SCENE_REGISTRY["brand-naming-sprint"];
    const second = buildObservations({
      scene,
      signals: ["ask_matrix"],
      activeProbe: null,
      evidenceText: "做个矩阵吧",
      userTurnIndex: 3,
      sessionId: "s1",
      similarPastSignals: ["ask_matrix"],
    });
    const third = buildObservations({
      scene,
      signals: ["ask_matrix"],
      activeProbe: null,
      evidenceText: "再做一次矩阵",
      userTurnIndex: 4,
      sessionId: "s1",
      similarPastSignals: ["ask_matrix", "ask_matrix"],
    });
    expect(second[0]?.decayMultiplier).toBe(0.6);
    expect(third[0]?.decayMultiplier).toBe(0.3);
  });
});

