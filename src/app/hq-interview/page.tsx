"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText, Loader2 } from "lucide-react";
import type { HQReport, Message } from "@/lib/types";
import { ChatBubble } from "@/components/ChatBubble";
import {
  API_RETRY_MAX_ATTEMPTS,
  isRetryableApiFailure,
  nextRetryDelayMs,
  sleepAbortable,
} from "@/lib/clientApiRetry";

function isHqReportPayload(data: unknown): data is HQReport {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (typeof o.overall !== "string" || typeof o.scores !== "object" || o.scores === null) return false;
  const s = o.scores as Record<string, unknown>;
  if (typeof s.total !== "number" || typeof s.level !== "string") return false;
  return Array.isArray(o.dimensions) && o.dimensions.length > 0;
}

const CLIENT_HQ_CHAT_MAX_ATTEMPTS = 5;
const CLIENT_HQ_CHAT_RETRY_DELAY_MS = 20_000;
const CLIENT_HQ_HINT_AFTER_FAILURES = 1;

type HqChatApiSuccess = {
  agentAMessage: string;
  agentAModel?: string;
  isComplete: boolean;
};

function isHqChatApiSuccess(data: unknown): data is HqChatApiSuccess {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.agentAMessage === "string" && typeof d.isComplete === "boolean";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function fetchHqChatOnce(
  messages: Message[],
  signal?: AbortSignal
): Promise<{ ok: true; data: HqChatApiSuccess } | { ok: false; retryable: boolean; message: string }> {
  try {
    const res = await fetch("/api/hq-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      const retryable = res.status >= 500 || res.status === 429 || res.status === 0;
      return { ok: false, retryable, message: !res.ok ? `HTTP ${res.status}` : "响应解析失败" };
    }

    if (res.ok) {
      if (!isHqChatApiSuccess(data)) {
        return { ok: false, retryable: true, message: "返回数据不完整，将重试" };
      }
      return { ok: true, data };
    }

    const rec = data as Record<string, unknown>;
    const isConfig = res.status === 503 && rec?.error === "configuration";
    const hint =
      typeof rec?.detail === "string" && rec.detail.trim()
        ? rec.detail.trim()
        : (rec?.error as string) ?? `HTTP ${res.status}`;
    const retryable =
      !isConfig &&
      (res.status === 502 || res.status === 504 || res.status === 429 || res.status === 408 || res.status >= 500);
    return { ok: false, retryable, message: hint };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    if (e instanceof TypeError) return { ok: false, retryable: true, message: e.message || "网络异常" };
    return { ok: false, retryable: true, message: e instanceof Error ? e.message : "未知错误" };
  }
}

export default function HQInterviewPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingNotice, setTypingNotice] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const triggerTurn = useCallback(async (currentMessages: Message[], options?: { signal?: AbortSignal }) => {
    const signal = options?.signal;
    inFlightRef.current += 1;
    setIsTyping(true);
    setTypingNotice(null);

    try {
      let lastMessage = "未知错误";
      let failureCount = 0;
      const turnStartMs = performance.now();

      for (let attempt = 1; attempt <= CLIENT_HQ_CHAT_MAX_ATTEMPTS; attempt++) {
        if (signal?.aborted) return;

        const result = await fetchHqChatOnce(currentMessages, signal);
        if (result.ok) {
          const { data } = result;
          const thinkDurationSec = (performance.now() - turnStartMs) / 1000;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.agentAMessage,
              model: data.agentAModel ?? "qwen-plus",
              thinkDurationSec,
            },
          ]);
          setIsComplete(data.isComplete);
          return;
        }

        failureCount += 1;
        if (failureCount >= CLIENT_HQ_HINT_AFTER_FAILURES) {
          setTypingNotice("网络较差，暂时无法获得模型回复");
        }

        lastMessage = result.message;
        if (!result.retryable || attempt >= CLIENT_HQ_CHAT_MAX_ATTEMPTS) {
          throw new Error(lastMessage);
        }

        await sleep(CLIENT_HQ_CHAT_RETRY_DELAY_MS, signal);
      }

      throw new Error(lastMessage);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("HQ interview error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", model: "qwen-plus", content: "抱歉，没能拿到访谈回复。请稍后再试。" },
      ]);
    } finally {
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) {
        setIsTyping(false);
        setTypingNotice(null);
      }
    }
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping || isComplete) return;

    const newMessages = [...messagesRef.current, { role: "user" as const, content: inputValue.trim() }];
    setMessages(newMessages);
    setInputValue("");
    void triggerTurn(newMessages);
  };

  const handleGenerateReport = async () => {
    if (isGeneratingReport || !isComplete) return;
    const transcript = messagesRef.current;
    setReportError(null);
    setIsGeneratingReport(true);
    let lastErr = "生成报告失败，请重试。";

    try {
      for (let attempt = 0; attempt < API_RETRY_MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch("/api/hq-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: transcript }),
          });

          let data: unknown = {};
          try {
            data = await res.json();
          } catch {
            data = {};
          }

          const rec = data as Record<string, unknown>;
          const detail =
            typeof rec?.detail === "string" && rec.detail.trim()
              ? rec.detail.trim()
              : typeof rec?.error === "string"
                ? rec.error
                : `HTTP ${res.status}`;

          if (!res.ok) {
            lastErr = detail;
            if (isRetryableApiFailure(res.status, detail) && attempt < API_RETRY_MAX_ATTEMPTS - 1) {
              await sleepAbortable(nextRetryDelayMs(attempt));
              continue;
            }
            break;
          }

          if (!isHqReportPayload(data)) {
            lastErr = "报告格式异常，正在重试…";
            if (attempt < API_RETRY_MAX_ATTEMPTS - 1) {
              await sleepAbortable(nextRetryDelayMs(attempt));
              continue;
            }
            break;
          }

          sessionStorage.setItem("hq_report", JSON.stringify(data));
          router.push("/hq-report");
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          lastErr = msg;
          const networkLike =
            err instanceof TypeError ||
            /fetch|network|Failed to fetch|Load failed|ECONNRESET|ETIMEDOUT/i.test(msg);
          if (networkLike && attempt < API_RETRY_MAX_ATTEMPTS - 1) {
            await sleepAbortable(nextRetryDelayMs(attempt));
            continue;
          }
          break;
        }
      }

      setReportError(lastErr);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    void triggerTurn([], { signal: ac.signal });
    return () => ac.abort();
  }, [triggerTurn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-screen bg-void max-w-3xl mx-auto">
      <header className="flex-shrink-0 h-[72px] flex items-center px-6 border-b border-[rgba(255,255,255,0.06)] bg-[#07080a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          <h1 className="text-[14px] font-semibold tracking-[0.2px] text-light-gray">AI-HQ 访谈</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} />
        ))}
        {isTyping && (
          <ChatBubble
            message={{ role: "assistant", content: "" }}
            isTyping
            typingPrimaryLabel="思考中…"
            typingNotice={typingNotice}
          />
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="flex-shrink-0 p-6 bg-void border-t border-[rgba(255,255,255,0.06)] space-y-2">
        {reportError && <p className="text-sm text-red-400">{reportError}</p>}
        {isComplete ? (
          <button
            type="button"
            onClick={() => void handleGenerateReport()}
            disabled={isGeneratingReport}
            className="w-full h-[52px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-[16px] rounded-pill tracking-[0.3px] flex items-center justify-center gap-2 transition-all"
          >
            {isGeneratingReport ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                生成报告中…
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                生成 AI-HQ 报告
              </>
            )}
          </button>
        ) : (
          <div className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入你的回答… 完成后点击右侧按钮发送"
              className="w-full bg-surface-100 border border-[rgba(255,255,255,0.08)] rounded-[12px] px-4 py-4 pr-14 text-[16px] text-near-white placeholder:text-dim-gray focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] resize-none shadow-card-ring min-h-[60px] max-h-[200px] transition-all"
              rows={1}
              disabled={isTyping}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className="absolute right-3 bottom-3 p-2 bg-[#1b1c1e] text-near-white rounded-[8px] border border-[rgba(255,255,255,0.06)] hover:bg-[#252829] disabled:opacity-50 disabled:hover:bg-[#1b1c1e] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
