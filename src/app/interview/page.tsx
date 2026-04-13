"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText } from "lucide-react";
import { Message, AgentBOutput } from "@/lib/types";
import { ChatBubble } from "@/components/ChatBubble";
import { ProgressIndicator } from "@/components/ProgressIndicator";

/** 客户端对 /api/chat 的最大尝试次数（含首次请求），应对网络抖动与偶发 502。 */
const CLIENT_CHAT_MAX_ATTEMPTS = 5;
/** 每次失败后、发起下一次请求前的固定等待时间。 */
const CLIENT_CHAT_RETRY_DELAY_MS = 20_000;
/** 连续失败达到此次数后，在「思考中」下显示网络提示（1 = 第一次失败即显示；仍会继续重试直至上限）。 */
const CLIENT_CHAT_HINT_AFTER_FAILURES = 1;

type ChatApiSuccess = {
  agentAMessage: string;
  agentAModel?: string;
  agentBOutput: AgentBOutput;
  isComplete: boolean;
};

function isChatApiSuccess(data: unknown): data is ChatApiSuccess {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.agentAMessage !== "string") return false;
  if (typeof d.isComplete !== "boolean") return false;
  const out = d.agentBOutput;
  if (!out || typeof out !== "object") return false;
  const cov = (out as { analysis?: { coverage?: unknown } }).analysis?.coverage;
  if (!cov || typeof cov !== "object") return false;
  return (["Relation", "Workflow", "Epistemic", "RepairScope"] as const).every(
    (k) => typeof (cov as Record<string, unknown>)[k] === "string"
  );
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

/** 单次请求；configuration 503 等不可通过重试修复的情况标记为不可重试。 */
async function fetchChatOnce(
  body: { messages: Message[]; identity: string; roundCount: number },
  signal?: AbortSignal
): Promise<
  | { ok: true; data: ChatApiSuccess }
  | { ok: false; retryable: boolean; message: string }
> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      const retryable = res.status >= 500 || res.status === 429 || res.status === 0;
      return {
        ok: false,
        retryable,
        message: !res.ok ? `HTTP ${res.status}` : "响应解析失败",
      };
    }

    if (res.ok) {
      if (!isChatApiSuccess(data)) {
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
      (res.status === 502 ||
        res.status === 504 ||
        res.status === 429 ||
        res.status === 408 ||
        res.status >= 500);

    return { ok: false, retryable, message: hint };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    if (e instanceof TypeError) {
      return { ok: false, retryable: true, message: e.message || "网络异常" };
    }
    return {
      ok: false,
      retryable: true,
      message: e instanceof Error ? e.message : "未知错误",
    };
  }
}

export default function InterviewPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingNotice, setTypingNotice] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [coverage, setCoverage] = useState<AgentBOutput["analysis"]["coverage"]>({
    Relation: "uncovered",
    Workflow: "uncovered",
    Epistemic: "uncovered",
    RepairScope: "uncovered",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(0);

  const triggerTurn = useCallback(
    async (
      currentMessages: Message[],
      id: string,
      currentRound: number,
      options?: { signal?: AbortSignal }
    ) => {
      const signal = options?.signal;
      inFlightRef.current += 1;
      setIsTyping(true);
      setTypingNotice(null);

      try {
        const body = {
          messages: currentMessages,
          identity: id,
          roundCount: currentRound,
        };

        let lastMessage = "未知错误";
        let failureCount = 0;

        for (let attempt = 1; attempt <= CLIENT_CHAT_MAX_ATTEMPTS; attempt++) {
          if (signal?.aborted) return;

          const result = await fetchChatOnce(body, signal);
          if (result.ok) {
            const { data } = result;
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: data.agentAMessage,
                model: data.agentAModel ?? "qwen-plus",
              },
            ]);
            setCoverage(data.agentBOutput.analysis.coverage);
            setIsComplete(data.isComplete);
            setRoundCount(currentRound + 1);
            return;
          }

          failureCount += 1;
          // 第一次请求失败起即在「思考中」下提示（仍会按间隔重试到上限）。
          if (failureCount >= CLIENT_CHAT_HINT_AFTER_FAILURES) {
            setTypingNotice("网络较差，暂时无法获得模型回复");
          }

          lastMessage = result.message;
          if (!result.retryable || attempt >= CLIENT_CHAT_MAX_ATTEMPTS) {
            throw new Error(lastMessage);
          }

          // 每次可重试失败后固定等待再发下一轮请求（与 CLIENT_CHAT_RETRY_DELAY_MS 一致）。
          await sleep(CLIENT_CHAT_RETRY_DELAY_MS, signal);
        }

        throw new Error(lastMessage);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            model: "qwen-plus",
            content: "抱歉，没能拿到访谈回复。请稍后再试。",
          },
        ]);
      } finally {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) {
          setIsTyping(false);
          setTypingNotice(null);
        }
      }
    },
    []
  );

  useEffect(() => {
    const storedIdentity = sessionStorage.getItem("ai_mbti_identity");
    if (!storedIdentity) {
      router.push("/");
      return;
    }
    setIdentity(storedIdentity);

    const ac = new AbortController();
    void triggerTurn([], storedIdentity, 0, { signal: ac.signal });
    return () => ac.abort();
  }, [router, triggerTurn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, typingNotice]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping || isComplete) return;

    const newMessages = [...messages, { role: "user", content: inputValue } as Message];
    setMessages(newMessages);
    setInputValue("");

    triggerTurn(newMessages, identity, roundCount);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const goToReport = () => {
    sessionStorage.setItem("ai_mbti_history", JSON.stringify(messages));
    router.push("/report");
  };

  return (
    <div className="flex flex-col h-screen bg-void max-w-3xl mx-auto">
      <header className="flex-shrink-0 h-[72px] flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.06)] bg-[#07080a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-raycast-red shadow-[0_0_8px_rgba(255,99,99,0.5)]" />
          <h1 className="text-[14px] font-semibold tracking-[0.2px] text-light-gray">
            深度访谈进行中
          </h1>
        </div>
        <ProgressIndicator coverage={coverage} />
      </header>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} />
        ))}
        {isTyping && (
          <ChatBubble
            message={{ role: "assistant", content: "" }}
            isTyping={true}
            typingNotice={typingNotice}
          />
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="flex-shrink-0 p-6 bg-void border-t border-[rgba(255,255,255,0.06)]">
        {isComplete ? (
          <button
            onClick={goToReport}
            className="w-full h-[52px] bg-[hsla(0,0%,100%,0.9)] hover:bg-white text-[#18191a] font-semibold text-[16px] rounded-pill tracking-[0.3px] flex items-center justify-center gap-2 transition-all shadow-button-native"
          >
            <FileText className="w-5 h-5" />
            生成我的 AI-MBTI 报告
          </button>
        ) : (
          <div className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的回答... (Shift + Enter 换行)"
              className="w-full bg-surface-100 border border-[rgba(255,255,255,0.08)] rounded-[12px] px-4 py-4 pr-14 text-[16px] text-near-white placeholder:text-dim-gray focus:outline-none focus:border-raycast-blue focus:ring-1 focus:ring-[rgba(85,179,255,0.15)] resize-none shadow-card-ring min-h-[60px] max-h-[200px] transition-all"
              rows={1}
            />
            <button
              onClick={handleSend}
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
