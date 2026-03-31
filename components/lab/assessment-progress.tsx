import type { AssessmentFlowState } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const STEPS: Array<{ id: AssessmentFlowState; label: string }> = [
  { id: "onboarding", label: "Onboarding" },
  { id: "apartment", label: "Scene 1" },
  { id: "bridge", label: "Transition" },
  { id: "brand", label: "Scene 2" },
  { id: "synthesis", label: "Synthesis" },
  { id: "completed", label: "Completed" },
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
          <p className="text-xs text-lab-muted">Human-AI Performance Lab</p>
          <h1 className="text-lg font-semibold">连续人机协作实验</h1>
        </div>
        <Badge className="text-lab-accent">Session {sessionId}</Badge>
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
