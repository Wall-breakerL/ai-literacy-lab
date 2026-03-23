import type { V2DimensionKey } from "./assessment-v2/weights";
import { V2_DIMENSION_MAX } from "./assessment-v2/weights";
import type { EvalEventRecordV2 } from "./assessment-v2/extract-events-v2";
import type { JudgeOutputV2 } from "./assessment-v2/types";
import { V2_RUBRIC_WEIGHTS } from "./assessment-v2/weights";

const CAP_NO_EVIDENCE = 0.55;

const DIM_EVENTS: Record<V2DimensionKey, string[]> = {
  taskFraming: ["goal_specified", "constraint_specified", "recipient_specified"],
  dialogSteering: ["revision_requested", "comparison_requested"],
  evidenceSeeking: ["verification_requested", "source_requested", "freshness_checked"],
  modelMentalModel: [
    "uncertainty_acknowledged",
    "model_variability_noted",
    "hallucination_detected",
    "overtrust_signal",
  ],
  failureAwareness: ["hallucination_detected", "verification_requested"],
  trustBoundaryCalibration: ["risk_noticed", "delegation_boundary_set", "human_review_required"],
  reflectiveTransfer: ["reflection_articulated", "debrief_meta_awareness"],
};

export function computeWeightedScoreV2(dimensions: JudgeOutputV2["dimensions"]): number {
  let sum = 0;
  for (const k of Object.keys(V2_RUBRIC_WEIGHTS) as V2DimensionKey[]) {
    const d = dimensions[k];
    const frac = d.max > 0 ? Math.min(1, d.score / d.max) : 0;
    sum += frac * V2_RUBRIC_WEIGHTS[k];
  }
  return Math.round(sum);
}

export function applyRuleCorrectionsV2(
  rich: JudgeOutputV2,
  events: EvalEventRecordV2[]
): JudgeOutputV2 {
  const types = new Set(events.map((e) => e.event));
  const dimensions = { ...rich.dimensions };

  for (const dim of Object.keys(DIM_EVENTS) as V2DimensionKey[]) {
    const supporting = DIM_EVENTS[dim];
    const has = supporting.some((ev) => types.has(ev as EvalEventRecordV2["event"]));
    const max = V2_DIMENSION_MAX[dim];
    const cap = Math.round(max * CAP_NO_EVIDENCE);
    if (!has && dimensions[dim].score > cap) {
      dimensions[dim] = { ...dimensions[dim], score: cap };
    }
  }

  if (types.has("sensitive_info_shared") && !types.has("risk_noticed")) {
    const tb = dimensions.trustBoundaryCalibration;
    dimensions.trustBoundaryCalibration = {
      ...tb,
      score: Math.min(tb.score, Math.round(tb.max * 0.25)),
    };
  }

  return { ...rich, dimensions };
}
