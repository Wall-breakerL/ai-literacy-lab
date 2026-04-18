"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText, Loader2 } from "lucide-react";
import { Message, AgentBOutput, QuestionnaireQuestion, QuestionnaireAnswer } from "@/lib/types";
import { QUESTIONNAIRE_ENTRY_ROUND } from "@/lib/agents";
import { ChatBubble } from "@/components/ChatBubble";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { QuestionnaireCard } from "@/components/QuestionnaireCard";

/** 客户端对 /api/chat 的最大尝试次数（含首次请求），应对网络抖动与偶发 502。 */
const CLIENT_CHAT_MAX_ATTEMPTS = 5;
/** 每次失败后、发起下一次请求前的固定等待时间（普通聊天轮）。 */
const CLIENT_CHAT_RETRY_DELAY_MS = 20_000;
/** 问卷生成轮（roundCount >= 与服务端一致）客户端重试间隔，与 Agent B 问卷重试对齐 */
const CLIENT_QUESTIONNAIRE_GEN_RETRY_DELAY_MS = 60_000;
/** 连续失败达到此次数后，在「思考中」下显示网络提示（1 = 第一次失败即显示；仍会继续重试直至上限）。 */
const CLIENT_CHAT_HINT_AFTER_FAILURES = 1;

type Phase = "chat" | "generating" | "questionnaire" | "complete";

type ChatApiSuccess = {
  agentAMessage: string;
  agentAModel?: string;
  agentBOutput: AgentBOutput;
  isComplete: boolean;
  nextPhase?: "chat" | "questionnaire";
  questions?: QuestionnaireQuestion[];
};

type InterviewDebugRunPayload = {
  sessionId: string;
  identity: string;
  startedAt?: string;
  finishedAt: string;
  transcript: Message[];
};

function isChatApiSuccess(data: unknown): data is ChatApiSuccess {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.agentAMessage !== "string") return false;
  if (typeof d.isComplete !== "boolean") return false;
  const out = d.agentBOutput;
  if (!out || typeof out !== "object") return false;
  const dir = (out as { directive?: unknown }).directive;
  if (!dir || typeof dir !== "object") return false;
  if (typeof (dir as { action?: unknown }).action !== "string") return false;

  // 转问卷：服务端可能不带 coverage，不能用四格 coverage 做强校验
  if (d.nextPhase === "questionnaire") {
    return Array.isArray(d.questions) && d.questions.length > 0;
  }

  const analysis = (out as { analysis?: unknown }).analysis;
  if (analysis !== undefined && analysis !== null && typeof analysis !== "object") {
    return false;
  }
  const cov =
    analysis && typeof analysis === "object"
      ? (analysis as { coverage?: unknown }).coverage
      : undefined;
  // coverage 可选；缺失时在客户端用 normalizeCoverage 补全为四键
  if (cov === undefined || cov === null) return true;
  return typeof cov === "object";
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
  body: {
    messages: Message[];
    roundCount: number;
    debugSessionId?: string;
    debugStartedAt?: string;
  },
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingNotice, setTypingNotice] = useState<string | null>(null);
  const [typingPrimaryLabel, setTypingPrimaryLabel] = useState("思考中…");
  const [isComplete, setIsComplete] = useState(false);
  const [roundCount, setRoundCount] = useState(0);

  // Questionnaire state
  const [phase, setPhase] = useState<Phase>("chat");
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>([]);
  const [questionnaireProgress, setQuestionnaireProgress] = useState({ current: 0, total: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(0);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const debugSessionIdRef = useRef<string>("");
  const savedLocalLogRef = useRef(false);
  const messagesRef = useRef(messages);
  const questionsRef = useRef(questions);
  const answersRef = useRef(answers);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const questionnaireEnterDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 防止同一題 onAnswer 被触发多次（连点 / 旧闭包） */
  const questionnaireAnswerLockRef = useRef(false);

  messagesRef.current = messages;
  questionsRef.current = questions;
  answersRef.current = answers;
  currentQuestionIndexRef.current = currentQuestionIndex;

  const persistLocalDebugRun = useCallback(async (payload: InterviewDebugRunPayload) => {
    try {
      await fetch("/api/local-debug/interview-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn("local debug save failed:", error);
    }
  }, []);

  const triggerTurn = useCallback(
    async (
      currentMessages: Message[],
      currentRound: number,
      options?: { signal?: AbortSignal }
    ) => {
      const signal = options?.signal;
      inFlightRef.current += 1;
      setIsTyping(true);
      setTypingNotice(null);
      const isQuestionnaireGenRound = currentRound >= QUESTIONNAIRE_ENTRY_ROUND;
      setTypingPrimaryLabel(isQuestionnaireGenRound ? "生成问卷中…" : "思考中…");

      try {
        const body = {
          messages: currentMessages,
          roundCount: currentRound,
          debugSessionId: debugSessionIdRef.current,
          debugStartedAt: startedAtRef.current,
        };

        let lastMessage = "未知错误";
        let failureCount = 0;
        const turnStartMs = performance.now();
        const clientRetryDelayMs = isQuestionnaireGenRound
          ? CLIENT_QUESTIONNAIRE_GEN_RETRY_DELAY_MS
          : CLIENT_CHAT_RETRY_DELAY_MS;

        for (let attempt = 1; attempt <= CLIENT_CHAT_MAX_ATTEMPTS; attempt++) {
          if (signal?.aborted) return;

          const result = await fetchChatOnce(body, signal);
          if (result.ok) {
            const { data } = result;
            const thinkDurationSec = (performance.now() - turnStartMs) / 1000;
            const assistantMessage: Message = {
              role: "assistant",
              content: data.agentAMessage,
              model: data.agentAModel ?? "qwen-plus",
              thinkDurationSec,
            };
            const nextTranscript = [...currentMessages, assistantMessage];

            if (data.isComplete && !savedLocalLogRef.current) {
              savedLocalLogRef.current = true;
              void persistLocalDebugRun({
                sessionId: debugSessionIdRef.current,
                identity: "用户",
                startedAt: startedAtRef.current,
                finishedAt: new Date().toISOString(),
                transcript: nextTranscript,
              });
            }

            setMessages((prev) => [
              ...prev,
              assistantMessage,
            ]);

            // Check if we should transition to questionnaire phase
            if (data.nextPhase === "questionnaire" && data.questions && data.questions.length > 0) {
              const totalQ = data.questions.length;
              setPhase("generating");
              setQuestions(data.questions);
              setRoundCount(currentRound + 1);
              setIsTyping(false);
              // 立即重置问卷游标与进度，避免延迟期间旧状态与顶栏「问卷进度」误判（如显示 4/4）
              setCurrentQuestionIndex(0);
              setAnswers([]);
              setQuestionnaireProgress({ current: 1, total: totalQ });
              questionnaireAnswerLockRef.current = false;

              if (questionnaireEnterDelayRef.current) {
                clearTimeout(questionnaireEnterDelayRef.current);
                questionnaireEnterDelayRef.current = null;
              }
              questionnaireEnterDelayRef.current = setTimeout(() => {
                questionnaireEnterDelayRef.current = null;
                questionnaireAnswerLockRef.current = false;
                setPhase("questionnaire");
              }, 1500);
              return;
            }

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

          // 每次可重试失败后固定等待再发下一轮请求（问卷生成轮为 60s，其余 20s）。
          await sleep(clientRetryDelayMs, signal);
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
          setTypingPrimaryLabel("思考中…");
        }
      }
    },
    [persistLocalDebugRun]
  );

  const handleQuestionnaireAnswer = useCallback((score: number) => {
    if (questionnaireAnswerLockRef.current) return;
    const qs = questionsRef.current;
    const idx = currentQuestionIndexRef.current;
    if (idx < 0 || idx >= qs.length) return;

    questionnaireAnswerLockRef.current = true;

    const currentQuestion = qs[idx];
    const newAnswer: QuestionnaireAnswer = {
      dimension: currentQuestion.dimension,
      score,
      question: currentQuestion.question,
      scenario: currentQuestion.scenario,
      reverse: currentQuestion.reverse,
    };
    const newAnswers = [...answersRef.current, newAnswer];
    setAnswers(newAnswers);

    const nextIndex = idx + 1;

    if (nextIndex >= qs.length) {
      setPhase("complete");
      setIsComplete(true);
      sessionStorage.setItem("ai_mbti_history", JSON.stringify(messagesRef.current));
      sessionStorage.setItem("ai_mbti_answers", JSON.stringify(newAnswers));
      questionnaireAnswerLockRef.current = false;
      return;
    }

    setCurrentQuestionIndex(nextIndex);
    setQuestionnaireProgress({ current: nextIndex + 1, total: qs.length });
    queueMicrotask(() => {
      questionnaireAnswerLockRef.current = false;
    });
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping || isComplete || phase !== "chat") return;

    const newMessages = [...messages, { role: "user", content: inputValue } as Message];
    setMessages(newMessages);
    setInputValue("");

    triggerTurn(newMessages, roundCount);
  };

  const goToReport = () => {
    sessionStorage.setItem("ai_mbti_history", JSON.stringify(messages));
    if (answers.length > 0) {
      sessionStorage.setItem("ai_mbti_answers", JSON.stringify(answers));
    }
    router.push("/report");
  };

  // Start first turn on mount
  useEffect(() => {
    startedAtRef.current = new Date().toISOString();
    debugSessionIdRef.current = crypto.randomUUID();
    savedLocalLogRef.current = false;

    const ac = new AbortController();
    void triggerTurn([], 0, { signal: ac.signal });
    return () => ac.abort();
  }, [triggerTurn]);

  useEffect(() => {
    return () => {
      if (questionnaireEnterDelayRef.current) {
        clearTimeout(questionnaireEnterDelayRef.current);
        questionnaireEnterDelayRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, typingNotice]);

  return (
    <div className="flex flex-col h-screen bg-void max-w-3xl mx-auto">
      <header className="flex-shrink-0 h-[72px] flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.06)] bg-[#07080a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-raycast-red shadow-[0_0_8px_rgba(255,99,99,0.5)]" />
          <h1 className="text-[14px] font-semibold tracking-[0.2px] text-light-gray">
            {phase === "chat" ? "深度访谈进行中" : phase === "generating" ? "正在生成问卷" : "AI-MBTI 问卷"}
          </h1>
        </div>
        {phase === "questionnaire" && (
          <ProgressIndicator questionnaireProgress={questionnaireProgress} />
        )}
      </header>

      {/* Chat Phase */}
      {phase === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            {messages.map((msg, idx) => (
              <ChatBubble key={idx} message={msg} />
            ))}
            {isTyping && (
              <ChatBubble
                message={{ role: "assistant", content: "" }}
                isTyping={true}
                typingPrimaryLabel={typingPrimaryLabel}
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
        </>
      )}

      {/* Generating Phase */}
      {phase === "generating" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-raycast-blue animate-spin mb-4" />
          <p className="text-light-gray text-[16px]">正在根据你的背景生成专属问卷...</p>
        </div>
      )}

      {/* Questionnaire Phase */}
      {phase === "questionnaire" && questions.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <QuestionnaireCard
            key={currentQuestionIndex}
            question={questions[currentQuestionIndex]}
            index={currentQuestionIndex}
            total={questions.length}
            onAnswer={handleQuestionnaireAnswer}
          />
        </div>
      )}

      {/* Complete Phase */}
      {phase === "complete" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-raycast-green/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-raycast-green text-2xl">✓</span>
            </div>
            <h2 className="text-[20px] font-medium text-near-white mb-2">问卷完成！</h2>
            <p className="text-dim-gray text-[14px] mb-8">感谢你的耐心回答</p>
            <button
              onClick={goToReport}
              className="w-full max-w-xs h-[52px] bg-[hsla(0,0%,100%,0.9)] hover:bg-white text-[#18191a] font-semibold text-[16px] rounded-pill tracking-[0.3px] flex items-center justify-center gap-2 transition-all shadow-button-native mx-auto"
            >
              <FileText className="w-5 h-5" />
              生成我的 AI-MBTI 报告
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
