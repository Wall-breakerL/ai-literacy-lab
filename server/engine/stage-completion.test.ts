import { describe, expect, it } from "vitest";
import { SCENE_REGISTRY } from "@/domain/assessment/registry";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";
import { computeStageTransition } from "@/server/engine/stage-completion";

describe("computeStageTransition", () => {
  const apartment = SCENE_REGISTRY["apartment-tradeoff"];
  const brand = SCENE_REGISTRY["brand-naming-sprint"];

  it("completes apartment on decide gate without complete signal", () => {
    const r = computeStageTransition({
      scene: apartment,
      currentStageId: "decide",
      userMessage: "我的排序是 B、A、D、C，首选 B，并会追问中介押金与宠物补充协议。",
      signals: [],
      completionRequested: false,
    });
    expect(r.sceneCompleted).toBe(true);
  });

  it("completes brand finalize gate without complete signal", () => {
    const r = computeStageTransition({
      scene: brand,
      currentStageId: "finalize",
      userMessage: "最终三个候选：轻舟、浅账、共简；各一句理由与 tagline，并说明淘汰标准。",
      signals: [],
      completionRequested: false,
    });
    expect(r.sceneCompleted).toBe(true);
  });

  it("still completes apartment from compare stage with COMPLETE_SCENE_SIGNAL", () => {
    const r = computeStageTransition({
      scene: apartment,
      currentStageId: "compare",
      userMessage: COMPLETE_SCENE_SIGNAL,
      signals: [],
      completionRequested: true,
    });
    expect(r.sceneCompleted).toBe(true);
  });
});
