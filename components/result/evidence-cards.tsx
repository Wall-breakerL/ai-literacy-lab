import { Card } from "@/components/ui/card";

interface EvidenceCardsProps {
  items: Array<{ dimensionId: string; label: string; evidence: Array<{ sceneId: string; excerpt: string; probeId: string }> }>;
}

function sceneLabel(sceneId: string): string {
  return sceneId === "apartment-tradeoff" ? "任务 1" : "任务 2";
}

export function EvidenceCards({ items }: EvidenceCardsProps) {
  return (
    <Card className="lab-layer-panel p-5">
      <h2 className="text-lg font-semibold">关键证据摘录</h2>
      <p className="mt-1 text-xs text-lab-muted">以下引文用于支撑结论，帮助你理解建议从何而来。</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-lg border border-lab bg-lab-panel p-4" key={item.dimensionId}>
            <p className="type-code text-xs text-lab-accent">{item.label}</p>
            <div className="mt-2 space-y-2">
              {(item.evidence.length > 0
                ? item.evidence
                : [{ sceneId: "unknown", excerpt: "证据不足，暂未形成可引用片段。", probeId: "-" }]
              ).map((evidence) => (
                <blockquote className="rounded border border-lab/80 bg-black/20 p-2 text-sm text-lab-muted" key={`${item.dimensionId}-${evidence.probeId}-${evidence.excerpt}`}>
                  <p>“{evidence.excerpt}”</p>
                  <p className="mt-1 text-[11px] text-lab-accent">{sceneLabel(evidence.sceneId)} 片段</p>
                </blockquote>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

