import type { SceneBlueprint } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface BriefPanelProps {
  scene: SceneBlueprint;
}

export function BriefPanel({ scene }: BriefPanelProps) {
  return (
    <Card className="lab-layer-panel p-4">
      <Badge className="text-lab-accent">任务说明</Badge>
      <h3 className="mt-2 text-base font-semibold">{scene.titleZh}</h3>
      <p className="mt-2 text-sm text-lab-muted">{scene.briefingZh}</p>

      <div className="mt-4">
        <p className="text-xs text-lab-muted">本段目标</p>
        <ul className="mt-2 space-y-1 text-sm">
          {scene.deliverables.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs text-lab-muted">已知条件</p>
        <ul className="mt-2 space-y-1 text-sm text-lab-muted">
          {scene.internalFacts.slice(0, 4).map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
