import { describe, expect, it } from "vitest";
import type { ScenarioProbeRuntime } from "@/domain/scenes/scenario-data";
import { containsQuestioningSignal, trackProbeDetection } from "@/server/engine/probe-tracker";

describe("probe-tracker", () => {
  it("detects questioning signals", () => {
    expect(containsQuestioningSignal("你确定吗？")).toBe(true);
    expect(containsQuestioningSignal("好的明白了")).toBe(false);
  });

  it("marks detected when user questions within window", () => {
    const probes: ScenarioProbeRuntime[] = [
      {
        id: "p1",
        type: "distortion",
        trigger: { minTurnCount: 1 },
        payload: { fieldPath: "x", falsifiedValue: 1 },
        status: "triggered",
        triggeredAtTurn: 2,
      },
    ];
    trackProbeDetection({
      probes,
      userMessage: "等等，这个数据好像不对",
      currentUserTurn: 3,
      detectionWindow: 3,
    });
    expect(probes[0]!.status).toBe("detected");
  });

  it("marks undetected after window without questioning", () => {
    const probes: ScenarioProbeRuntime[] = [
      {
        id: "p1",
        type: "distortion",
        trigger: { minTurnCount: 1 },
        payload: { fieldPath: "x", falsifiedValue: 1 },
        status: "triggered",
        triggeredAtTurn: 1,
      },
    ];
    trackProbeDetection({
      probes,
      userMessage: "好的",
      currentUserTurn: 4,
      detectionWindow: 3,
    });
    expect(probes[0]!.status).toBe("undetected");
  });
});
