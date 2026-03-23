"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2, SendHorizonal } from "lucide-react";
import type { UserProfile, ChatMessage, Scenario } from "@/lib/types";
import { SCENARIO_IDS } from "@/lib/constants";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RESULT_STORAGE_KEY = "ai-literacy-last-result";

function getProfileFromSearchParams(searchParams: URLSearchParams): UserProfile | null {
  const r = searchParams.get("role");
  const l = searchParams.get("level");
  if (
    (r === "student" || r === "general") &&
    (l === "novice" || l === "intermediate")
  ) {
    return { role: r, level: l };
  }
  return null;
}

function generateSessionId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}`;
}

function ChatPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenarioId = typeof params.scenarioId === "string" ? params.scenarioId : null;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [scenario, setScenario] = useState<Scenario | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const sessionIdRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scenarioId) return;
    if (!(SCENARIO_IDS as readonly string[]).includes(scenarioId)) {
      router.replace("/profile");
      return;
    }
    const fromUrl = getProfileFromSearchParams(searchParams);
    if (!fromUrl) {
      router.replace("/profile");
      return;
    }
    setProfile(fromUrl);

    let cancelled = false;
    fetch(`/api/scenarios/${scenarioId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Scenario | null) => {
        if (!cancelled) setScenario(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setScenario(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, searchParams, router]);

  useEffect(() => {
    listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight);
  }, [messages, loading]);

  const visibleTask =
    scenario === undefined ? copy.chat.loading : scenario?.visibleTask ?? copy.chat.loadFailed;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !profile || !scenarioId || loading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextThread = [...messages, userMessage];
    setMessages(nextThread);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextThread, scenarioId, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      const content = data.content ?? "（无回复内容）";
      const thinking = typeof data.thinking === "string" ? data.thinking : undefined;
      setMessages((prev) => [...prev, { role: "assistant", content, thinking }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: copy.chat.errorFallback }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEndConversation() {
    if (!profile || !scenarioId || ending) return;
    if (!sessionIdRef.current) sessionIdRef.current = generateSessionId();
    const sessionId = sessionIdRef.current;

    setEnding(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, scenarioId, profile, messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "评估失败");
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(data));
      }
      router.push("/result");
    } catch (err) {
      setEnding(false);
      alert(err instanceof Error ? err.message : "评估失败，请重试");
    }
  }

  if (!profile || !scenarioId) {
    return (
      <main className="glass-page">
        <p className="text-sm text-muted-foreground">{copy.common.redirecting}</p>
      </main>
    );
  }

  return (
    <main className="glass-page max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="relative mb-5 overflow-hidden ring-1 ring-cyan-200/15">
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent"
            aria-hidden
          />
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.chat.taskLabel}
            </p>
            <CardTitle className="text-base font-medium">当前场景</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{visibleTask}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="relative p-4 ring-1 ring-violet-200/15 md:p-6">
          <div
            ref={listRef}
            className="glass-inset mb-4 max-h-[min(45vh,420px)] min-h-[200px] overflow-y-auto p-3 md:p-4"
          >
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">{copy.chat.taskPlaceholder}</p>
            )}
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className={cn("mb-3 flex", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "inline-block max-w-[88%] rounded-2xl px-4 py-3 text-left text-sm shadow-sm",
                      isUser
                        ? "border border-indigo-400/30 bg-gradient-to-br from-indigo-700 via-violet-700 to-indigo-900 text-white shadow-lg shadow-indigo-600/25"
                        : "border border-indigo-200/40 bg-gradient-to-br from-white/95 via-indigo-50/40 to-violet-50/30 text-card-foreground shadow-md shadow-indigo-500/10 backdrop-blur-md"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    {!isUser && m.thinking && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedThinking((prev) => ({ ...prev, [i]: !prev[i] }))
                          }
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              expandedThinking[i] ? "rotate-180" : "rotate-0"
                            )}
                          />
                          {expandedThinking[i] ? copy.chat.collapseThinking : copy.chat.expandThinking}
                        </button>
                        {expandedThinking[i] && (
                          <div className="mt-2 rounded-lg border border-border bg-muted/60 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                            {m.thinking}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {loading && (
              <div className="glass-inset inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.chat.loading}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="text"
                placeholder={copy.chat.inputPlaceholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="h-12 flex-1"
              />
              <Button type="submit" disabled={loading} className="h-12 shrink-0 gap-2 sm:w-auto">
                <SendHorizonal className="h-4 w-4" />
                {copy.chat.send}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-4 space-y-2">
          {ending && <p className="text-sm text-muted-foreground">{copy.chat.endingHint}</p>}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleEndConversation}
            disabled={ending}
            className="w-full sm:w-auto"
          >
            {ending ? copy.chat.ending : copy.chat.endConversation}
          </Button>
        </div>
      </motion.div>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <main className="glass-page">
          <p className="text-sm text-muted-foreground">{copy.common.redirecting}</p>
        </main>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
