import { Button } from "@/components/ui/button";
import type { SceneId } from "@/domain/scenes/types";

const APARTMENT_ACTIONS = [
  { label: "列硬/软约束", value: "请帮我一起列出硬约束和软约束，并说明各自优先级。" },
  { label: "对比两套房源", value: "我想对比两套房源（请点名 A/B/C/D），在同一维度上说清取舍理由。" },
  { label: "列待核验项", value: "请根据左侧房源表里「待核验」项，帮我整理要向房东/中介追问的问题清单。" },
];

const BRAND_ACTIONS = [
  { label: "对齐 brief", value: "我们先对齐命名 brief：调性、禁区、未来扩展，再进入候选。" },
  { label: "候选+理由", value: "请给我 2–3 个候选名，每个一句理由，并标出可能违背 brief 的点。" },
  { label: "聚类筛选", value: "请帮我把候选按语义聚类，并说明淘汰边界与下一步。" },
];

interface QuickActionsProps {
  sceneId: SceneId;
  disabled?: boolean;
  onAction: (message: string) => Promise<void>;
}

export function QuickActions({ sceneId, disabled, onAction }: QuickActionsProps) {
  const actions = sceneId === "apartment-tradeoff" ? APARTMENT_ACTIONS : BRAND_ACTIONS;
  const hint =
    sceneId === "apartment-tradeoff"
      ? "与当前租房权衡任务相关的快捷句（会作为一条用户消息发送）。"
      : "与当前命名冲刺相关的快捷句（会作为一条用户消息发送）。";

  return (
    <div className="space-y-2">
      <p className="text-xs text-lab-muted">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            className="px-3 py-1.5 text-xs"
            disabled={disabled}
            key={action.label}
            onClick={() => void onAction(action.value)}
            variant="subtle"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
