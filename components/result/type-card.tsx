import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface TypeCardProps {
  typeCode: string;
  summary: string;
  lowConfidenceNotes: string[];
}

export function TypeCard({ typeCode, summary, lowConfidenceNotes }: TypeCardProps) {
  return (
    <Card className="lab-layer-panel p-5">
      <Badge className="text-lab-accent">简洁总结</Badge>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="type-code text-2xl font-semibold tracking-[0.12em]">{typeCode}</p>
          <p className="mt-2 text-sm text-lab-muted">{summary}</p>
        </div>
      </div>
      {lowConfidenceNotes.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-300/40 bg-amber-950/20 p-3">
          <p className="text-xs text-amber-200">结果解读提示</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100">
            {lowConfidenceNotes.map((note) => (
              <li key={note}>- {note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

