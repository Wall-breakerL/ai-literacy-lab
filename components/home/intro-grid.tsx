import { Card } from "@/components/ui/card";

export function IntroGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Card className="lab-layer-panel p-4">
        <p className="text-xs text-lab-muted">这是什么</p>
        <p className="mt-2 text-sm text-lab-muted">一个 2 段式的人机协作测评流程，观察你如何与 AI 共同推进复杂任务。</p>
      </Card>
      <Card className="lab-layer-panel p-4">
        <p className="text-xs text-lab-muted">为什么有用</p>
        <p className="mt-2 text-sm text-lab-muted">连续场景能看出你是否会迁移策略、校正判断，并在不确定情境下保持稳定协作。</p>
      </Card>
      <Card className="lab-layer-panel p-4">
        <p className="text-xs text-lab-muted">你会得到什么</p>
        <p className="mt-2 text-sm text-lab-muted">简洁总结、关键优势、主要盲点、可执行建议，以及对应的行为证据摘录。</p>
      </Card>
    </section>
  );
}
