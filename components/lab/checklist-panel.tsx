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
      return `你刚刚提到：${event.payload.message.slice(0, 48)}`;
    }
    if (event.type === "AGENT_A_MESSAGE") {
      return `协作助手建议：${event.payload.message.slice(0, 48)}`;
    }
    return "流程消息";
  });
  const pendingValidations = probeEvents.slice(-3).map((event, index) =>
    event.type === "PROBE_FIRED" ? `待验证点 ${index + 1}：补充一条依据或反例来确认当前判断` : "待验证点",
  );

  return (
    <Card className="lab-layer-panel p-4">
      <Badge className="text-lab-accent">行动检查清单</Badge>

      <div className="mt-3">
        <p className="text-xs text-lab-muted">当前任务目标</p>
        <ul className="mt-2 space-y-1 text-sm">
          {scene.deliverables.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs text-lab-muted">近期判断与依据</p>
        <ul className="mt-2 space-y-1 text-sm text-lab-muted">
          {(confirmedAssumptions.length > 0 ? confirmedAssumptions : ["还没有形成清晰判断，可先列出两种可选方案"]).map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs text-lab-muted">下一步建议动作</p>
        <ul className="mt-2 space-y-1 text-sm text-amber-200">
          {(
            pendingValidations.length > 0
              ? pendingValidations
              : ["先确认约束条件，再比较 2-3 个方案并说明取舍理由"]
          ).map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
