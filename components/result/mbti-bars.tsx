import { MBTI_AXIS_DEFINITIONS } from "@/domain";
import type { MbtiAxisAggregate } from "@/domain/mbti/aggregate";
import { Card } from "@/components/ui/card";

interface MbtiBarsProps {
  axes: MbtiAxisAggregate[];
}

function radarPoint(index: number, score: number): { x: number; y: number } {
  const center = 90;
  const radius = 62 * (Math.abs(score) / 100);
  const angle = (-Math.PI / 2) + index * (Math.PI / 2);
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

export function MbtiBars({ axes }: MbtiBarsProps) {
  const polygon = axes
    .map((axis, index) => {
      const point = radarPoint(index, axis.score);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <Card className="lab-layer-panel p-5">
      <h2 className="text-lg font-semibold">AI-MBTI 轴向视图</h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {axes.map((axis) => {
            const definition = MBTI_AXIS_DEFINITIONS.find((item) => item.id === axis.axisId);
            const leftWidth = `${Math.max(0, -axis.score)}%`;
            const rightWidth = `${Math.max(0, axis.score)}%`;
            return (
              <div key={axis.axisId}>
                <div className="mb-1 flex justify-between text-xs text-lab-muted">
                  <span>{definition?.labelZh ?? axis.axisId}</span>
                  <span className="type-code">{axis.score.toFixed(1)}</span>
                </div>
                <div className="relative h-5 rounded bg-lab-panel">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-lab-border" />
                  <div
                    className="absolute right-1/2 top-0 h-full rounded-l bg-cyan-400/45"
                    style={{ width: leftWidth }}
                  />
                  <div
                    className="absolute left-1/2 top-0 h-full rounded-r bg-violet-400/45"
                    style={{ width: rightWidth }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center">
          <svg height="180" viewBox="0 0 180 180" width="180">
            <circle cx="90" cy="90" fill="none" r="62" stroke="rgba(84,102,128,0.6)" />
            <line stroke="rgba(84,102,128,0.6)" x1="90" x2="90" y1="26" y2="154" />
            <line stroke="rgba(84,102,128,0.6)" x1="26" x2="154" y1="90" y2="90" />
            <polygon fill="rgba(93,208,255,0.22)" points={polygon} stroke="rgba(93,208,255,0.8)" />
          </svg>
        </div>
      </div>
    </Card>
  );
}

