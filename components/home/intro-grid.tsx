import { Card } from "@/components/ui/card";

export function IntroGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Card className="lab-layer-panel p-4">
        <p className="type-code text-xs text-lab-accent">这不是考试</p>
        <p className="mt-2 text-sm text-lab-muted">没有标准答案压力，不考 AI 知识点，重点是你的协作过程与修正能力。</p>
      </Card>
      <Card className="lab-layer-panel p-4">
        <p className="type-code text-xs text-lab-accent">连续双任务</p>
        <p className="mt-2 text-sm text-lab-muted">同一 session 内连续完成租房权衡与品牌命名，观察你在不同任务中的迁移和调整。</p>
      </Card>
      <Card className="lab-layer-panel p-4">
        <p className="type-code text-xs text-lab-accent">结果呈现方式</p>
        <p className="mt-2 text-sm text-lab-muted">
          结果会同时呈现 AI-MBTI 风格偏好与 FAA 适应能力。AI-MBTI 仅代表当前情境，不代表稳定人格。
        </p>
      </Card>
    </section>
  );
}
