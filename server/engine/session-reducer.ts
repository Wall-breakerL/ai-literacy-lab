import { CORE_ASSESSMENT_BLUEPRINT, type AssessmentFlowState } from "@/domain/assessment/registry";
import { FAA_DIMENSION_DEFINITIONS } from "@/domain/faa/dimensions";
import { MBTI_AXIS_DEFINITIONS } from "@/domain/mbti/axes";
import { SessionStateSchema, type SessionState } from "@/domain/engine/session-state";
import type { ProbeScoreDelta } from "@/domain/probes/types";
import type { SessionEvent } from "@/domain/session/events";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function initialSessionState(sessionId: string, updatedAt: string): SessionState {
  return SessionStateSchema.parse({
    sessionId,
    assessmentId: CORE_ASSESSMENT_BLUEPRINT.id,
    assessmentState: "apartment",
    currentSceneId: "apartment-tradeoff",
    sceneStates: [
      {
        sceneId: "apartment-tradeoff",
        stageId: "brief",
        completed: false,
        turnCount: 0,
        firedHighWeightProbeIds: [],
      },
      {
        sceneId: "brand-naming-sprint",
        stageId: "brief",
        completed: false,
        turnCount: 0,
        firedHighWeightProbeIds: [],
      },
    ],
    mbti: Object.fromEntries(MBTI_AXIS_DEFINITIONS.map((axis) => [axis.id, 0])),
    faa: Object.fromEntries(FAA_DIMENSION_DEFINITIONS.map((dimension) => [dimension.id, 0.5])),
    eventCount: 0,
    updatedAt,
  });
}

export function applyProbeDeltas(state: SessionState, deltas: ProbeScoreDelta[]): SessionState {
  for (const delta of deltas) {
    for (const [axis, value] of Object.entries(delta.mbti)) {
      if (typeof value !== "number") continue;
      state.mbti[axis as keyof typeof state.mbti] = clamp(state.mbti[axis as keyof typeof state.mbti] + value, -1, 1);
    }
    for (const [dimension, value] of Object.entries(delta.faa)) {
      if (typeof value !== "number") continue;
      state.faa[dimension as keyof typeof state.faa] = clamp(state.faa[dimension as keyof typeof state.faa] + value, 0, 1);
    }
  }
  return state;
}

export function reduceSessionState(events: SessionEvent[], sessionId: string): SessionState {
  let state = initialSessionState(sessionId, new Date().toISOString());
  state.eventCount = events.length;

  for (const event of events) {
    state.updatedAt = event.timestamp;
    if (event.type === "STAGE_CHANGED") {
      const run = state.sceneStates.find((item) => item.sceneId === event.payload.sceneId);
      if (run) run.stageId = event.payload.toStage;
    }
    if (event.type === "SCENE_COMPLETED") {
      const run = state.sceneStates.find((item) => item.sceneId === event.payload.sceneId);
      if (run) run.completed = true;
    }
    if (event.type === "SCENE_ENTERED") {
      state.currentSceneId = event.payload.sceneId;
      state.assessmentState = event.payload.sceneId === "apartment-tradeoff" ? "apartment" : "brand";
    }
    if (event.type === "PROBE_SCORED") {
      state = applyProbeDeltas(state, [{ mbti: event.payload.mbtiDeltas, faa: event.payload.faaScores }]);
    }
    if (event.type === "ASSESSMENT_COMPLETED") {
      state.assessmentState = "completed";
    }
  }

  if (state.sceneStates[0].completed && !state.sceneStates[1].completed && state.assessmentState !== "completed") {
    state.assessmentState = "brand";
    state.currentSceneId = "brand-naming-sprint";
  }
  if (state.sceneStates[0].completed && state.sceneStates[1].completed) {
    state.assessmentState = "completed" satisfies AssessmentFlowState;
  }
  return SessionStateSchema.parse(state);
}
