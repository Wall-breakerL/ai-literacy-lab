import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const FLOW_STEPS = ["进入实验", "租房任务", "过渡", "品牌任务", "结果"] as const;

export function TestFlow() {
  return (
    <Card className="lab-layer-panel p-5">
      <p className="type-code text-xs text-lab-accent">一次完整测试怎么进行</p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {FLOW_STEPS.map((step, index) => (
          <div className="rounded-lg border border-lab bg-lab-panel px-3 py-2 text-center text-xs" key={step}>
            <p className="type-code text-[11px] text-lab-muted">Step {index + 1}</p>
            <p className="mt-1">{step}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge>Scene 1: Apartment Trade-off</Badge>
        <span className="text-xs text-lab-muted">{"->"}</span>
        <Badge>Scene 2: Brand Naming Sprint</Badge>
      </div>
      <p className="mt-3 text-sm text-lab-muted">两个任务仅做预告，不可选择切换。系统会在同一条流程中自动推进到下一段。</p>
    </Card>
  );
}
