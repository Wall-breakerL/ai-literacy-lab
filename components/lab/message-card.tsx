import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

type MessageRole = "user" | "agent" | "system";

interface MessageCardProps {
  role: MessageRole;
  content: string;
  timestamp: string;
  sceneLabel: string;
  stageLabel?: string;
}

export function MessageCard({ role, content, timestamp, sceneLabel, stageLabel }: MessageCardProps) {
  return (
    <article
      className={cn(
        "rounded-xl border p-3",
        role === "user" && "border-cyan-300/35 bg-cyan-950/25",
        role === "agent" && "border-lab bg-lab-panel",
        role === "system" && "border-violet-300/25 bg-violet-950/20",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge>{role === "user" ? "你" : role === "agent" ? "Agent A" : "System"}</Badge>
        <Badge>{sceneLabel}</Badge>
        {stageLabel ? <Badge>{stageLabel}</Badge> : null}
        <span className="type-code ml-auto text-[11px] text-lab-muted">{timestamp}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
    </article>
  );
}
