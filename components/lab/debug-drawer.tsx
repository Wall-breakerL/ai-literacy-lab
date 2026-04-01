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
        <p className="text-xs text-lab-muted">高级视图（研究与调试）</p>
        <Button className="px-2 py-1 text-xs" onClick={onToggle} variant="subtle">
          {open ? "隐藏" : "展开"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 text-xs">
          <p className="type-code">currentSceneId: {snapshot?.currentSceneId ?? "-"}</p>
          <p className="type-code">
            currentStage: {snapshot?.sceneStates.find((item) => item.sceneId === snapshot.currentSceneId)?.stageId ?? "-"}
          </p>
          <p className="type-code">
            scenePhase / workingSummary:{" "}
            {(() => {
              const run = snapshot?.sceneStates.find((item) => item.sceneId === snapshot?.currentSceneId);
              if (!run) return "-";
              return `${run.scenePhase} · ${(run.workingSummaryZh ?? "").slice(0, 80)}`;
            })()}
          </p>
          <p className="type-code">
            openProbeObjective:{" "}
            {snapshot?.sceneStates.find((i) => i.sceneId === snapshot?.currentSceneId)?.openProbeObjectiveZh ?? "—"}
          </p>
          <p className="type-code">assessmentProgress: {snapshot?.assessmentState ?? "-"}</p>
          <p className="type-code">上一回合触发追问 id: {turnOutput?.firedProbeIds.join(", ") || "-"}</p>
          <p className="type-code">上一回合规则信号: {turnOutput?.ruleSignals.join(", ") || "-"}</p>
          <p className="type-code">
            上一回合评分增量:{" "}
            {turnOutput?.probeDeltas.length ? JSON.stringify(turnOutput.probeDeltas) : "-"}
          </p>
          <div>
            <p className="mb-1 text-[11px] text-lab-muted">可读提示</p>
            <ul className="list-inside list-disc space-y-1 text-[11px] text-lab-muted/90">
              <li>若「上一回合触发追问 id」非空，说明系统在后台插入了一条自然协作追问（用户侧不显示为挑战面板）。</li>
              <li>评分增量来自「日常协作」或「追问回应」事件，可在结果页高级视图查看分数来源。</li>
            </ul>
          </div>
          <pre className="max-h-48 overflow-auto rounded border border-lab bg-black/25 p-2 text-[11px]">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      ) : null}
    </Card>
  );
}
