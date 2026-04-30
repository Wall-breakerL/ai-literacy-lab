"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText, Loader2 } from "lucide-react";
import {
  Message,
  AgentBOutput,
  QuestionnaireQuestion,
  QuestionnaireAnswer,
  QuestionnaireBatchKey,
  SessionPhase,
  SessionState,
} from "@/lib/types";
import { QUESTIONNAIRE_ENTRY_ROUND } from "@/lib/researcher";
import {
  applySessionStatePatch,
  createInitialSessionState,
  flattenBatchAnswers,
  flattenQuestionnaireBatches,
  getBatchKeyForPhase,
  getBatchModeForKey,
  getBatchSkipRate,
} from "@/lib/sessionState";
import { ChatBubble } from "@/components/ChatBubble";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { QuestionnaireCard } from "@/components/QuestionnaireCard";
import { readSseResponse } from "@/lib/clientSse";

/** 客户端对 /api/chat 的最大尝试次数（含首次请求），应对网络抖动与偶发 502。 */
const CLIENT_CHAT_MAX_ATTEMPTS = 5;
/** 每次失败后、发起下一次请求前的固定等待时间（普通聊天轮）。 */
const CLIENT_CHAT_RETRY_DELAY_MS = 20_000;
/** 问卷生成客户端重试间隔，与服务端批次生成重试对齐。 */
const CLIENT_QUESTIONNAIRE_GEN_RETRY_DELAY_MS = 60_000;
/** 连续失败达到此次数后，在「思考中」下显示网络提示（1 = 第一次失败即显示；仍会继续重试直至上限）。 */
const CLIENT_CHAT_HINT_AFTER_FAILURES = 1;
/** Claude 说完「开始生成问卷」后，停留在聊天页的过渡时间。 */
const QUESTIONNAIRE_GENERATION_TRANSITION_DELAY_MS = 2_500;

type Phase = "chat" | "generating" | "questionnaire" | "complete";

type QuestionnaireGenerateSuccess = {
  questions: QuestionnaireQuestion[];
  sessionState?: SessionState;
  message?: string;
  source?: "model" | "fallback";
};

type MidDialogOpeningSuccess = {
  message: string;
  source?: "model" | "fallback";
};

type ChatApiSuccess = {
  agentAMessage: string;
  agentAModel?: string;
  agentBOutput: AgentBOutput;
  isComplete: boolean;
  nextPhase?: "chat" | "questionnaire";
  questions?: QuestionnaireQuestion[];
  thinkDurationSec?: number;
  sessionState?: SessionState;
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
    return d.questions === undefined || (Array.isArray(d.questions) && d.questions.length > 0);
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

function visibleAssistantMessageFromChatData(
  data: ChatApiSuccess,
  thinkDurationSec: number
): Message | null {
  const content = data.agentAMessage.trim();
  if (!content) return null;
  return {
    role: "assistant",
    content,
    model: data.agentAModel ?? AGENT_STREAM_MODEL_FALLBACK,
    thinkDurationSec: data.thinkDurationSec ?? thinkDurationSec,
  };
}

function isQuestionnaireGenerateSuccess(data: unknown): data is QuestionnaireGenerateSuccess {
  return Boolean(data && typeof data === "object" && Array.isArray((data as { questions?: unknown }).questions));
}

function isMidDialogOpeningSuccess(data: unknown): data is MidDialogOpeningSuccess {
  return Boolean(
    data &&
      typeof data === "object" &&
      typeof (data as { message?: unknown }).message === "string" &&
      (data as { message: string }).message.trim()
  );
}

function getQuestionnairePhaseForBatch(batchKey: QuestionnaireBatchKey): SessionPhase {
  if (batchKey === "batch1") return "questionnaire_batch1";
  if (batchKey === "batch2") return "questionnaire_batch2";
  return "questionnaire_batch3";
}

function getMidDialogPhaseAfterBatch(batchKey: QuestionnaireBatchKey): SessionPhase | undefined {
  if (batchKey === "batch1") return "mid_dialog1";
  if (batchKey === "batch2") return "mid_dialog2";
  return undefined;
}

function getMidDialogueKeyForPhase(phase: SessionPhase) {
  if (phase === "mid_dialog1") return "dialog1" as const;
  if (phase === "mid_dialog2") return "dialog2" as const;
  return undefined;
}

function getNextBatchKeyForMidDialogPhase(phase: SessionPhase): QuestionnaireBatchKey | undefined {
  if (phase === "mid_dialog1") return "batch2";
  if (phase === "mid_dialog2") return "batch3";
  return undefined;
}

function getBatchNumber(batchKey: QuestionnaireBatchKey): 1 | 2 | 3 {
  if (batchKey === "batch1") return 1;
  if (batchKey === "batch2") return 2;
  return 3;
}

function buildQuestionnaireReadyMessage(batchKey: QuestionnaireBatchKey): string {
  const label =
    batchKey === "batch1"
      ? "第一批习惯题"
      : batchKey === "batch2"
        ? "第二批场景题"
        : "最后一批混合题";
  return `${label}已经准备好了。你可以从下一页开始作答，遇到不贴近的题可以直接选「不了解 / 没想好」。`;
}

function buildMidDialogPrompt(
  batchKey: QuestionnaireBatchKey,
  answers: QuestionnaireAnswer[],
  state: SessionState
): string {
  const skipRate = getBatchSkipRate(answers);
  const skippedSamples = collectSkippedQuestionSamples(batchKey, answers, state);
  const skippedText = formatSkippedQuestionReferences(skippedSamples);

  if (batchKey === "batch1") {
    if (skipRate > 0.5) {
      return skippedText
        ? `看起来刚才的习惯题不太贴近你，比如${skippedText}${skippedSamples.length > 1 ? "这两道题" : "这道题"}。你觉得哪些习惯题不太贴？你平时用 AI 主要做什么？`
        : "看起来刚才的习惯题不太贴近你。你觉得哪些习惯题不太贴？你平时用 AI 主要做什么？";
    }
    if (skipRate >= 0.25) {
      return skippedText
        ? `刚才有几道习惯题你选了「不了解 / 没想好」，比如${skippedText}${skippedSamples.length > 1 ? "这两道题" : "这道题"}。你觉得接下来的场景题，更希望围绕什么任务来问？`
        : "刚才有几道习惯题你选了「不了解 / 没想好」。你觉得接下来的场景题，更希望围绕什么任务来问？";
    }
    return "刚才的习惯题答下来你觉得感觉怎么样？接下来我想问一些具体场景，你平时用 AI 主要在哪些环节用得多？";
  }

  if (skipRate > 0.5) {
    return skippedText
      ? `看起来这些场景题还是不太贴近你，比如${skippedText}${skippedSamples.length > 1 ? "这两道题" : "这道题"}。你觉得这些场景哪里不太贴？你平时用 AI 最常做的是什么？`
      : "看起来这些场景题还是不太贴近你。你觉得这些场景哪里不太贴？你平时用 AI 最常做的是什么？";
  }
  if (skipRate >= 0.25) {
    return skippedText
      ? `刚才有几道场景题你选了「不了解 / 没想好」，比如${skippedText}${skippedSamples.length > 1 ? "这两道题" : "这道题"}。你觉得哪些场景不太贴？或者你更希望问什么场景？`
      : "刚才有几道场景题你选了「不了解 / 没想好」。你觉得哪些场景不太贴？或者你更希望问什么场景？";
  }
  return "这些场景题你觉得感觉怎么样？最后一批你更希望怎么调整场景颗粒度？可以说说想更具体，还是更抽象一些。";
}

function collectSkippedQuestionSamples(
  batchKey: QuestionnaireBatchKey,
  answers: QuestionnaireAnswer[],
  state: SessionState
): QuestionnaireAnswer[] {
  const source = batchKey === "batch2"
    ? [
        ...(state.batchAnswers?.batch2?.length ? state.batchAnswers.batch2 : answers),
        ...(state.batchAnswers?.batch1 ?? []),
      ]
    : answers;
  const seen = new Set<string>();
  return source.filter((answer) => {
    if (!(answer.skipped || answer.score == null)) return false;
    const question = answer.question.trim();
    if (!question) return false;
    const key = question.replace(/\s+/g, "").slice(0, 32);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

function formatSkippedQuestionReferences(samples: QuestionnaireAnswer[]): string {
  if (samples.length === 0) return "";
  return samples
    .slice(0, 2)
    .map((sample) => `「${compactQuestionReference(sample)}」`)
    .join("和");
}

function compactQuestionReference(sample: QuestionnaireAnswer): string {
  const scenarioPrefix = sample.scenario && sample.scenario !== "习惯" ? `${sample.scenario}：` : "";
  const text = `${scenarioPrefix}${sample.question}`.replace(/\s+/g, " ").trim();
  return text.length <= 42 ? text : `${text.slice(0, 41)}…`;
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

function waitForNextPaint(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    let frame1 = 0;
    let frame2 = 0;
    const cleanup = () => {
      if (frame1) window.cancelAnimationFrame(frame1);
      if (frame2) window.cancelAnimationFrame(frame2);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        cleanup();
        resolve();
      });
    });
  });
}

function isQuestionnaireGenerationLeadInTurn(phase: SessionPhase, roundCount: number): boolean {
  return (
    (phase === "interview" && roundCount >= QUESTIONNAIRE_ENTRY_ROUND) ||
    phase === "mid_dialog1" ||
    phase === "mid_dialog2"
  );
}

function usesQuestionnaireGenerationRetry(phase: SessionPhase, roundCount: number): boolean {
  return phase === "interview" && roundCount >= QUESTIONNAIRE_ENTRY_ROUND;
}

/** 单次请求；configuration 503 等不可通过重试修复的情况标记为不可重试。 */
async function fetchChatOnce(
  body: {
    messages: Message[];
    roundCount: number;
    sessionState?: SessionState;
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

async function fetchChatStream(
  body: {
    messages: Message[];
    roundCount: number;
    sessionState?: SessionState;
  },
  signal: AbortSignal | undefined,
  onDelta: (text: string) => void,
  onStatus: (label: string) => void
): Promise<ChatApiSuccess> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
    const data = await res.json().catch(() => ({}));
    const rec = data as Record<string, unknown>;
    throw new Error(
      typeof rec?.detail === "string" ? rec.detail : typeof rec?.error === "string" ? rec.error : `HTTP ${res.status}`
    );
  }

  let donePayload: ChatApiSuccess | null = null;
  let streamError: string | null = null;

  await readSseResponse(res, {
    onEvent(event, data) {
      const payload = data as Record<string, unknown>;
      if (event === "delta" && typeof payload.text === "string") {
        onDelta(payload.text);
      } else if (event === "status" && typeof payload.label === "string") {
        onStatus(payload.label);
      } else if (event === "done") {
        donePayload = payload as ChatApiSuccess;
      } else if (event === "error") {
        streamError = typeof payload.message === "string" ? payload.message : "流式响应失败";
      }
    },
  });

  if (streamError) throw new Error(streamError);
  if (!donePayload || !isChatApiSuccess(donePayload)) {
    throw new Error("流式响应缺少完成事件");
  }
  return donePayload;
}

async function fetchMidDialogOpening(
  completedBatchKey: QuestionnaireBatchKey,
  batchAnswers: QuestionnaireAnswer[],
  sessionState: SessionState
): Promise<MidDialogOpeningSuccess | null> {
  if (completedBatchKey === "batch3") return null;
  const res = await fetch("/api/mid-dialog/opening", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionState,
      completedBatchKey,
      answers: batchAnswers,
    }),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok || !isMidDialogOpeningSuccess(data)) return null;
  return {
    message: data.message.trim(),
    source: data.source,
  };
}

export default function InterviewPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreamingText, setIsStreamingText] = useState(false);
  const [isPreparingQuestionnaireGeneration, setIsPreparingQuestionnaireGeneration] = useState(false);
  const [typingNotice, setTypingNotice] = useState<string | null>(null);
  const [typingPrimaryLabel, setTypingPrimaryLabel] = useState("思考中…");
  const [isComplete, setIsComplete] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [sessionState, setSessionState] = useState<SessionState>(() =>
    createInitialSessionState("pending-session")
  );

  // Questionnaire state
  const [phase, setPhase] = useState<Phase>("chat");
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>([]);
  const [questionnaireProgress, setQuestionnaireProgress] = useState({ current: 0, total: 0 });
  const [generatingBatchKey, setGeneratingBatchKey] = useState<QuestionnaireBatchKey | null>(null);
  const [pendingQuestionnaireBatchKey, setPendingQuestionnaireBatchKey] = useState<QuestionnaireBatchKey | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(0);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const debugSessionIdRef = useRef<string>("");
  const savedLocalLogRef = useRef(false);
  const messagesRef = useRef(messages);
  const questionsRef = useRef(questions);
  const answersRef = useRef(answers);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const sessionStateRef = useRef(sessionState);
  const midDialogStartIndexRef = useRef<number | null>(null);
  const questionnaireEnterDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 防止同一題 onAnswer 被触发多次（连点 / 旧闭包） */
  const questionnaireAnswerLockRef = useRef(false);

  messagesRef.current = messages;
  questionsRef.current = questions;
  answersRef.current = answers;
  currentQuestionIndexRef.current = currentQuestionIndex;
  sessionStateRef.current = sessionState;

  const commitSessionState = useCallback((next: SessionState) => {
    setSessionState(next);
    sessionStateRef.current = next;
    sessionStorage.setItem("ai_mbti_session_state", JSON.stringify(next));
    if (next.background) {
      sessionStorage.setItem(
        "ai_mbti_target_context",
        JSON.stringify({
          role: next.background.role,
          recentUse: next.background.recentUse,
          goal: next.background.goal,
          goalStatus: next.background.goalStatus,
          goalType: next.background.goalType,
        })
      );
    }
  }, []);

  const getFlattenedAnswers = useCallback(
    (state: SessionState = sessionStateRef.current) =>
      flattenBatchAnswers(state.batchAnswers).length > 0
        ? flattenBatchAnswers(state.batchAnswers)
        : state.answers ?? [],
    []
  );

  const persistReportPayload = useCallback(
    (finalAnswers: QuestionnaireAnswer[], finalState: SessionState) => {
      sessionStorage.setItem("ai_mbti_history", JSON.stringify(messagesRef.current));
      sessionStorage.setItem("ai_mbti_answers", JSON.stringify(finalAnswers));
      sessionStorage.setItem("ai_mbti_session_state", JSON.stringify(finalState));
    },
    []
  );

  const enterQuestionnaireBatch = useCallback(
    (
      batchKey: QuestionnaireBatchKey,
      batchQuestions: QuestionnaireQuestion[],
      incomingState?: SessionState,
      readyMessage?: string,
      source?: "model" | "fallback"
    ) => {
      const phaseForBatch = getQuestionnairePhaseForBatch(batchKey);
      const currentState = sessionStateRef.current;
      const baseState: SessionState = incomingState
        ? {
            ...currentState,
            ...incomingState,
            questionnaireBatches: {
              ...(currentState.questionnaireBatches ?? {}),
              ...(incomingState.questionnaireBatches ?? {}),
            },
            batchAnswers: {
              ...(currentState.batchAnswers ?? {}),
              ...(incomingState.batchAnswers ?? {}),
            },
            midDialogues: {
              ...(currentState.midDialogues ?? {}),
              ...(incomingState.midDialogues ?? {}),
            },
          }
        : currentState;
      const nextBatches = {
        ...(baseState.questionnaireBatches ?? {}),
        [batchKey]: batchQuestions,
      };
      const flattenedQuestions = flattenQuestionnaireBatches(nextBatches);
      const nextState: SessionState = {
        ...baseState,
        phase: phaseForBatch,
        questionnaire: flattenedQuestions,
        questionnaireBatches: nextBatches,
      };

      commitSessionState(nextState);
      setPhase("chat");
      setGeneratingBatchKey(null);
      setPendingQuestionnaireBatchKey(batchKey);
      setQuestions(batchQuestions);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setQuestionnaireProgress({ current: batchQuestions.length > 0 ? 1 : 0, total: batchQuestions.length });
      setIsComplete(false);
      questionnaireAnswerLockRef.current = false;

      if (questionnaireEnterDelayRef.current) {
        clearTimeout(questionnaireEnterDelayRef.current);
        questionnaireEnterDelayRef.current = null;
      }
      const message = readyMessage?.trim() || (source === "fallback" ? buildQuestionnaireReadyMessage(batchKey) : "");
      if (message) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            model: source === "fallback" ? "deterministic" : AGENT_STREAM_MODEL_FALLBACK,
            content: message,
          },
        ]);
      }
    },
    [commitSessionState]
  );

  const generateQuestionnaireBatch = useCallback(
    async (batchKey: QuestionnaireBatchKey, options?: { signal?: AbortSignal; pauseBeforeSpinner?: boolean }) => {
      const signal = options?.signal;
      setPhase("chat");
      setGeneratingBatchKey(null);
      setPendingQuestionnaireBatchKey(null);
      setIsPreparingQuestionnaireGeneration(true);
      setIsTyping(false);
      setTypingNotice(null);
      setTypingPrimaryLabel("思考中…");

      try {
        if (options?.pauseBeforeSpinner !== false) {
          await waitForNextPaint(signal);
          await sleep(QUESTIONNAIRE_GENERATION_TRANSITION_DELAY_MS, signal);
        }
        if (signal?.aborted) return;

        setIsPreparingQuestionnaireGeneration(false);
        setGeneratingBatchKey(batchKey);
        setPhase("generating");

        const baseState = sessionStateRef.current;
        const existingQuestions = flattenQuestionnaireBatches(baseState.questionnaireBatches);
        const res = await fetch("/api/questionnaire/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionState: baseState,
            batchMode: getBatchModeForKey(batchKey),
            existingQuestions,
            scenarioGuidance: baseState.scenarioGuidance,
          }),
          signal,
        });

        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok || !isQuestionnaireGenerateSuccess(data) || data.questions.length === 0) {
          const detail =
            data && typeof data === "object" && typeof (data as { detail?: unknown }).detail === "string"
              ? (data as { detail: string }).detail
              : `HTTP ${res.status}`;
          throw new Error(detail);
        }

        enterQuestionnaireBatch(
          batchKey,
          data.questions,
          data.sessionState ?? baseState,
          data.message,
          data.source
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setPhase("chat");
          setGeneratingBatchKey(null);
          return;
        }
        console.error("Questionnaire generation error:", error);
        setPhase("chat");
        setGeneratingBatchKey(null);
        setPendingQuestionnaireBatchKey(null);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            model: AGENT_STREAM_MODEL_FALLBACK,
            content: "抱歉，没能生成下一批问卷。请稍后再试。",
          },
        ]);
      } finally {
        setIsPreparingQuestionnaireGeneration(false);
        setIsTyping(false);
        setTypingNotice(null);
        setTypingPrimaryLabel("思考中…");
      }
    },
    [enterQuestionnaireBatch]
  );

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
      const currentPhase = sessionStateRef.current.phase;
      const isQuestionnaireGenRound = isQuestionnaireGenerationLeadInTurn(currentPhase, currentRound);
      setTypingPrimaryLabel(
        isQuestionnaireGenRound ? "个性化生成问卷中…（预计 15–30s）" : "思考中…"
      );

      try {
        const body = {
          messages: currentMessages,
          roundCount: currentRound,
          sessionState: sessionStateRef.current,
          debugSessionId: debugSessionIdRef.current,
          debugStartedAt: startedAtRef.current,
        };

        let lastMessage = "未知错误";
        let failureCount = 0;
        const turnStartMs = performance.now();
        const clientRetryDelayMs = usesQuestionnaireGenerationRetry(currentPhase, currentRound)
          ? CLIENT_QUESTIONNAIRE_GEN_RETRY_DELAY_MS
          : CLIENT_CHAT_RETRY_DELAY_MS;

        for (let attempt = 1; attempt <= CLIENT_CHAT_MAX_ATTEMPTS; attempt++) {
          if (signal?.aborted) return;

          let streamingMessageIndex: number | null = null;
          let streamedText = "";
          let pendingStreamText = "";
          let streamTimer: ReturnType<typeof setInterval> | null = null;
          const flushResolvers: Array<() => void> = [];
          const resolveFlushResolvers = () => {
            if (pendingStreamText.length > 0 || streamTimer) return;
            while (flushResolvers.length > 0) {
              flushResolvers.shift()?.();
            }
          };
          const ensureStreamingMessage = () => {
            if (streamingMessageIndex != null) return;
            streamingMessageIndex = currentMessages.length;
            setIsStreamingText(true);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "",
                model: AGENT_STREAM_MODEL_FALLBACK,
              },
            ]);
          };
          const pumpStreamText = () => {
            ensureStreamingMessage();
            if (!pendingStreamText) {
              if (streamTimer) {
                clearInterval(streamTimer);
                streamTimer = null;
              }
              resolveFlushResolvers();
              return;
            }
            const take = pendingStreamText.length > 80 ? 4 : pendingStreamText.length > 24 ? 2 : 1;
            streamedText += pendingStreamText.slice(0, take);
            pendingStreamText = pendingStreamText.slice(take);
            setMessages((prev) =>
              prev.map((msg, index) =>
                index === streamingMessageIndex ? { ...msg, content: streamedText } : msg
              )
            );
            if (!pendingStreamText && streamTimer) {
              clearInterval(streamTimer);
              streamTimer = null;
              resolveFlushResolvers();
            }
          };
          const enqueueStreamText = (text: string) => {
            if (!text) return;
            ensureStreamingMessage();
            pendingStreamText += text;
            if (!streamTimer) {
              streamTimer = setInterval(pumpStreamText, 18);
              pumpStreamText();
            }
          };
          const flushStreamText = () => {
            if (!pendingStreamText && !streamTimer) return Promise.resolve();
            return new Promise<void>((resolve) => {
              flushResolvers.push(resolve);
            });
          };
          const stopStreamText = () => {
            if (streamTimer) {
              clearInterval(streamTimer);
              streamTimer = null;
            }
            pendingStreamText = "";
            setIsStreamingText(false);
            resolveFlushResolvers();
          };
          try {
            const data = await fetchChatStream(
              {
                messages: currentMessages,
                roundCount: currentRound,
                sessionState: sessionStateRef.current,
              },
              signal,
              enqueueStreamText,
              (label) => setTypingPrimaryLabel(label)
            );
            await flushStreamText();

            const thinkDurationSec = (performance.now() - turnStartMs) / 1000;
            const assistantMessage = visibleAssistantMessageFromChatData(data, thinkDurationSec);
            const nextTranscript = assistantMessage ? [...currentMessages, assistantMessage] : currentMessages;
            const previousSessionPhase = sessionStateRef.current.phase;
            if (data.sessionState) {
              commitSessionState(data.sessionState);
            }

            if (previousSessionPhase === "interview" && data.nextPhase === "questionnaire") {
              setMessages(nextTranscript);
              setRoundCount(currentRound + 1);
              setIsTyping(false);
              await generateQuestionnaireBatch("batch1", {
                signal,
                pauseBeforeSpinner: Boolean(assistantMessage),
              });
              return;
            }

            const nextBatchKey = getNextBatchKeyForMidDialogPhase(previousSessionPhase);
            const shouldGenerateNextBatch =
              Boolean(nextBatchKey) &&
              (data.agentBOutput.shouldGenerateNextBatch ||
                data.agentBOutput.directive.action === "finish_mid_dialog");
            if (nextBatchKey && shouldGenerateNextBatch) {
              const dialogKey = getMidDialogueKeyForPhase(previousSessionPhase);
              const dialogueMessages = nextTranscript.slice(midDialogStartIndexRef.current ?? 0);
              const stateWithDialogue: SessionState = {
                ...sessionStateRef.current,
                phase: previousSessionPhase,
                midDialogues: dialogKey
                  ? {
                      ...(sessionStateRef.current.midDialogues ?? {}),
                      [dialogKey]: dialogueMessages,
                    }
                  : sessionStateRef.current.midDialogues,
              };
              commitSessionState(stateWithDialogue);
              setMessages(nextTranscript);
              setRoundCount(currentRound + 1);
              setIsComplete(false);
              midDialogStartIndexRef.current = null;
              await generateQuestionnaireBatch(nextBatchKey, {
                signal,
                pauseBeforeSpinner: true,
              });
              return;
            }

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

            setMessages((prev) => {
              if (!assistantMessage) {
                return streamingMessageIndex == null
                  ? prev
                  : prev.filter((_, index) => index !== streamingMessageIndex);
              }
              if (streamingMessageIndex == null) return [...prev, assistantMessage];
              return prev.map((msg, index) =>
                index === streamingMessageIndex ? assistantMessage : msg
              );
            });
            setIsStreamingText(false);
            setIsComplete(previousSessionPhase === "interview" ? data.isComplete : false);
            setRoundCount(currentRound + 1);
            return;
          } catch {
            stopStreamText();
            setMessages((prev) =>
              streamingMessageIndex == null ? prev : prev.filter((_, index) => index !== streamingMessageIndex)
            );
          }

          const result = await fetchChatOnce(body, signal);
          if (result.ok) {
            const { data } = result;
            const thinkDurationSec = (performance.now() - turnStartMs) / 1000;
            const assistantMessage = visibleAssistantMessageFromChatData(data, thinkDurationSec);
            const nextTranscript = assistantMessage ? [...currentMessages, assistantMessage] : currentMessages;
            const previousSessionPhase = sessionStateRef.current.phase;
            if (data.sessionState) {
              commitSessionState(data.sessionState);
            }

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

            // Check if we should transition to questionnaire phase
            if (previousSessionPhase === "interview" && data.nextPhase === "questionnaire") {
              setMessages(nextTranscript);
              setRoundCount(currentRound + 1);
              setIsTyping(false);
              await generateQuestionnaireBatch("batch1", {
                signal,
                pauseBeforeSpinner: Boolean(assistantMessage),
              });
              return;
            }

            const nextBatchKey = getNextBatchKeyForMidDialogPhase(previousSessionPhase);
            const shouldGenerateNextBatch =
              Boolean(nextBatchKey) &&
              (data.agentBOutput.shouldGenerateNextBatch ||
                data.agentBOutput.directive.action === "finish_mid_dialog");
            if (nextBatchKey && shouldGenerateNextBatch) {
              const dialogKey = getMidDialogueKeyForPhase(previousSessionPhase);
              const dialogueMessages = nextTranscript.slice(midDialogStartIndexRef.current ?? 0);
              const stateWithDialogue: SessionState = {
                ...sessionStateRef.current,
                phase: previousSessionPhase,
                midDialogues: dialogKey
                  ? {
                      ...(sessionStateRef.current.midDialogues ?? {}),
                      [dialogKey]: dialogueMessages,
                    }
                  : sessionStateRef.current.midDialogues,
              };
              commitSessionState(stateWithDialogue);
              setMessages(nextTranscript);
              setRoundCount(currentRound + 1);
              setIsComplete(false);
              midDialogStartIndexRef.current = null;
              await generateQuestionnaireBatch(nextBatchKey, {
                signal,
                pauseBeforeSpinner: true,
              });
              return;
            }

            if (assistantMessage) {
              setMessages((prev) => [
                ...prev,
                assistantMessage,
              ]);
            }
            setIsComplete(previousSessionPhase === "interview" ? data.isComplete : false);
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
            model: AGENT_STREAM_MODEL_FALLBACK,
            content: "抱歉，没能拿到访谈回复。请稍后再试。",
          },
        ]);
      } finally {
        setIsStreamingText(false);
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) {
          setIsTyping(false);
          setTypingNotice(null);
          setTypingPrimaryLabel("思考中…");
        }
      }
    },
    [commitSessionState, generateQuestionnaireBatch, persistLocalDebugRun]
  );

  const handleQuestionnaireAnswer = useCallback(async (score: number | null) => {
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
      skipped: score == null,
      skipReason: score == null ? "unsure_or_not_applicable" : undefined,
    };
    const newAnswers = [...answersRef.current, newAnswer];
    const nextIndex = idx + 1;
    const currentState = sessionStateRef.current;
    const activeBatchKey = getBatchKeyForPhase(currentState.phase) ?? "batch1";
    const nextBatchAnswers = {
      ...(currentState.batchAnswers ?? {}),
      [activeBatchKey]: newAnswers,
    };
    const flattenedAnswers = flattenBatchAnswers(nextBatchAnswers);
    setAnswers(newAnswers);

    if (nextIndex >= qs.length) {
      const nextMidDialogPhase = getMidDialogPhaseAfterBatch(activeBatchKey);
      if (!nextMidDialogPhase) {
        const finalState = applySessionStatePatch(
          currentState,
          {
            batchAnswers: nextBatchAnswers,
            answers: flattenedAnswers,
            phase: "report",
          },
          { turn: currentState.turn, phase: "report" }
        );
        commitSessionState(finalState);
        persistReportPayload(flattenedAnswers, finalState);
        setPendingQuestionnaireBatchKey(null);
        setPhase("complete");
        setIsComplete(true);
        router.push("/report");
        questionnaireAnswerLockRef.current = false;
        return;
      }

      const midDialogKey = getMidDialogueKeyForPhase(nextMidDialogPhase);
      midDialogStartIndexRef.current = messagesRef.current.length;
      const baseMidDialogState = applySessionStatePatch(
        currentState,
        {
          batchAnswers: nextBatchAnswers,
          answers: flattenedAnswers,
          phase: nextMidDialogPhase,
        },
        { turn: currentState.turn, phase: nextMidDialogPhase }
      );
      setPhase("chat");
      setGeneratingBatchKey(null);
      setPendingQuestionnaireBatchKey(null);
      setQuestions([]);
      setAnswers([]);
      setCurrentQuestionIndex(0);
      setQuestionnaireProgress({ current: 0, total: qs.length });
      setIsComplete(false);
      setIsTyping(true);
      setTypingNotice(null);
      setTypingPrimaryLabel("分析对话中…");

      const opening = await fetchMidDialogOpening(activeBatchKey, newAnswers, baseMidDialogState).catch((error) => {
        console.warn("mid-dialog opening generation failed:", error);
        return null;
      });
      const promptMessage: Message = {
        role: "assistant",
        model: opening?.source === "model" ? AGENT_STREAM_MODEL_FALLBACK : "deterministic",
        content: opening?.message || buildMidDialogPrompt(activeBatchKey, newAnswers, baseMidDialogState),
      };
      const nextMessages = [...messagesRef.current, promptMessage];
      setMessages(nextMessages);
      const nextState = applySessionStatePatch(
        baseMidDialogState,
        {
          midDialogues: midDialogKey ? { [midDialogKey]: [promptMessage] } : undefined,
          phase: nextMidDialogPhase,
        },
        { turn: baseMidDialogState.turn, phase: nextMidDialogPhase }
      );
      commitSessionState(nextState);
      setIsTyping(false);
      setTypingNotice(null);
      setTypingPrimaryLabel("思考中…");
      questionnaireAnswerLockRef.current = false;
      return;
    }

    commitSessionState(
      applySessionStatePatch(
        currentState,
        {
          batchAnswers: nextBatchAnswers,
          answers: flattenedAnswers,
          phase: currentState.phase,
        },
        { turn: currentState.turn, phase: currentState.phase }
      )
    );
    setCurrentQuestionIndex(nextIndex);
    setQuestionnaireProgress({ current: nextIndex + 1, total: qs.length });
    queueMicrotask(() => {
      questionnaireAnswerLockRef.current = false;
    });
  }, [commitSessionState, persistReportPayload, router]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (
      !inputValue.trim() ||
      isTyping ||
      isPreparingQuestionnaireGeneration ||
      isComplete ||
      pendingQuestionnaireBatchKey ||
      phase !== "chat"
    ) return;

    const newMessages = [...messages, { role: "user", content: inputValue } as Message];
    setMessages(newMessages);
    setInputValue("");

    triggerTurn(newMessages, roundCount);
  };

  const startPendingQuestionnaire = () => {
    if (!pendingQuestionnaireBatchKey || questions.length === 0) return;
    questionnaireAnswerLockRef.current = false;
    setPendingQuestionnaireBatchKey(null);
    setPhase("questionnaire");
  };

  const goToReport = () => {
    persistReportPayload(getFlattenedAnswers(), sessionStateRef.current);
    router.push("/report");
  };

  // Start first turn on mount
  useEffect(() => {
    startedAtRef.current = new Date().toISOString();
    debugSessionIdRef.current = crypto.randomUUID();
    commitSessionState(createInitialSessionState(debugSessionIdRef.current));
    savedLocalLogRef.current = false;

    const ac = new AbortController();
    void triggerTurn([], 0, { signal: ac.signal });
    return () => ac.abort();
  }, [commitSessionState, triggerTurn]);

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

  const activeBatchKey = pendingQuestionnaireBatchKey ?? getBatchKeyForPhase(sessionState.phase) ?? generatingBatchKey;
  const activeBatchNumber = activeBatchKey ? getBatchNumber(activeBatchKey) : null;
  const isMidDialogPhase =
    sessionState.phase === "mid_dialog1" || sessionState.phase === "mid_dialog2";
  const headerTitle =
    phase === "chat"
      ? generatingBatchKey
        ? "正在生成问卷"
        : pendingQuestionnaireBatchKey
        ? "问卷已生成"
        : isMidDialogPhase
        ? "题目场景校准"
        : "深度访谈进行中"
      : phase === "generating"
        ? "正在生成问卷"
        : "AI-MBTI 问卷";

  return (
    <div className="flex flex-col h-screen bg-void max-w-3xl mx-auto">
      <header className="flex-shrink-0 h-[72px] flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.06)] bg-[#07080a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-raycast-red shadow-[0_0_8px_rgba(255,99,99,0.5)]" />
          <h1 className="text-[14px] font-semibold tracking-[0.2px] text-light-gray">
            {headerTitle}
          </h1>
        </div>
        {(phase === "questionnaire" || generatingBatchKey || pendingQuestionnaireBatchKey) && activeBatchNumber && (
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-light-gray">
              第 {activeBatchNumber}/3 批
            </span>
            {phase === "questionnaire" && (
              <ProgressIndicator questionnaireProgress={questionnaireProgress} />
            )}
          </div>
        )}
      </header>

      {/* Chat Phase */}
      {phase === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            {messages.map((msg, idx) => (
              <ChatBubble key={idx} message={msg} />
            ))}
            {isTyping && !isStreamingText && (
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
            {pendingQuestionnaireBatchKey ? (
              <button
                onClick={startPendingQuestionnaire}
                className="w-full h-[52px] bg-[hsla(0,0%,100%,0.9)] hover:bg-white text-[#18191a] font-semibold text-[16px] rounded-pill tracking-[0.3px] flex items-center justify-center gap-2 transition-all shadow-button-native"
              >
                <FileText className="w-5 h-5" />
                开始第 {getBatchNumber(pendingQuestionnaireBatchKey)}/3 批问卷
              </button>
            ) : isComplete ? (
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
                  disabled={isPreparingQuestionnaireGeneration}
                  placeholder="输入你的回答... (Shift + Enter 换行)"
                  className="w-full bg-surface-100 border border-[rgba(255,255,255,0.08)] rounded-[12px] px-4 py-4 pr-14 text-[16px] text-near-white placeholder:text-dim-gray focus:outline-none focus:border-raycast-blue focus:ring-1 focus:ring-[rgba(85,179,255,0.15)] resize-none shadow-card-ring min-h-[60px] max-h-[200px] transition-all"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping || isPreparingQuestionnaireGeneration}
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Loader2 className="w-8 h-8 text-raycast-blue animate-spin mb-4" />
          <p className="text-light-gray text-[16px]">个性化生成问卷中...</p>
          <p className="text-dim-gray text-[13px] mt-3 leading-relaxed">预计 15–30s，请稍候</p>
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

const AGENT_STREAM_MODEL_FALLBACK = "claude-opus-4-6";
