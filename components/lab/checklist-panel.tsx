import type { SceneBlueprint, SessionEvent } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ChecklistPanelProps {
  scene: SceneBlueprint;
  events: SessionEvent[];
}

export function ChecklistPanel({ scene, events }: ChecklistPanelProps) {
  const messageEvents = events.filter((event) =>
    (event.type === "USER_MESSAGE" || event.type === "AGENT_A_MESSAGE") && event.payload.sceneId === scene.id,
  );
  const probeEvents = events.filter((event) => event.type === "PROBE_FIRED" && event.payload.sceneId === scene.id);

  const confirmedAssumptions = messageEvents.slice(-2).map((event) => {
    if (event.type === "USER_MESSAGE") {
      return `用户：${event.payload.message.slice(0, 48)}`;
    }
    if (event.type === "AGENT_A_MESSAGE") {
      return `Agent A：${event.payload.message.slice(0, 48)}`;
    }
    return "系统消息";
  });
  const pendingValidations = probeEvents
    .slice(-3)
    .map((event) => (event.type === "PROBE_FIRED" ? `Probe: ${event.payload.probeId}` : "Probe"));

  return (
    <Card className="lab-layer-panel p-4">
      <Badge className="text-lab-accent">Checklist</Badge>

      <div className="mt-3">
        <p className="type-code text-xs text-lab-muted">当前 Scene 检查项</p>
        <ul className="mt-2 space-y-1 text-sm">
          {scene.deliverables.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="type-code text-xs text-lab-muted">已确认假设</p>
        <ul className="mt-2 space-y-1 text-sm text-lab-muted">
          {(confirmedAssumptions.length > 0 ? confirmedAssumptions : ["尚未形成稳定假设"]).map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="type-code text-xs text-lab-muted">待验证项</p>
        <ul className="mt-2 space-y-1 text-sm text-amber-200">
          {(pendingValidations.length > 0 ? pendingValidations : ["暂无待验证 probe"]).map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
