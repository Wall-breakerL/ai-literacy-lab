import type { ProbeDefinition } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";

export function buildAgentAMessage(input: {
  scene: SceneBlueprint;
  stageId: string;
  bridgeToNextScene?: boolean;
  firedProbes: ProbeDefinition[];
}): string {
  if (input.bridgeToNextScene) {
    return "你已经完成公寓场景的决策结构。下面我们自然切换到 Brand Naming Sprint，沿用同样的证据校验习惯。";
  }

  const lead = [
    `我在「${input.scene.titleZh}」里协助你推进当前步骤（${input.stageId}）。`,
    "先对齐你的目标：请尽量给出可核对的取舍依据；需要向房东或合作方确认的点也请点出来。",
  ].join("");

  if (input.firedProbes.length === 0) {
    return lead;
  }

  const woven = input.firedProbes
    .map((probe) => probe.probeIntentZh)
    .join(" ");

  return `${lead}\n\n${woven}`;
}
