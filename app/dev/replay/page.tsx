"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SessionListItem {
  sessionId: string;
  updatedAt: string;
  assessmentState: string;
}

interface ReplayItem {
  eventId: string;
  timestamp: string;
  sceneId: string;
  type: "user" | "agent" | "stage_changed" | "probe";
  content: string;
  probeId?: string;
  mbtiDeltas?: Record<string, number>;
  faaScores?: Record<string, number>;
}

interface ReplayScene {
  sceneId: string;
  title: string;
  items: ReplayItem[];
}

interface ReplayView {
  sessionId: string;
  assessmentState: string;
  scenes: ReplayScene[];
  dividers: Array<{ fromSceneId: string; toSceneId: string; timestamp: string }>;
}

export default function ReplayPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [replay, setReplay] = useState<ReplayView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/dev/sessions");
    if (!response.ok) throw new Error("加载 session 列表失败");
    const data = (await response.json()) as { sessions: SessionListItem[] };
    setSessions(data.sessions);
    if (!activeSessionId && data.sessions[0]) {
      setActiveSessionId(data.sessions[0].sessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleLoad = async () => {
    if (!activeSessionId) return;
    setError(null);
    setReplay(null);
    try {
      const response = await fetch(`/api/dev/replay/${activeSessionId}`);
      if (!response.ok) {
        throw new Error("会话不存在或加载失败");
      }
      const data = (await response.json()) as ReplayView;
      setReplay(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  };

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-6 py-10 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit p-4">
        <h1 className="text-xl font-semibold">Research Replay</h1>
        <p className="mt-1 text-sm text-lab-muted">按 scene 分段回放并查看 probe/delta。</p>
        <Button className="mt-3 w-full" onClick={() => void loadSessions()} variant="subtle">
          刷新 Session 列表
        </Button>
        <div className="mt-3 space-y-2">
          {sessions.map((session) => (
            <button
              className={`w-full rounded border px-3 py-2 text-left text-xs ${activeSessionId === session.sessionId ? "border-cyan-300/60 bg-cyan-950/30" : "border-lab bg-lab-panel"}`}
              key={session.sessionId}
              onClick={() => setActiveSessionId(session.sessionId)}
              type="button"
            >
              <p className="type-code">{session.sessionId}</p>
              <p className="mt-1 text-lab-muted">{session.assessmentState}</p>
            </button>
          ))}
        </div>
        <Button className="mt-3 w-full" onClick={handleLoad} variant="primary">
          加载回放
        </Button>
      </Card>
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      {replay ? (
        <section className="space-y-4">
          {replay.scenes.map((scene, index) => (
            <Card key={scene.sceneId}>
              <p className="type-code text-xs text-lab-accent">{scene.title}</p>
              <div className="mt-3 space-y-2">
                {scene.items.map((item) => (
                  <div className="rounded border border-lab bg-lab-panel p-3 text-xs" key={item.eventId}>
                    <p className="type-code text-lab-muted">{item.timestamp}</p>
                    <p className="mt-1">
                      [{item.type}] {item.content}
                    </p>
                    {item.probeId ? (
                      <p className="mt-1 type-code text-lab-accent">
                        probe: {item.probeId} | mbti: {JSON.stringify(item.mbtiDeltas)} | faa: {JSON.stringify(item.faaScores)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {index === 0 && replay.dividers[0] ? (
                <div className="mt-4 rounded-lg border border-cyan-300/40 bg-cyan-950/20 px-3 py-2 text-sm">
                  Scene Divider: 第一段完成，进入第二段（{replay.dividers[0].timestamp}）
                </div>
              ) : null}
            </Card>
          ))}
        </section>
      ) : null}
    </main>
  );
}
