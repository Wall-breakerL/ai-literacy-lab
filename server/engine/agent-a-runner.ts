import type { AssessmentFlowState } from "@/domain/assessment/registry";
import type { ProbeDefinition } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";

export function buildAgentAMessage(input: {
  assessmentState: AssessmentFlowState;
  scene: SceneBlueprint;
  stageId: string;
  bridgeToNextScene?: boolean;
  firedProbes: ProbeDefinition[];
}): string {
  if (input.bridgeToNextScene) {
    return "你已经完成公寓场景的决策结构。下面我们自然切换到 Brand Naming Sprint，沿用同样的证据校验习惯。";
  }

  const probeSuffix =
    input.firedProbes.length > 0
      ? `\n\n[Probe 注入]\n${input.firedProbes.map((probe) => `- ${probe.injectMessageTemplate}`).join("\n")}`
      : "";

  return [
    `【Agent A】当前全局阶段：${input.assessmentState}`,
    `场景：${input.scene.titleZh}`,
    `当前局部阶段：${input.stageId}`,
    "请继续给出可验证依据，并说明你如何修正判断。",
    probeSuffix,
  ].join("\n");
}
