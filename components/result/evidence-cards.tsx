import { Card } from "@/components/ui/card";

interface EvidenceCardsProps {
  items: Array<{ dimensionId: string; label: string; evidence: Array<{ sceneId: string; excerpt: string; probeId: string }> }>;
}

function sceneLabel(sceneId: string): string {
  return sceneId === "apartment-tradeoff" ? "任务 1" : "任务 2";
}

export function EvidenceCards({ items }: EvidenceCardsProps) {
  const excerpts = items
    .flatMap((item) =>
      item.evidence.map((evidence) => ({
        key: `${item.dimensionId}-${evidence.probeId}-${evidence.excerpt}`,
        label: item.label,
        sceneId: evidence.sceneId,
        excerpt: evidence.excerpt,
      })),
    )
    .slice(0, 3);

  return (
    <Card className="lab-layer-panel p-5">
      <h2 className="text-lg font-semibold">关键证据摘录</h2>
      <p className="mt-1 text-xs text-lab-muted">默认展示 3 条与你结论最相关的对话片段。</p>
      <div className="mt-4 space-y-3">
        {(excerpts.length > 0
          ? excerpts
          : [{ key: "fallback", label: "系统提示", sceneId: "unknown", excerpt: "证据不足，暂未形成可引用片段。" }]
        ).map((item) => (
          <blockquote className="rounded border border-lab/80 bg-black/20 p-3 text-sm text-lab-muted" key={item.key}>
            <p>“{item.excerpt}”</p>
            <p className="mt-1 text-[11px] text-lab-accent">
              {item.label} · {sceneLabel(item.sceneId)} 片段
            </p>
          </blockquote>
        ))}
      </div>
    </Card>
  );
}

