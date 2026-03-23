import type { EvalEventRecordV2 } from "./assessment-v2/extract-events-v2";
import { V2_DIMENSION_KEYS, V2_DIMENSION_MAX, type V2DimensionKey } from "./assessment-v2/weights";
import type { JudgeOutputV2 } from "./assessment-v2/types";

const DIM_EVENTS: Record<V2DimensionKey, string[]> = {
  taskFraming: ["goal_specified", "constraint_specified", "recipient_specified"],
  dialogSteering: ["revision_requested", "comparison_requested", "goal_specified"],
  evidenceSeeking: ["verification_requested", "source_requested", "freshness_checked"],
  modelMentalModel: [
    "uncertainty_acknowledged",
    "model_variability_noted",
    "hallucination_detected",
    "overtrust_signal",
    "anthropomorphism_signal",
  ],
  failureAwareness: ["hallucination_detected", "verification_requested", "uncertainty_acknowledged"],
  trustBoundaryCalibration: [
    "risk_noticed",
    "sensitive_info_shared",
    "delegation_boundary_set",
    "human_review_required",
  ],
  reflectiveTransfer: ["reflection_articulated", "debrief_meta_awareness", "delegation_boundary_set"],
};

function countMatching(
  events: EvalEventRecordV2[],
  ids: string[]
): number {
  const set = new Set(ids);
  return events.filter((e) => set.has(e.event)).length;
}

/** 事件计数 → 0..max，基线偏宽松 */
function scoreFromCount(n: number, max: number): number {
  if (n === 0) return Math.round(max * 0.35);
  if (n === 1) return Math.round(max * 0.5);
  if (n === 2) return Math.round(max * 0.65);
  if (n === 3) return Math.round(max * 0.8);
  return max;
}

export function runRuleJudgeV2(
  scenarioId: string,
  sessionId: string,
  events: EvalEventRecordV2[],
  identityId?: string
): JudgeOutputV2 {
  const dimensions = {} as JudgeOutputV2["dimensions"];
  for (const k of V2_DIMENSION_KEYS) {
    const n = countMatching(events, DIM_EVENTS[k]);
    let score = scoreFromCount(n, V2_DIMENSION_MAX[k]);
    if (k === "trustBoundaryCalibration") {
      const types = new Set(events.map((e) => e.event));
      if (types.has("sensitive_info_shared") && !types.has("risk_noticed")) {
        score = Math.min(score, Math.round(V2_DIMENSION_MAX[k] * 0.25));
      }
    }
    if (k === "modelMentalModel" && countMatching(events, ["overtrust_signal"]) > 0) {
      score = Math.min(score, Math.round(V2_DIMENSION_MAX[k] * 0.45));
    }
    dimensions[k] = {
      score,
      max: V2_DIMENSION_MAX[k],
      evidence: events.filter((e) => DIM_EVENTS[k].includes(e.event)).map((e) => e.event),
      reason: "规则 Judge：基于关键词事件的粗粒度映射。",
    };
  }

  return {
    rubricVersion: "2.0",
    scenarioId,
    identityId,
    dimensions,
    flags: [],
    suggestions: [
      "可与 AI 协作时更早说清目标、约束与分工。",
      "对关键事实养成核实来源与时效的习惯。",
      "明确哪些步骤必须人工复核或承担后果。",
    ],
    blindSpots: [],
    nextRecommendedScenarios: ["verification_pack_v1", "risk_boundary_pack_v1"],
    nextRecommendedProbes: ["coord_verify", "source_check"],
  };
}
