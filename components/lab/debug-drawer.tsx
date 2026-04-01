import type { SessionEvent, SessionState, TurnOutput } from "@/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildProbeLifecycleDebugView } from "@/lib/probe-lifecycle-debug";

interface DebugDrawerProps {
  open: boolean;
  snapshot: SessionState | null;
  events: SessionEvent[];
  turnOutput: TurnOutput | null;
  onToggle: () => void;
}

export function DebugDrawer({ open, snapshot, events, turnOutput, onToggle }: DebugDrawerProps) {
  const sceneId = snapshot?.currentSceneId;
  const lifecycle = sceneId ? buildProbeLifecycleDebugView(events, sceneId) : null;

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
            internalStageId (legacy):{" "}
            {snapshot?.sceneStates.find((item) => item.sceneId === snapshot.currentSceneId)?.stageId ?? "-"}
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

          {lifecycle ? (
            <div className="rounded-lg border border-lab/60 bg-black/20 p-2">
              <p className="mb-2 font-medium text-lab-muted">追问实例生命周期（当前场景）</p>
              {lifecycle.openInstances.length === 0 ? (
                <p className="text-[11px] text-lab-muted/80">当前无未结案实例（idle / 无 open probe）。</p>
              ) : (
                <ul className="space-y-2 text-[11px]">
                  {lifecycle.openInstances.map((p) => (
                    <li className="border-b border-lab/40 pb-2 last:border-0" key={p.probeInstanceId}>
                      <span className="text-amber-200/90">awaiting_response</span> ·{" "}
                      <span className="type-code">{p.probeInstanceId}</span> · {p.probeId} ({p.weight})
                      <div className="mt-1 text-lab-muted/90">意图预览：{p.hiddenObjectivePreview}</div>
                      <div className="mt-1 text-lab-muted/70">
                        {p.timeline.map((t) => (
                          <div key={`${t.at}-${t.label}`}>
                            <span className="text-cyan-200/80">{t.at.slice(11, 19)}</span> {t.label}: {t.detail}
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {lifecycle.recentClosed.length > 0 ? (
                <div className="mt-3 border-t border-lab/40 pt-2">
                  <p className="mb-1 text-[11px] text-lab-muted">最近已结案实例</p>
                  <ul className="space-y-2 text-[11px]">
                    {lifecycle.recentClosed.map((p) => (
                      <li className="border-b border-lab/30 pb-2 last:border-0" key={p.probeInstanceId}>
                        <span className={p.scoreApplied ? "text-emerald-200/90" : "text-lab-muted"}>
                          {p.scoreApplied ? "closed · scored" : "closed · no_score"}
                        </span>{" "}
                        · <span className="type-code">{p.probeInstanceId}</span> · {p.probeId}
                        <div className="mt-1 text-lab-muted/80">{p.closeReason?.slice(0, 160)}</div>
                        <div className="mt-1 text-lab-muted/70">
                          {p.timeline.map((t) => (
                            <div key={`${t.at}-${t.label}-${t.detail.slice(0, 20)}`}>
                              <span className="text-cyan-200/80">{t.at.slice(11, 19)}</span> {t.label}: {t.detail}
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {lifecycle.recentEvaluations.length > 0 ? (
                <div className="mt-3 border-t border-lab/40 pt-2">
                  <p className="mb-1 text-[11px] text-lab-muted">EVALUATION_SCORE_APPLIED（无 instanceId，按时间）</p>
                  <ul className="space-y-1 text-[11px] text-lab-muted/90">
                    {lifecycle.recentEvaluations.map((ev) => (
                      <li key={`${ev.at}-${ev.reason.slice(0, 24)}`}>
                        <span className="text-cyan-200/80">{ev.at.slice(11, 19)}</span> · {ev.sourceType ?? "—"} ·{" "}
                        {ev.reason.slice(0, 120)}
                        {ev.excerpt ? <span className="block pl-2 text-lab-muted/70">摘录：{ev.excerpt.slice(0, 80)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="type-code">上一回合触发追问 id: {turnOutput?.firedProbeIds.join(", ") || "-"}</p>
          <p className="type-code">上一回合规则信号: {turnOutput?.ruleSignals.join(", ") || "-"}</p>
          <p className="type-code">
            上一回合评分增量:{" "}
            {turnOutput?.probeDeltas.length ? JSON.stringify(turnOutput.probeDeltas) : "-"}
          </p>
          <div>
            <p className="mb-1 text-[11px] text-lab-muted">可读提示</p>
            <ul className="list-inside list-disc space-y-1 text-[11px] text-lab-muted/90">
              <li>fired：已写入 PROBE_FIRED；awaiting：等待用户下一条消息后由 Agent B 判 probe_resolution。</li>
              <li>closed · scored：PROBE_CLOSED 且 reducer 应用了 mbti/faa；另有 EVALUATION_SCORE_APPLIED 为日常协作分。</li>
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
