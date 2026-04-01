import type { SessionState } from "@/domain";
import { SCENE_BLUEPRINT_BY_ID } from "@/domain";
import { cn } from "@/lib/cn";

interface StageIndicatorProps {
  snapshot: SessionState;
}

export function StageIndicator({ snapshot }: StageIndicatorProps) {
  const currentScene = snapshot.sceneStates.find(
    (s) => s.sceneId === snapshot.currentSceneId,
  );
  if (!currentScene) return null;

  const blueprint = SCENE_BLUEPRINT_BY_ID[snapshot.currentSceneId];
  const stages = blueprint.stages;
  const currentIndex = stages.findIndex((s) => s.id === currentScene.stageId);
  const nextStage = currentIndex >= 0 && currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-lab-muted">当前阶段</span>
        <span className="text-[11px] text-lab-muted">
          {currentIndex + 1} / {stages.length}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {stages.map((stage, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;
          return (
            <div
              className={cn(
                "flex-1 rounded-full h-1.5 transition-colors",
                isDone && "bg-cyan-400/60",
                isActive && "bg-cyan-400/90",
                !isDone && !isActive && "bg-lab-muted/25",
              )}
              key={stage.id}
              title={`${stage.titleZh}${isDone ? "（已完成）" : isActive ? "（进行中）" : nextStage && index === currentIndex + 1 ? `（下一步）` : ""}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-cyan-200/90">
          {stages[currentIndex]?.titleZh ?? "—"}
        </span>
        {nextStage ? (
          <span className="text-[11px] text-lab-muted">
            下一步：{nextStage.titleZh}
          </span>
        ) : (
          <span className="text-[11px] text-lab-muted">即将完成</span>
        )}
      </div>
    </div>
  );
}
