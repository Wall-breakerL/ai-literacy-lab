import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const FLOW_STEPS = ["阅读任务说明", "任务 1：租房权衡", "过渡", "任务 2：品牌命名", "查看结果"] as const;

export function TestFlow() {
  return (
    <Card className="lab-layer-panel p-5">
      <p className="text-xs text-lab-muted">流程是怎样的</p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {FLOW_STEPS.map((step, index) => (
          <div className="rounded-lg border border-lab bg-lab-panel px-3 py-2 text-center text-xs" key={step}>
            <p className="text-[11px] text-lab-muted">步骤 {index + 1}</p>
            <p className="mt-1">{step}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge>任务 1：Apartment Trade-off</Badge>
        <span className="text-xs text-lab-muted">{"->"}</span>
        <Badge>任务 2：Brand Naming Sprint</Badge>
      </div>
      <p className="mt-3 text-sm text-lab-muted">全程约 12-15 分钟。两个任务按固定顺序自动推进，无需手动切换。</p>
    </Card>
  );
}
