import type { AgentBOutput } from "@/domain/agent/agent-b-output";
import type { RuleSignal } from "@/domain/probes/types";
import type { SceneBlueprint, StageDefinition } from "@/domain/scenes/types";

function nextStage(stages: StageDefinition[], stageId: string): string {
  const index = stages.findIndex((stage) => stage.id === stageId);
  if (index < 0 || index >= stages.length - 1) return stageId;
  return stages[index + 1].id;
}

function hasEnoughApartmentDeliverables(msg: string): boolean {
  return ["排序", "推荐", "权重", "问题"].every((kw) => msg.includes(kw));
}

function hasEnoughBrandDeliverables(msg: string): boolean {
  return ["候选", "理由", "tagline", "淘汰"].every((kw) => msg.includes(kw.toLowerCase()) || msg.includes(kw));
}

export function resolveSceneStageTransition(input: {
  scene: SceneBlueprint;
  currentStageId: string;
  userMessage: string;
  signals: RuleSignal[];
  completionRequested: boolean;
}): { nextStageId: string; sceneCompleted: boolean } {
  const { scene, currentStageId, userMessage, signals, completionRequested } = input;
  const bump = completionRequested || signals.length > 0 || userMessage.length > 40;
  const candidate = bump ? nextStage(scene.stages, currentStageId) : currentStageId;

  if (
    scene.id === "apartment-tradeoff" &&
    candidate === "decide" &&
    completionRequested &&
    hasEnoughApartmentDeliverables(userMessage)
  ) {
    return { nextStageId: candidate, sceneCompleted: true };
  }
  if (scene.id === "apartment-tradeoff" && (candidate === "stress_test" || candidate === "decide") && completionRequested) {
    return { nextStageId: candidate, sceneCompleted: true };
  }
  if (
    scene.id === "brand-naming-sprint" &&
    candidate === "finalize" &&
    completionRequested &&
    hasEnoughBrandDeliverables(userMessage)
  ) {
    return { nextStageId: candidate, sceneCompleted: true };
  }
  if (
    scene.id === "brand-naming-sprint" &&
    (candidate === "stress_test" || candidate === "finalize") &&
    completionRequested
  ) {
    return { nextStageId: candidate, sceneCompleted: true };
  }

  return { nextStageId: candidate, sceneCompleted: false };
}

/** Prefer Agent B suggestion when confident and valid; otherwise legacy heuristic. */
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
