"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ResearchTag } from "@/domain/research/annotation";

const TAGS: ResearchTag[] = [
  "criteria_first",
  "hidden_blocker_spotted",
  "brief_consistency_check",
  "global_reset",
  "local_patch",
  "synthesize_fragments",
];

interface SessionListItem {
  sessionId: string;
  updatedAt: string;
  assessmentState: string;
}

interface ReplayItem {
  eventId: string;
  timestamp: string;
  sceneId: "apartment-tradeoff" | "brand-naming-sprint";
  type: "user" | "agent" | "stage_changed" | "probe";
  content: string;
}

interface ReplayView {
  scenes: Array<{ sceneId: "apartment-tradeoff" | "brand-naming-sprint"; title: string; items: ReplayItem[] }>;
}

interface TurnAnnotation {
  id: string;
  sessionId: string;
  turnEventId: string;
  sceneId: "apartment-tradeoff" | "brand-naming-sprint";
  labels: ResearchTag[];
  note: string;
  updatedAt: string;
}

export default function AnnotatePage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [replay, setReplay] = useState<ReplayView | null>(null);
  const [annotations, setAnnotations] = useState<TurnAnnotation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/dev/sessions");
      if (!response.ok) return;
      const data = (await response.json()) as { sessions: SessionListItem[] };
      setSessions(data.sessions);
      if (data.sessions[0]) setActiveSessionId(data.sessions[0].sessionId);
    })();
  }, []);

  const turns = useMemo(() => {
    const items = replay?.scenes.flatMap((scene) =>
      scene.items.filter((item) => item.type === "user" || item.type === "agent").map((item) => ({ ...item, sceneId: scene.sceneId })),
    );
    return items ?? [];
  }, [replay]);

  const loadData = async () => {
    if (!activeSessionId) return;
    setError(null);
    try {
      const replayResponse = await fetch(`/api/dev/replay/${activeSessionId}`);
      if (!replayResponse.ok) throw new Error("回放加载失败");
      setReplay((await replayResponse.json()) as ReplayView);
      const annotationResponse = await fetch(`/api/dev/annotations?sessionId=${activeSessionId}`);
      if (!annotationResponse.ok) throw new Error("标注加载失败");
      const annotationData = (await annotationResponse.json()) as { annotations: TurnAnnotation[] };
      setAnnotations(annotationData.annotations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  };

  const saveAnnotation = async (turn: ReplayItem, labels: ResearchTag[]) => {
    const note = annotations.find((item) => item.turnEventId === turn.eventId)?.note ?? "";
    const response = await fetch("/api/dev/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: activeSessionId,
        turnEventId: turn.eventId,
        sceneId: turn.sceneId,
        labels,
        note,
      }),
    });
    if (response.ok) {
      await loadData();
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Research Annotate</h1>
      <Card className="mt-4 flex flex-wrap items-center gap-3 p-4">
        <select
          className="rounded border border-lab bg-lab-panel px-3 py-2 text-sm"
          onChange={(event) => setActiveSessionId(event.target.value)}
          value={activeSessionId}
        >
          {sessions.map((session) => (
            <option key={session.sessionId} value={session.sessionId}>
              {session.sessionId}
            </option>
          ))}
        </select>
        <Button onClick={() => void loadData()} variant="primary">
          加载 Turn
        </Button>
      </Card>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {turns.map((turn) => {
          const current = annotations.find((item) => item.turnEventId === turn.eventId);
          return (
            <Card key={turn.eventId}>
              <p className="type-code text-xs text-lab-accent">
                {turn.sceneId} · {turn.timestamp}
              </p>
              <p className="mt-1 text-sm">{turn.content}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TAGS.map((tag) => {
                  const active = current?.labels.includes(tag);
                  return (
                    <button
                      className={`rounded border px-2 py-1 text-xs ${active ? "border-cyan-300/70 bg-cyan-950/30" : "border-lab bg-lab-panel"}`}
                      key={tag}
                      onClick={() => {
                        const next = active ? (current?.labels ?? []).filter((item) => item !== tag) : [...(current?.labels ?? []), tag];
                        if (next.length > 0) {
                          void saveAnnotation(turn, next);
                        }
                      }}
                      type="button"
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

