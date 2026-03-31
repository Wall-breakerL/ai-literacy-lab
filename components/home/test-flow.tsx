import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function TestFlow() {
  return (
    <Card className="lab-layer-panel p-5">
      <p className="text-xs text-lab-muted">流程是怎样的</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge>任务 1：Apartment Trade-off</Badge>
        <span className="text-xs text-lab-muted">{"->"}</span>
        <Badge>任务 2：Brand Naming Sprint</Badge>
      </div>
      <p className="mt-3 text-sm text-lab-muted">
        流程包含任务输入、协作反馈和结果概览。原型阶段耗时可能波动，若中途异常可刷新或重新创建会话。
      </p>
    </Card>
  );
}
