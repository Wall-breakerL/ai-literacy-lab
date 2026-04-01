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
      ? "参考句式（点击发送，也可直接打字）"
      : "参考句式（点击发送，也可直接打字）";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-lab-muted/70">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            className="border border-lab/50 bg-lab-panel/50 px-2.5 py-1 text-[11px] text-lab-muted hover:border-cyan-500/40 hover:bg-cyan-950/20 hover:text-cyan-200/80"
            disabled={disabled}
            key={action.label}
            onClick={() => void onAction(action.value)}
            variant="ghost"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
