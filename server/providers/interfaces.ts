import type { FaaDimensionId, ProbeId, SceneId } from "@/domain";

export interface GuideProvider {
  buildBriefing(sceneId: SceneId): string;
  replyToUser(sceneId: SceneId, userMessage: string): string;
}

export interface JudgeResult {
  probeId: ProbeId;
  mbtiDeltas: Partial<Record<"relation" | "workflow" | "epistemic" | "repair", number>>;
  faaScores: Partial<Record<FaaDimensionId, number>>;
  evidenceExcerpt: string;
}

export interface JudgeProvider {
  scoreUserMessage(input: { sceneId: SceneId; message: string }): JudgeResult;
}
