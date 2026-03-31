import type { SceneBlueprint, SessionEvent } from "@/domain";
import { SCENE_REGISTRY } from "@/domain/assessment/registry";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ChecklistPanelProps {
  scene: SceneBlueprint;
  events: SessionEvent[];
}

function probeLabel(sceneId: string, probeId: string): string {
  const sc = SCENE_REGISTRY[sceneId as keyof typeof SCENE_REGISTRY];
  if (!sc) return probeId;
  return sc.probes.find((p) => p.id === probeId)?.label ?? probeId;
}

export function ChecklistPanel({ scene, events }: ChecklistPanelProps) {
  const fired = events.filter(
    (e): e is Extract<SessionEvent, { type: "PROBE_FIRED" }> =>
      e.type === "PROBE_FIRED" && e.payload.sceneId === scene.id,
  );
  const closed = events.filter(
    (e): e is Extract<SessionEvent, { type: "PROBE_CLOSED" }> =>
      e.type === "PROBE_CLOSED" && e.payload.sceneId === scene.id,
  );
  const closedByInstance = new Map(closed.map((e) => [e.payload.probeInstanceId, e]));

  const awaiting = fired.filter((f) => !closedByInstance.has(f.payload.probeInstanceId));
  const resolved = closed.filter((c) => c.payload.outcome === "resolved");
  const unresolved = closed.filter((c) => c.payload.outcome === "unresolved");

  return (
    <Card className="lab-layer-panel p-4">
      <Badge className="text-lab-accent">任务辅助</Badge>
      <p className="mt-2 text-xs text-lab-muted">
        说明：系统会插入「观察挑战」——你看到的是协作助手用自然语言追问；计分主要看你是否回应了挑战，而不是挑战是否出现。
      </p>

      {scene.decisionContext?.verificationQueue && scene.decisionContext.verificationQueue.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-amber-200/90">场景待核验（来自房源表）</p>
          <ul className="mt-2 space-y-1 text-sm text-lab-muted">
            {scene.decisionContext.verificationQueue.slice(0, 5).map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-xs text-lab-muted">进行中的观察挑战（待回应）</p>
        <ul className="mt-2 space-y-2 text-sm text-amber-200/90">
          {awaiting.length > 0 ? (
            awaiting.slice(-3).map((e) => (
              <li className="border-b border-lab/30 pb-2 last:border-0" key={e.payload.probeInstanceId}>
                <span className="text-cyan-200/80">{probeLabel(scene.id, e.payload.probeId)}</span>
                <div className="mt-1 text-[11px] text-lab-muted/90">{e.payload.triggerReason}</div>
              </li>
            ))
          ) : (
            <li className="text-lab-muted">暂无进行中的挑战。</li>
          )}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs text-lab-muted">已结案</p>
        <ul className="mt-2 space-y-1 text-sm text-lab-muted">
          {resolved.length === 0 && unresolved.length === 0 ? (
            <li>- 尚无记录</li>
          ) : (
            <>
              {resolved.slice(-4).map((e) => (
                <li key={e.id}>
                  - {probeLabel(scene.id, e.payload.probeId)}（已回应并计分）
                </li>
              ))}
              {unresolved.slice(-2).map((e) => (
                <li key={e.id}>
                  - {probeLabel(scene.id, e.payload.probeId)}（未计分结案）
                </li>
              ))}
            </>
          )}
        </ul>
      </div>
    </Card>
  );
}
