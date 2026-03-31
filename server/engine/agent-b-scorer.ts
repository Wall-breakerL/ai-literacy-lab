import {
  ProbeScoreDeltaSchema,
  type ProbeDefinition,
  type ProbeScoreDelta,
  type RuleSignal,
} from "@/domain/probes/types";

const SIGNAL_DELTA_MAP: Partial<Record<RuleSignal, { mbti?: Record<string, number>; faa?: Record<string, number> }>> = {
  brief_consistency_check: { mbti: { epistemic: 0.12 }, faa: { RC: 0.1 } },
  accept_without_source_check: { mbti: { epistemic: -0.12 }, faa: { RC: -0.1 } },
  rebuild_model: { mbti: { repair: -0.12 }, faa: { LO: 0.06 } },
  reweight_existing_model: { mbti: { repair: 0.1 }, faa: { SR: 0.04 } },
};

export function scoreProbeDeltas(probes: ProbeDefinition[], signals: RuleSignal[]) {
  const deltas = probes.map((probe) => probe.scoreDelta);
  for (const signal of signals) {
    const patch = SIGNAL_DELTA_MAP[signal];
    if (!patch) continue;
    deltas.push({
      mbti: (patch.mbti ?? {}) as never,
      faa: (patch.faa ?? {}) as never,
    });
  }
  return ProbeScoreDeltaSchema.array().parse(deltas);
}

/** Merge signal-only patches into one delta (for EVALUATION_SCORE_APPLIED). */
export function mergeSignalOnlyDeltas(signals: RuleSignal[]): ProbeScoreDelta {
  const mbti: Record<string, number> = {};
  const faa: Record<string, number> = {};
  for (const signal of signals) {
    const patch = SIGNAL_DELTA_MAP[signal];
    if (!patch) continue;
    for (const [k, v] of Object.entries(patch.mbti ?? {})) {
      if (typeof v === "number") mbti[k] = (mbti[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(patch.faa ?? {})) {
      if (typeof v === "number") faa[k] = (faa[k] ?? 0) + v;
    }
  }
  return ProbeScoreDeltaSchema.parse({ mbti, faa });
}
