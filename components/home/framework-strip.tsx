import { Card } from "@/components/ui/card";

export function FrameworkStrip() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="lab-layer-panel p-5">
        <p className="text-xs text-lab-muted">理论框架（扩展阅读）</p>
        <h2 className="mt-2 text-lg font-semibold">交互风格偏好</h2>
        <p className="mt-2 text-sm leading-6 text-lab-muted">
          AI-MBTI 描述你在当前任务里与 AI 协作时的倾向，例如如何分工、如何验证、如何修正。它不是稳定人格标签。
        </p>
      </Card>
      <Card className="lab-layer-panel p-5">
        <p className="text-xs text-lab-muted">理论框架（扩展阅读）</p>
        <h2 className="mt-2 text-lg font-semibold">陌生任务适应力</h2>
        <p className="mt-2 text-sm leading-6 text-lab-muted">FAA 关注你在新问题中的适应、重构、信息整合与迭代节奏，而不是单次对错。</p>
      </Card>
    </section>
  );
}
