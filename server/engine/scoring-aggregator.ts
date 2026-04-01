import { createId } from "@/lib/id";
import type { RuleSignal, ProbeDefinition } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import { ScoreObservationSchema, type ScoreObservation } from "@/domain/observations/types";

const SIGNAL_PATCH: Partial<Record<RuleSignal, { mbti?: Record<string, number>; faa?: Record<string, number> }>> = {
  criteria_first: { mbti: { workflow: -0.08 }, faa: { SI: 0.08 } },
  ask_matrix: { mbti: { workflow: -0.05 }, faa: { SI: 0.06 } },
  request_unknowns: { mbti: { epistemic: -0.08 }, faa: { RC: 0.08 } },
  conservative_assumption: { mbti: { epistemic: -0.05 }, faa: { RC: 0.06 } },
  compare_before_decide: { mbti: { workflow: -0.05 }, faa: { SI: 0.05 } },
  pick_by_vibe: { mbti: { workflow: 0.09 }, faa: { SI: -0.05 } },
};

export function buildObservations(input: {
  scene: SceneBlueprint;
  signals: RuleSignal[];
  activeProbe: ProbeDefinition | null;
  evidenceText: string;
  userTurnIndex: number;
  sessionId: string;
  similarPastSignals: RuleSignal[];
}): ScoreObservation[] {
  const source = input.activeProbe ? "probe" : "spontaneous";
  const decayBase =
    input.similarPastSignals.length === 0 ? 1 : input.similarPastSignals.length === 1 ? 0.6 : 0.3;
  if (input.signals.length === 0) return [];
  const observations = input.signals.map((signal) => {
    const patch = SIGNAL_PATCH[signal] ?? { mbti: {}, faa: {} };
    const probeDelta = input.activeProbe?.scoreDelta;
    const mbti = Object.fromEntries(
      Object.entries({ ...(patch.mbti ?? {}), ...(probeDelta?.mbti ?? {}) }).map(([k, v]) => [k, Number(v) * decayBase]),
    );
    const faa = Object.fromEntries(
      Object.entries({ ...(patch.faa ?? {}), ...(probeDelta?.faa ?? {}) }).map(([k, v]) => [k, Number(v) * decayBase]),
    );
    const confidence =
      source === "probe" ? (input.evidenceText.length > 12 ? 0.9 : 0.65) : input.evidenceText.length > 12 ? 0.7 : 0.4;
    return ScoreObservationSchema.parse({
      observationId: createId("obs"),
      sessionId: input.sessionId,
      sceneId: input.scene.id,
      probeId: input.activeProbe?.id ?? null,
      userTurnId: input.userTurnIndex,
      signalIds: [signal],
      evidenceText: input.evidenceText.slice(0, 220),
      mbtiDelta: mbti,
      faaDelta: faa,
      confidence,
      rationale: input.activeProbe
        ? `命中 active probe「${input.activeProbe.label}」并匹配信号 ${signal}`
        : `无 active probe，记录低权重自发信号 ${signal}`,
      source,
      decayMultiplier: decayBase,
    });
  });
  return observations;
}

