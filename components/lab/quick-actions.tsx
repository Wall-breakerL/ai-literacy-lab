import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  { label: "先列关键约束", value: "先列关键约束，并标注硬约束与软约束。" },
  { label: "做成比较矩阵", value: "把当前方案做成比较矩阵，并说明取舍理由。" },
  { label: "总结当前方案", value: "总结当前方案，给出风险与待验证项。" },
];

interface QuickActionsProps {
  disabled?: boolean;
  onAction: (message: string) => Promise<void>;
}

export function QuickActions({ disabled, onAction }: QuickActionsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-lab-muted">快捷插入（会作为一条用户消息发送，不单独推进阶段）</p>
      <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => (
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
