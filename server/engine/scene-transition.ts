import type { AgentBOutput } from "@/domain/agent/agent-b-output";
import type { RuleSignal } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import { computeStageTransition } from "@/server/engine/stage-completion";

/**
 * Stage advancement driven by deliverable-style gates (see stage-completion.ts),
 * not by raw message length heuristics.
 */
export function resolveSceneStageTransition(input: {
  scene: SceneBlueprint;
  currentStageId: string;
  userMessage: string;
  signals: RuleSignal[];
  completionRequested: boolean;
}): { nextStageId: string; sceneCompleted: boolean } {
  const r = computeStageTransition(input);
  return { nextStageId: r.nextStageId, sceneCompleted: r.sceneCompleted };
}

/** Prefer Agent B suggestion when confident and valid; otherwise deterministic gates. */
export function resolveTransitionWithAgentB(input: {
  scene: SceneBlueprint;
  currentStageId: string;
  userMessage: string;
  signals: RuleSignal[];
  completionRequested: boolean;
  agentB: AgentBOutput;
}): { nextStageId: string; sceneCompleted: boolean } {
  const legacy = resolveSceneStageTransition({
    scene: input.scene,
    currentStageId: input.currentStageId,
    userMessage: input.userMessage,
    signals: input.signals,
    completionRequested: input.completionRequested,
  });

  /** 用户显式完成场景时以门控结果为准，不被 Agent B 的「下一阶段建议」覆盖。 */
  if (legacy.sceneCompleted) {
    return legacy;
  }

  const stageIds = new Set(input.scene.stages.map((s) => s.id));
  const suggestion = input.agentB.next_stage_suggestion;
  if (
    input.agentB.confidence >= 0.45 &&
    input.agentB.can_advance_stage &&
    suggestion &&
    stageIds.has(suggestion)
  ) {
    const sceneCompleted =
      legacy.sceneCompleted ||
      (input.agentB.stage_completion_status === "complete" && input.completionRequested);
    return { nextStageId: suggestion, sceneCompleted };
  }

  if (input.agentB.stage_completion_status === "complete" && input.completionRequested) {
    return legacy;
  }

  return legacy;
}
