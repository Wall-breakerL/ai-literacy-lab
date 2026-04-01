import type { SceneBlueprint } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ChecklistPanelProps {
  scene: SceneBlueprint;
}

/**
 * 默认不向用户暴露内部探针/挑战机制；仅保留任务相关的核验与交付提示。
 */
export function ChecklistPanel({ scene }: ChecklistPanelProps) {
  const dc = scene.decisionContext;

  return (
    <Card className="lab-layer-panel p-4">
      <Badge className="text-lab-accent">任务核对</Badge>
      <p className="mt-2 text-xs text-lab-muted">
        这里只放与决策相关的核对清单：哪些事实已确认、哪些必须先问清楚再下结论。
      </p>

      <div className="mt-4">
        <p className="text-xs font-medium text-lab-muted">本场景交付物</p>
        <ul className="mt-2 space-y-1 text-sm text-lab-muted">
          {scene.deliverables.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      {dc?.mustVerifyQuestions && dc.mustVerifyQuestions.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-amber-200/90">建议优先落实的追问</p>
          <ul className="mt-2 space-y-1 text-sm text-lab-muted">
            {dc.mustVerifyQuestions.slice(0, 8).map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!dc && scene.id === "brand-naming-sprint" ? (
        <div className="mt-4">
          <p className="text-xs text-lab-muted">命名 brief 要点</p>
          <ul className="mt-2 space-y-1 text-sm text-lab-muted">
            {scene.internalFacts.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
