import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResultGuideProps {
  sessionId: string;
}

export function ResultGuide({ sessionId: _sessionId }: ResultGuideProps) {
  return (
    <Card className="lab-layer-panel p-5">
      <Badge className="text-lab-accent">阅读指南</Badge>
      <h2 className="mt-3 text-lg font-semibold">协作结果解读</h2>
      <p className="mt-2 text-sm text-lab-muted">
        以下结果基于你在本次双任务中的协作表现计算得出，用于帮助你了解自己与 AI 协作时的风格与适应力。
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/15 p-4">
          <p className="text-sm font-medium text-cyan-200/90">AI-MBTI 是什么</p>
          <p className="mt-1.5 text-xs text-lab-muted leading-relaxed">
            AI-MBTI 描述你在当前任务情境下表现出的协作风格偏好，是一组描述性标签，<strong className="text-cyan-200/70">不代表稳定的人格特质</strong>。四个字母分别对应：关系取向、工作流程、认知方式、修正倾向。
          </p>
        </div>

        <div className="rounded-lg border border-violet-500/25 bg-violet-950/15 p-4">
          <p className="text-sm font-medium text-violet-200/90">FAA 五维是什么</p>
          <p className="mt-1.5 text-xs text-lab-muted leading-relaxed">
            FAA（AI Adaptability Assessment）衡量你在陌生任务中与 AI 协作的适应能力，五个维度分别是：情境感知（SI）、约束推理（RC）、逻辑组织（LO）、策略更新（SR）、创意迭代（CI）。
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-lab/50 bg-lab-panel/40 p-4">
        <p className="text-sm font-medium text-lab-muted">关于结果的一句话</p>
        <p className="mt-1.5 text-xs text-lab-muted leading-relaxed">
          这些指标基于你在两个任务中的协作行为计算，反映的是<strong className="text-lab-muted/90">本次特定任务下的表现</strong>，不等同于能力测评或对你作为决策者的全面评判。结果供你参考，帮助你反思协作过程，而非作为对他人的评价依据。
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-lab-muted/60">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>数据来源：对话行为记录 + 场景内探针响应 · 仅供原型体验使用</span>
      </div>
    </Card>
  );
}
