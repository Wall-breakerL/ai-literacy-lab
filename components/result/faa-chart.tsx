import { FAA_DIMENSION_DEFINITIONS } from "@/domain";
import type { FaaDimensionAggregate } from "@/domain/faa/aggregate";
import { Card } from "@/components/ui/card";

interface FaaChartProps {
  dimensions: FaaDimensionAggregate[];
  overall: number;
}

export function FaaChart({ dimensions, overall }: FaaChartProps) {
  return (
    <Card className="lab-layer-panel p-5">
      <h2 className="text-lg font-semibold">FAA 五维</h2>
      <p className="type-code mt-1 text-xs text-lab-muted">陌生任务 AI 适配能力（0-100）</p>
      <div className="mt-4 space-y-3">
        {dimensions.map((dimension) => {
          const definition = FAA_DIMENSION_DEFINITIONS.find((item) => item.id === dimension.dimensionId);
          return (
            <div key={dimension.dimensionId}>
              <div className="mb-1 flex justify-between text-xs text-lab-muted">
                <span>{definition?.labelZh ?? dimension.dimensionId}</span>
                <span className="type-code">{dimension.score.toFixed(1)}</span>
              </div>
              <div className="h-3 rounded bg-lab-panel">
                <div className="h-full rounded bg-emerald-400/50" style={{ width: `${dimension.score}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-lab bg-lab-panel p-3">
        <p className="type-code text-xs text-lab-muted">FAA Overall</p>
        <p className="mt-1 type-code text-2xl text-lab-accent">{overall.toFixed(1)}</p>
      </div>
    </Card>
  );
}

