import { describe, expect, it } from "vitest";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";
import { EngineService } from "@/server/engine/engine-service";

type TranscriptCase = {
  name: string;
  turns: string[];
  mustIncludeProbe: string;
};

const CASES: TranscriptCase[] = [
  {
    name: "auditing_global_reframing",
    mustIncludeProbe: "brand-naming-probe-07",
    turns: [
      "先定义标准与权重，我会用对比矩阵并核对证据来源。",
      "在 compare 阶段我发现合同宠物条款是隐患 blocker，要多因素淘汰。",
      "我会重建模型并给出排序、最推荐最不推荐与权重。",
      "补充给房东问题：宠物条款、入住时间、噪音、违约、维修责任。",
      "最终输出：排序+推荐+权重+5个问题。",
      COMPLETE_SCENE_SIGNAL,
      "命名先定 criteria，不说教语气，先方向再扩展并做 cluster。",
      "我会检查违背 brief 的候选，避免金融机构感并做淘汰标准。",
      "如果出现伪访谈，我会回到 brief 做 consistency check 再下结论。",
      "final 输出：3个候选+每个理由+每个tagline+淘汰标准。",
      COMPLETE_SCENE_SIGNAL,
    ],
  },
  {
    name: "trusting_local_refinement",
    mustIncludeProbe: "apartment-tradeoff-probe-02",
    turns: [
      "我先直接推荐 B，但会快速补充权重说明。",
      "我只看通勤会过早收敛，所以补一个比较矩阵。",
      "我会在现有模型上重新加权，不重建。",
      "给中介追问 5 个问题并给出最推荐最不推荐。",
      "排序、推荐、权重、问题全部补齐。",
      COMPLETE_SCENE_SIGNAL,
      "品牌名我先给方向，再扩展候选并聚类。",
      "我接受这个结论先用，不核对来源。",
      "我改为局部修复命名，不做全局推翻。",
      "候选3个+理由+tagline+淘汰标准完成。",
      COMPLETE_SCENE_SIGNAL,
      COMPLETE_SCENE_SIGNAL,
    ],
  },
  {
    name: "collaborative_exploratory",
    mustIncludeProbe: "brand-naming-probe-04",
    turns: [
      "先做角色契约：我负责判断，Agent A 协助提问与对照。",
      "我们先列 criteria，再开矩阵，逐项比较 A/B/C/D。",
      "识别隐藏阻塞后再做压力测试，并持续修正。",
      "我会综合碎片并重排方案，输出排序与推荐结论。",
      "补齐权重与5个问题，scene1 完成。",
      COMPLETE_SCENE_SIGNAL,
      "scene2 先定方向再扩展，先标准后 ideation。",
      "请按 cluster 矩阵整理候选并筛掉违背 brief 的名字。",
      "我会整合命名碎片，重述语气 rubric，避免说教。",
      "输出 3 候选+理由+tagline+淘汰标准。",
      COMPLETE_SCENE_SIGNAL,
    ],
  },
];

describe("dual-agent post engine transcripts", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const engine = new EngineService();
      const session = engine.createSession();
      const seenSignals = new Set<string>();
      const firedProbes = new Set<string>();

      for (const turn of c.turns) {
        const output = await engine.runTurn(session.sessionId, turn);
        output.ruleSignals.forEach((signal) => seenSignals.add(signal));
        output.firedProbeIds.forEach((probeId) => firedProbes.add(probeId));
      }

      const replay = engine.getState(session.sessionId);
      const stageEvents = replay.events.filter((event) => event.type === "STAGE_CHANGED");
      const scoringEvents = replay.events.filter(
        (event) => event.type === "PROBE_SCORED" || event.type === "EVALUATION_SCORE_APPLIED",
      );

      expect(stageEvents.length).toBeGreaterThan(0);
      expect(scoringEvents.length).toBeGreaterThan(0);
      expect(firedProbes.has(c.mustIncludeProbe)).toBe(true);
      expect(seenSignals.size).toBeGreaterThan(0);
      expect(replay.state.sceneStates.every((scene) => scene.completed)).toBe(true);
      expect(replay.state.assessmentState).toBe("completed");
      expect(replay.state.currentSceneId).toBe("brand-naming-sprint");
    });
  }
});
