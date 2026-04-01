import type { SessionEvent } from "@/domain";

export function DebugScoringTrace({ events }: { events: SessionEvent[] }) {
  const observations = events
    .filter((event): event is Extract<SessionEvent, { type: "OBSERVATION_RECORDED" }> => event.type === "OBSERVATION_RECORDED")
    .slice(-5)
    .reverse();

  if (observations.length === 0) {
    return <p className="text-[11px] text-lab-muted/80">暂无 observation。</p>;
  }

  return (
    <div className="space-y-2">
      {observations.map((event) => (
        <div className="rounded border border-lab/40 p-2 text-[11px]" key={event.payload.observationId}>
          <p>{event.payload.signalIds.join(", ")}</p>
          <p className="text-lab-muted/80">{event.payload.rationale}</p>
        </div>
      ))}
    </div>
  );
}

