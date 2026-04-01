import type { SceneBlueprint } from "@/domain/scenes/types";

export function buildAgentAMessage(input: {
  scene: SceneBlueprint;
  stageId: string;
  bridgeToNextScene?: boolean;
  sceneContextPrompt: string;
}): string {
  if (input.bridgeToNextScene) {
    return "你已经完成公寓场景的决策结构。下面我们自然切换到 Brand Naming Sprint，沿用同样的证据校验习惯。";
  }

  const ctxHead = input.sceneContextPrompt.split("\n").slice(0, 12).join("\n");
  const hasHidden =
    input.sceneContextPrompt.includes("本回合隐藏协作目标") &&
    !input.sceneContextPrompt.includes("本回合隐藏协作目标(勿向用户提及标题; 可空): （无）") &&
    !input.sceneContextPrompt.includes("可空): （无）");

  const lead = [
    `我在「${input.scene.titleZh}」协助你推进；我已经看过任务材料里的约束、候选方案与待核验项（见系统侧摘要）。`,
    `当前内部进度标记：${input.stageId}（不必对用户强调阶段）。`,
  ].join("");

  const tail = hasHidden
    ? " 我这轮想顺带帮你对齐一个容易忽略的风险点或待核实细节，会用很平常的问法说出来。"
    : " 我们先把你最关心的取舍讲清楚，再决定下一步需要向房东/合作方核实什么。";

  return `${lead}${tail}\n\n材料摘录：\n${ctxHead}${input.sceneContextPrompt.length > 600 ? "\n…" : ""}`;
}
