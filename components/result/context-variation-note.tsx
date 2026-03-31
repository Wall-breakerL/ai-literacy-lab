import { Card } from "@/components/ui/card";

interface ContextVariationNoteProps {
  items: Array<{ axisId: string; status: "stable" | "sensitive" | "insufficient"; note: string }>;
}

export function ContextVariationNote({ items }: ContextVariationNoteProps) {
  return (
    <Card className="lab-layer-panel p-5">
      <h2 className="text-lg font-semibold">跨情境稳定性提示</h2>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div className="rounded-lg border border-lab bg-lab-panel px-3 py-2" key={item.axisId}>
            <p className="type-code text-xs text-lab-accent">
              {item.axisId} / {item.status}
            </p>
            <p className="mt-1 text-sm text-lab-muted">{item.note}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

