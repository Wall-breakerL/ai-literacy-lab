import { Card } from "@/components/ui/card";

export function IntroGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="lab-layer-panel p-4">
        <p className="text-xs text-lab-muted">这是什么</p>
        <p className="mt-2 text-sm text-lab-muted">一个双任务协作原型，用于演示和迭代人机协作体验。</p>
      </Card>
      <Card className="lab-layer-panel p-4">
        <p className="text-xs text-lab-muted">为什么有用</p>
        <p className="mt-2 text-sm text-lab-muted">在真实模型尚未完整接入前，你仍可体验任务流程、输入反馈节奏与结果结构。</p>
      </Card>
    </section>
  );
}
