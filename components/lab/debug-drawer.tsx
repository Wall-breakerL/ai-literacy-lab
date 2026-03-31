import type { SessionState, TurnOutput } from "@/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DebugDrawerProps {
  open: boolean;
  snapshot: SessionState | null;
  turnOutput: TurnOutput | null;
  onToggle: () => void;
}

export function DebugDrawer({ open, snapshot, turnOutput, onToggle }: DebugDrawerProps) {
  return (
    <Card className="lab-layer-panel p-4">
      <div className="flex items-center justify-between">
        <p className="type-code text-xs text-lab-muted">DEBUG</p>
        <Button className="px-2 py-1 text-xs" onClick={onToggle} variant="subtle">
          {open ? "隐藏" : "展开"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 text-xs">
          <p className="type-code">currentSceneId: {snapshot?.currentSceneId ?? "-"}</p>
          <p className="type-code">
            currentStage: {snapshot?.sceneStates.find((item) => item.sceneId === snapshot.currentSceneId)?.stageId ?? "-"}
          </p>
          <p className="type-code">assessmentProgress: {snapshot?.assessmentState ?? "-"}</p>
          <p className="type-code">fired probe ids: {turnOutput?.firedProbeIds.join(", ") || "-"}</p>
          <p className="type-code">rule signals: {turnOutput?.ruleSignals.join(", ") || "-"}</p>
          <p className="type-code">
            axis delta / FAA delta:{" "}
            {turnOutput?.probeDeltas.length ? JSON.stringify(turnOutput.probeDeltas) : "-"}
          </p>
          <pre className="max-h-48 overflow-auto rounded border border-lab bg-black/25 p-2 text-[11px]">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      ) : null}
    </Card>
  );
}
