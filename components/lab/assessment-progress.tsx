import type { AssessmentFlowState } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const STEPS: Array<{ id: AssessmentFlowState; label: string }> = [
  { id: "onboarding", label: "进入流程" },
  { id: "apartment", label: "任务 1" },
  { id: "bridge", label: "过渡" },
  { id: "brand", label: "任务 2" },
  { id: "synthesis", label: "总结" },
  { id: "completed", label: "完成" },
];

interface AssessmentProgressProps {
  assessmentState: AssessmentFlowState;
  sessionId: string;
}

export function AssessmentProgress({ assessmentState, sessionId }: AssessmentProgressProps) {
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.id === assessmentState),
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-lab-muted">Human-AI 协作测评</p>
          <h1 className="text-lg font-semibold">连续双任务协作流程</h1>
        </div>
        <Badge className="text-lab-accent">会话 {sessionId}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
        {STEPS.map((step, index) => (
          <div
            className={cn(
              "rounded-lg border px-2 py-2 text-center text-xs type-code",
              index <= currentIndex
                ? "border-cyan-300/50 bg-cyan-950/25 text-cyan-100"
                : "border-lab bg-lab-panel text-lab-muted",
            )}
            key={step.id}
          >
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}
