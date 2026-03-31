import type { JudgeProvider, JudgeResult } from "@/server/providers/interfaces";
import type { SceneId } from "@/domain";

function pickProbe(sceneId: SceneId, seed: number): JudgeResult["probeId"] {
  if (sceneId === "apartment-tradeoff") {
    return seed % 2 === 0 ? "apartment-tradeoff-probe-02" : "apartment-tradeoff-probe-03";
  }
  return seed % 2 === 0 ? "brand-naming-probe-04" : "brand-naming-probe-07";
}

export class MockJudgeProvider implements JudgeProvider {
  scoreUserMessage(input: { sceneId: SceneId; message: string }): JudgeResult {
    const seed = input.message.length;
    const normalized = ((seed % 10) - 5) / 10;
    const positive = Math.min(1, Math.max(0, 0.5 + normalized));

    return {
      probeId: pickProbe(input.sceneId, seed),
      mbtiDeltas: {
        relation: normalized * 0.6,
        workflow: normalized * -0.4,
        epistemic: normalized * 0.5,
        repair: normalized * -0.3,
      },
      faaScores: {
        SI: positive,
        RC: Math.min(1, positive + 0.05),
        LO: Math.max(0, positive - 0.04),
        SR: Math.min(1, positive + 0.03),
        CI: positive,
      },
      evidenceExcerpt: input.message.slice(0, 120),
    };
  }
}
