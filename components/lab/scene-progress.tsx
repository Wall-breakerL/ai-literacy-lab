import type { SceneBlueprint, SceneRunState } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface SceneProgressProps {
  scene: SceneBlueprint;
  run: SceneRunState;
}

export function SceneProgress({ scene, run }: SceneProgressProps) {
  const currentIndex = Math.max(
    0,
    scene.stages.findIndex((stage) => stage.id === run.stageId),
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-lab-muted">当前 Scene</p>
          <h2 className="text-base font-semibold">{scene.titleZh}</h2>
        </div>
        <Badge>{run.completed ? "已完成" : "进行中"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {scene.stages.map((stage, index) => (
          <div
            className={cn(
              "rounded-lg border px-2 py-2 text-xs",
              index < currentIndex && "border-emerald-300/50 bg-emerald-950/25 text-emerald-100",
              index === currentIndex && "border-cyan-300/50 bg-cyan-950/25 text-cyan-100",
              index > currentIndex && "border-lab bg-lab-panel text-lab-muted",
            )}
            key={stage.id}
          >
            <p className="type-code text-[11px] uppercase">{stage.id}</p>
            <p className="mt-1">{stage.titleZh}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
