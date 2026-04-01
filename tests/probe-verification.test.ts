import { describe, expect, it } from "vitest";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";
import { EngineService } from "@/server/engine/engine-service";

describe("probe & scoring verifiability (minimal fixtures)", () => {
  it("fires hidden collaboration probe when user recommends a listing too early", async () => {
    const engine = new EngineService();
    const session = engine.createSession();
    const out = await engine.runTurn(session.sessionId, "我首选 B，别的先不管了。");
    expect(out.firedProbeIds.length).toBeGreaterThan(0);
    const replay = engine.getState(session.sessionId);
    const fired = replay.events.filter((e) => e.type === "PROBE_FIRED");
    expect(fired.length).toBe(1);
    expect(fired[0]?.payload.hiddenObjectiveZh).toBeTruthy();
  });

  it("scores when user follows up with structured comparison after a probe", async () => {
    const engine = new EngineService();
    const session = engine.createSession();
    await engine.runTurn(session.sessionId, "我推荐 A。");
    const out2 = await engine.runTurn(
      session.sessionId,
      "我补充对比：A 和 B 在宠物合同、室友补觉和通勤上各有利弊，我会向中介书面确认宠物条款与违约金。",
    );
    const replay = engine.getState(session.sessionId);
    const closed = replay.events.filter((e) => e.type === "PROBE_CLOSED" && e.payload.scoreApplied);
    const evals = replay.events.filter((e) => e.type === "EVALUATION_SCORE_APPLIED");
    expect(closed.length + evals.length).toBeGreaterThan(0);
    expect(out2.probeDeltas.length).toBeGreaterThan(0);
  });

  it("can fire probe when user ranks but omits verification language", async () => {
    const engine = new EngineService();
    const session = engine.createSession();
    await engine.runTurn(session.sessionId, "我先列硬约束：6200、6/1、宠物写进合同。");
    const out = await engine.runTurn(session.sessionId, "我的排序是 B、A、D、C，首选 B。");
    expect(out.firedProbeIds.length).toBeGreaterThan(0);
  });

  it("records evaluation when user re-ranks under tighter constraints", async () => {
    const engine = new EngineService();
    const session = engine.createSession();
    await engine.runTurn(session.sessionId, "先对齐约束，再对比 A/B。");
    await engine.runTurn(
      session.sessionId,
      "假设预算再降 300 且通勤上限收紧到 40 分钟，我会对比 B 与 D 后重排：先淘汰 A，并说明合同与室友层面的理由。",
    );
    const replay = engine.getState(session.sessionId);
    const evals = replay.events.filter((e) => e.type === "EVALUATION_SCORE_APPLIED");
    expect(evals.length).toBeGreaterThan(0);
  });
});

describe("session completes with COMPLETE_SCENE_SIGNAL", () => {
  it("still completes apartment then brand with signal", async () => {
    const engine = new EngineService();
    const session = engine.createSession();
    await engine.runTurn(
      session.sessionId,
      "硬约束预算 6200、6/1 前入住、宠物条款写进合同；软偏好兼顾室友夜班补觉与通勤。",
    );
    await engine.runTurn(
      session.sessionId,
      "我对比 A 与 B（采光、噪音、宠物合同、通勤），排序 B、A、D、C，最推荐 B；向中介追问押金、违约金、宠物补充协议、噪音与入住日。",
    );
    await engine.runTurn(session.sessionId, COMPLETE_SCENE_SIGNAL);
    await engine.runTurn(
      session.sessionId,
      "最终定稿三个候选：轻舟、浅账、共简；每个一句理由与 tagline；淘汰标准是对齐 brief、不说教、避免金融机构感。",
    );
    await engine.runTurn(session.sessionId, COMPLETE_SCENE_SIGNAL);
    const { state } = engine.getState(session.sessionId);
    expect(state.assessmentState).toBe("completed");
  });
});
