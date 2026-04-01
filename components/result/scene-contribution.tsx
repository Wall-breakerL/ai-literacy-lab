import { Card } from "@/components/ui/card";
import type { SessionResultPayload } from "@/server/services/build-session-result";

interface SceneContributionProps {
  items: SessionResultPayload["sceneContribution"];
}

export function SceneContribution({ items }: SceneContributionProps) {
  return (
    <Card className="lab-layer-panel p-5">
      <h2 className="text-lg font-semibold">分任务贡献明细</h2>
      <p className="mt-1 text-xs text-lab-muted">用于查看每个任务在各维度上的影响，适合深入复盘时参考。</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((scene) => (
          <div className="rounded-lg border border-lab bg-lab-panel p-4" key={scene.sceneId}>
            <p className="type-code text-xs text-lab-accent">{scene.title}</p>
            <p className="mt-2 text-xs text-lab-muted">MBTI 信号</p>
            <ul className="mt-1 space-y-1 text-sm">
              {Object.entries(scene.mbti).map(([axisId, value]) => (
                <li key={axisId}>
                  {axisId}: <span className="type-code">{value.toFixed(1)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-lab-muted">FAA 信号</p>
            <ul className="mt-1 space-y-1 text-sm">
              {Object.entries(scene.faa).map(([dimensionId, value]) => (
                <li key={dimensionId}>
                  {dimensionId}: <span className="type-code">{value.toFixed(1)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-lab-muted">协作追问记录 id（研究/调试）：{scene.probeIds.join(", ") || "-"}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

