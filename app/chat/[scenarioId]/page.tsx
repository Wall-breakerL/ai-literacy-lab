"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2, SendHorizonal } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import type { ScenarioBlueprint } from "@/lib/scenario-v2/types";
import { isTwoPhaseBlueprint } from "@/lib/scenario-v2/types";
import { ensureBrowserUserId } from "@/lib/session-user";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SESSION_STORAGE_KEY_V2,
  type ChatPhase,
  type PersistedSessionV2,
} from "@/lib/memory/session-storage";

const RESULT_STORAGE_KEY = "ai-literacy-last-result";

function generateSessionId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}`;
}

type ScenarioFetch = { kind: "blueprint"; blueprint: ScenarioBlueprint };

function ChatPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenarioId = typeof params.scenarioId === "string" ? params.scenarioId : null;

  const [payload, setPayload] = useState<ScenarioFetch | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [phase, setPhase] = useState<ChatPhase>("main");
  const [debriefIndex, setDebriefIndex] = useState(0);
  const [debriefInput, setDebriefInput] = useState("");
  const [showTaskCard, setShowTaskCard] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);

  const [identityId, setIdentityId] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const debug = searchParams.get("debug") === "1";

  // Two-phase state
  const [talkPrompt, setTalkPrompt] = useState<string | undefined>(undefined);
  const [talkPromptInput, setTalkPromptInput] = useState("");
  const [showPhaseSwitchCard, setShowPhaseSwitchCard] = useState(false);

  const bp = payload?.blueprint ?? null;
  const twoPhase = bp ? isTwoPhaseBlueprint(bp) : false;

  useEffect(() => {
    const fromQ = searchParams.get("identityId");
    const fromStore =
      typeof window !== "undefined" ? window.localStorage.getItem("ai-literacy-identity-id") : null;
    setIdentityId(fromQ ?? fromStore ?? undefined);
    const uq = searchParams.get("userId");
    setUserId(uq ?? (typeof window !== "undefined" ? ensureBrowserUserId() : undefined));
  }, [searchParams]);

  const debriefQuestions = bp?.debriefQuestions ?? [];
  const defaultTalkPrompt = (() => {
    if (!bp?.phases?.talk) return "请围绕 AI 能力边界、可靠性与人机分工展开讨论。";
    if (bp.phases.talk.defaultTalkPrompt?.trim()) return bp.phases.talk.defaultTalkPrompt.trim();
    return "请围绕 AI 能力边界、可靠性与人机分工展开讨论。";
  })();

  const persistSession = useCallback(() => {
    if (!scenarioId || !sessionIdRef.current) return;
    const data: PersistedSessionV2 = {
      sessionId: sessionIdRef.current,
      scenarioId,
      identityId,
      phase,
      messages,
      debriefIndex,
      debriefQuestions,
      talkPrompt,
    };
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY_V2, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [scenarioId, identityId, phase, messages, debriefIndex, debriefQuestions, talkPrompt]);

  useEffect(() => {
    if (!scenarioId || !hydratedRef.current) return;
    persistSession();
  }, [scenarioId, persistSession]);

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    fetch(`/api/scenarios/${scenarioId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ScenarioFetch | null) => {
        if (cancelled || !data || data.kind !== "blueprint") {
          if (!cancelled) setPayload(null);
          return;
        }
        setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, router]);

  useEffect(() => {
    if (payload === undefined || payload === null || !scenarioId) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY_V2);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedSessionV2;
        if (saved.scenarioId === scenarioId) {
          sessionIdRef.current = saved.sessionId;
          setMessages(saved.messages ?? []);
          const savedTalkPrompt = saved.talkPrompt?.trim() || "";
          setTalkPrompt(savedTalkPrompt || undefined);
          setTalkPromptInput(savedTalkPrompt);
          if (saved.phase === "debrief") {
            setPhase("debrief");
          } else if (saved.phase === "talk") {
            setPhase("talk");
          } else if (saved.phase === "helper") {
            setPhase("helper");
          } else {
            setPhase("main");
          }
          setDebriefIndex(saved.debriefIndex ?? 0);
          return;
        }
      }
    } catch {
      /* ignore */
    }

    if (!sessionIdRef.current) sessionIdRef.current = generateSessionId();

    const initialPhase: ChatPhase = twoPhase ? "helper" : "main";
    setPhase(initialPhase);

    if (messages.length === 0) {
      const opening = twoPhase
        ? payload.blueprint.phases!.helper.openingMessage
        : payload.blueprint.openingMessage;
      setMessages([{ role: "assistant", content: opening }]);
    }
  }, [payload, scenarioId, messages.length, twoPhase]);

  useEffect(() => {
    listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight);
  }, [messages, loading, phase, showPhaseSwitchCard]);

  // Derive contextual info based on current phase
  const situationalHint = (() => {
    if (payload === undefined) return copy.chat.loading;
    if (payload === null) return copy.chat.loadFailed;
    if (twoPhase && phase === "helper") {
      const ws = payload.blueprint.phases!.helper.worldState;
      return ws.slice(0, 200) + (ws.length > 200 ? "…" : "");
    }
    if (twoPhase && phase === "talk") {
      return (talkPrompt?.trim() || defaultTalkPrompt).slice(0, 200);
    }
    const ws = payload.blueprint.worldState;
    return ws.slice(0, 200) + (ws.length > 200 ? "…" : "");
  })();

  const phaseLabel = twoPhase
    ? phase === "helper"
      ? copy.chat.phaseHelperLabel
      : phase === "talk"
        ? copy.chat.phaseTalkLabel
        : undefined
    : undefined;

  // Current probes for debug view
  const currentProbes = (() => {
    if (!bp) return [];
    if (twoPhase) {
      if (phase === "helper") return bp.phases!.helper.hiddenProbes;
      if (phase === "talk") return bp.phases!.talk.hiddenProbes;
      return [];
    }
    return bp.hiddenProbes;
  })();

  // Count user turns in current phase
  const userTurnsInPhase = (() => {
    if (!twoPhase || phase !== "helper") return messages.filter((m) => m.role === "user").length;
    // Count from start of helper phase messages
    return messages.filter((m) => m.role === "user").length;
  })();

  const canSwitchPhase =
    twoPhase &&
    phase === "helper" &&
    bp?.phaseSwitchPolicy &&
    userTurnsInPhase >= bp.phaseSwitchPolicy.minPhase1UserTurns;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !scenarioId || loading || ending) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextThread = [...messages, userMessage];
    setMessages(nextThread);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextThread,
          scenarioId,
          identityId,
          phase: twoPhase ? phase : undefined,
          talkPrompt: phase === "talk" ? talkPrompt : undefined,
        }),
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

  function handleStartTalkPhase() {
    if (!bp?.phases?.talk) return;
    const fromInput = talkPromptInput.trim();
    const finalPrompt = fromInput || defaultTalkPrompt;
    setTalkPrompt(finalPrompt);
    setShowPhaseSwitchCard(false);
    setPhase("talk");

    const talkOpening = bp.phases.talk.openingMessage;
    const openingWithPrompt = `${talkOpening}\n\n[本段讨论引导]\n${finalPrompt}`;
    setMessages((prev) => [...prev, { role: "assistant", content: openingWithPrompt }]);
  }

  async function runEvaluate(finalMessages: ChatMessage[]) {
    if (!scenarioId || ending) return;
    if (!sessionIdRef.current) sessionIdRef.current = generateSessionId();
    const sessionId = sessionIdRef.current;

    setEnding(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scenarioId,
          messages: finalMessages,
          identityId,
          userId,
          includeRawJudge: debug,
          talkPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "评估失败");
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(data));
        window.localStorage.removeItem(SESSION_STORAGE_KEY_V2);
      }
      router.push("/result");
    } catch (err) {
      setEnding(false);
      alert(err instanceof Error ? err.message : "评估失败，请重试");
    }
  }

  function handleDebriefSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = debriefInput.trim();
    if (!text || !debriefQuestions[debriefIndex]) return;
    const q = debriefQuestions[debriefIndex];
    const block = `[收尾反思]\n问题：${q}\n回答：${text}`;
    const nextMessages = [...messages, { role: "user" as const, content: block }];
    setMessages(nextMessages);
    setDebriefInput("");
    if (debriefIndex + 1 >= debriefQuestions.length) {
      setPhase("main");
      void runEvaluate(nextMessages);
    } else {
      setDebriefIndex((i) => i + 1);
    }
  }

  function startDebrief() {
    setPhase("debrief");
    setDebriefIndex(0);
  }

  const isConversationPhase = phase === "main" || phase === "helper" || phase === "talk";

  if (!scenarioId) {
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {copy.chat.taskLabel}
                </p>
                {phaseLabel && (
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
                    {phaseLabel}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowTaskCard((v) => !v)}
              >
                {showTaskCard ? "收起提示" : "展开情境提示"}
              </Button>
            </div>
            {showTaskCard && (
              <>
                <CardTitle className="text-base font-medium">背景</CardTitle>
                <CardDescription className="text-sm leading-relaxed">{situationalHint}</CardDescription>
              </>
            )}
          </CardHeader>
        </Card>

        {debug && payload && currentProbes.length > 0 && (
          <Card className="mb-3 border-dashed bg-muted/40 p-3 text-xs">
            <p className="font-semibold">{copy.chat.debugProbes}</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {currentProbes.map((p) => (
                <li key={p.probeId}>
                  {p.probeId}: {p.assistantMove}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Phase switch card: helper → talk */}
        {showPhaseSwitchCard && bp?.phases?.talk && (
          <Card className="mb-4 ring-1 ring-cyan-200/20">
            <CardHeader>
              <CardTitle className="text-base">{copy.chat.phaseSwitchTitle}</CardTitle>
              <CardDescription>{copy.chat.phaseSwitchDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{copy.chat.talkPromptLabel}</p>
              <textarea
                className="border-input bg-background min-h-[96px] w-full rounded-md border px-3 py-2 text-sm"
                value={talkPromptInput}
                onChange={(e) => setTalkPromptInput(e.target.value)}
                placeholder={copy.chat.talkPromptPlaceholder}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleStartTalkPhase}>
                  {copy.chat.goTalk}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTalkPromptInput("");
                    handleStartTalkPhase();
                  }}
                >
                  {copy.chat.goTalkDefault}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "debrief" && debriefIndex < debriefQuestions.length && (
          <Card className="mb-4 ring-1 ring-violet-200/20">
            <CardHeader>
              <CardTitle className="text-base">{copy.chat.debriefTitle}</CardTitle>
              <CardDescription>{copy.chat.debriefHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm font-medium">
                {debriefQuestions[debriefIndex] ?? ""}
              </p>
              <form onSubmit={handleDebriefSubmit} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={debriefInput}
                  onChange={(e) => setDebriefInput(e.target.value)}
                  placeholder="简短回答即可"
                  className="flex-1"
                />
                <Button type="submit" disabled={!debriefInput.trim() || ending}>
                  {debriefIndex + 1 >= debriefQuestions.length ? copy.chat.submitResult : "下一题"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

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

          {isConversationPhase && !showPhaseSwitchCard && (
            <form onSubmit={handleSend} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="text"
                  placeholder={copy.chat.inputPlaceholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading || ending}
                  className="h-12 flex-1"
                />
                <Button type="submit" disabled={loading || ending} className="h-12 shrink-0 gap-2 sm:w-auto">
                  <SendHorizonal className="h-4 w-4" />
                  {copy.chat.send}
                </Button>
              </div>
            </form>
          )}
        </Card>

        <div className="mt-4 space-y-2">
          {ending && <p className="text-sm text-muted-foreground">{copy.chat.endingHint}</p>}

          {/* Two-phase: helper → talk switch button */}
          {canSwitchPhase && !showPhaseSwitchCard && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setShowPhaseSwitchCard(true)}
              disabled={ending || loading}
              className="w-full sm:w-auto"
            >
              {copy.chat.finishHelper}
            </Button>
          )}

          {/* Two-phase: talk → debrief; or single-phase: main → debrief */}
          {((twoPhase && phase === "talk") || (!twoPhase && phase === "main")) && !showPhaseSwitchCard && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={startDebrief}
              disabled={ending || messages.length < 2}
              className="w-full sm:w-auto"
            >
              {copy.chat.goDebrief}
            </Button>
          )}
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
