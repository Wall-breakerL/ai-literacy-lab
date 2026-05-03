"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  Message,
  AgentBOutput,
  QuestionnaireQuestion,
  QuestionnaireAnswer,
  QuestionnaireBatchKey,
  ScenarioGuidance,
  SessionPhase,
  SessionState,
} from "@/lib/types";
import { QUESTIONNAIRE_ENTRY_ROUND } from "@/lib/researcher";
import { questionnaireReadyMessageForBatchKey } from "@/lib/questionnaireReadyMessage";
import {
  applySessionStatePatch,
  createInitialSessionState,
  flattenBatchAnswers,
  flattenQuestionnaireBatches,
  getBatchKeyForPhase,
  getBatchModeForKey,
} from "@/lib/sessionState";
import { ChatBubble } from "@/components/ChatBubble";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { QuestionnaireCard } from "@/components/QuestionnaireCard";
import { QuestionnaireGenerating } from "@/components/QuestionnaireGenerating";

/** 客户端对 /api/chat 的最大尝试次数（含首次请求），应对网络抖动与偶发 502。 */
const CLIENT_CHAT_MAX_ATTEMPTS = 5;
/** 每次失败后、发起下一次请求前的固定等待时间（普通聊天轮）。 */
const CLIENT_CHAT_RETRY_DELAY_MS = 30_000;
/** 问卷生成客户端重试间隔，与服务端批次生成重试对齐。 */
const CLIENT_QUESTIONNAIRE_GEN_RETRY_DELAY_MS = 60_000;
/** 连续失败达到此次数后，在「思考中」下显示网络提示（1 = 第一次失败即显示；仍会继续重试直至上限）。 */
const CLIENT_CHAT_HINT_AFTER_FAILURES = 1;
/** 进入全屏问卷生成前，在聊天页展示过渡气泡的时长。 */
const QUESTIONNAIRE_GENERATION_TRANSITION_DELAY_MS = 2_500;
/** 访谈结束或中场对话结束后，生成前 2.5s 统一气泡文案 */
const QUESTIONNAIRE_PREP_GEN_LABEL = "个性化生成问卷中…";
/** 单次问卷生成请求的客户端保险超时，避免等待页无限停在 90%。 */
const QUESTIONNAIRE_GENERATE_REQUEST_TIMEOUT_MS = 75_000;

type Phase = "chat" | "generating" | "questionnaire" | "complete";

type QuestionnaireGenerateSuccess = {
  questions: QuestionnaireQuestion[];
  sessionState?: SessionState;
  message?: string;
  source?: "model" | "fallback";
  /** 与服务端实际调用一致的上游模型 ID；fallback 问卷为 deterministic */
  model?: string;
  /** 服务端处理该请求的耗时（秒），与 /api/chat 语义一致 */
  thinkDurationSec?: number;
  retryCount?: number;
  validationIssue?: string;
  warnings?: string[];
  debug?: unknown;
};

type MidDialogOpeningSuccess = {
  message: string;
  source?: "model" | "fallback";
  model?: string;
  thinkDurationSec?: number;
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
  return "questionnaire_batch2";
}

function getMidDialogPhaseAfterBatch(batchKey: QuestionnaireBatchKey): SessionPhase | undefined {
  if (batchKey === "batch1") return "mid_dialog1";
  return undefined;
}

function getMidDialogueKeyForPhase(phase: SessionPhase) {
  if (phase === "mid_dialog1") return "dialog1" as const;
  return undefined;
}

function getNextBatchKeyForMidDialogPhase(phase: SessionPhase): QuestionnaireBatchKey | undefined {
  if (phase === "mid_dialog1") return "batch2";
  return undefined;
}

function getBatchNumber(batchKey: QuestionnaireBatchKey): 1 | 2 {
  if (batchKey === "batch1") return 1;
  return 2;
}

function buildMidDialogPrompt(
  batchKey: QuestionnaireBatchKey,
  answers: QuestionnaireAnswer[],
  state: SessionState
): string {
  const skippedSamples = collectSkippedQuestionSamples(batchKey, answers, state);
  const skippedText = formatSkippedQuestionReferences(skippedSamples);

  if (batchKey === "batch1") {
    if (skippedText) {
      return skippedText
        ? `刚才有几题你选了「不了解 / 没想好」，比如${skippedText}${skippedSamples.length > 1 ? "这两道题" : "这道题"}。你觉得是题意不清楚、没有类似经历，还是对这个方向不太感兴趣？`
        : "刚才有几题你选了「不了解 / 没想好」。你觉得是题意不清楚、没有类似经历，还是对这个方向不太感兴趣？";
    }
    return "第一部分答下来你觉得整体感觉怎么样？第二部分你更希望围绕哪些真实 AI 使用场景来问？";
  }

  return "第一部分答下来你觉得整体感觉怎么样？第二部分你更希望围绕哪些真实 AI 使用场景来问？";
}

function collectSkippedQuestionSamples(
  batchKey: QuestionnaireBatchKey,
  answers: QuestionnaireAnswer[],
  state: SessionState
): QuestionnaireAnswer[] {
  const source = batchKey === "batch1" ? answers : state.batchAnswers?.batch1 ?? answers;
  const seen = new Set<string>();
  return source.filter((answer) => {
    if (!(answer.skipped || answer.score == null)) return false;
    const question = answer.question.trim();
    if (!question) return false;
    const key = question.replace(/\s+/g, "").slice(0, 32);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) =>
    stableHash(`${state.sessionId}|${left.dimension}|${left.question}`) -
    stableHash(`${state.sessionId}|${right.dimension}|${right.question}`)
  ).slice(0, 2);
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
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

function buildOneShotScenarioGuidance(input: string, state: SessionState): ScenarioGuidance {
  const text = input.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const asksForAbstract =
    /抽象|别太具体|不要太具体|太具体|泛一点|通用/.test(text);
  const reportsMismatch =
    /不贴|不太贴|没经历|没有经历|不适合|不相关|不理解|看不懂|没想好|不了解/.test(text);
  const wantsContinue =
    /继续|可以|都行|随便|ok|okay|好/.test(lower) || text.length === 0;
  const target = state.refinedTargetContext ?? {
    role: state.background.role,
    recentUse: state.background.recentUse,
    goal: state.background.goal,
    goalStatus: state.background.goalStatus,
    goalType: state.background.goalType,
  };

  return {
    status: asksForAbstract
      ? "abstract_scenarios"
      : reportsMismatch || !wantsContinue
        ? "refined"
        : "confirmed",
    scenarioSummary: text || target.recentUse || target.goal,
    granularity: asksForAbstract ? "abstract" : "balanced",
    avoidTopics: reportsMismatch && text ? [text] : [],
    includeTopics: text && !reportsMismatch ? [text] : [target.recentUse, target.goal].filter(Boolean),
    userCorrectionQuote: text || undefined,
  };
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

function timeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const id = window.setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, ms);
  const cleanup = () => window.clearTimeout(id);
  const abortFromParent = () => {
    cleanup();
    controller.abort(parent?.reason ?? new DOMException("Aborted", "AbortError"));
  };
  parent?.addEventListener("abort", abortFromParent, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => {
      cleanup();
      parent?.removeEventListener("abort", abortFromParent);
    },
    { once: true }
  );
  return controller.signal;
}

function isQuestionnaireGenerationLeadInTurn(phase: SessionPhase, roundCount: number): boolean {
  return (
    (phase === "interview" && roundCount >= QUESTIONNAIRE_ENTRY_ROUND) ||
    phase === "mid_dialog1"
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

async function fetchMidDialogOpening(
  completedBatchKey: QuestionnaireBatchKey,
  batchAnswers: QuestionnaireAnswer[],
  sessionState: SessionState
): Promise<MidDialogOpeningSuccess | null> {
  if (completedBatchKey !== "batch1") return null;
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
    model: typeof data.model === "string" ? data.model : undefined,
    thinkDurationSec:
      typeof data.thinkDurationSec === "number" && Number.isFinite(data.thinkDurationSec)
        ? data.thinkDurationSec
        : undefined,
  };
}

export default function InterviewPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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
  const [isQuestionnaireReady, setIsQuestionnaireReady] = useState(false);

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
      source?: "model" | "fallback",
      assistantModel?: string,
      thinkDurationSec?: number,
      options?: { deferUiTransition?: boolean }
    ) => {
      const deferUiTransition = options?.deferUiTransition === true;
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
      if (!deferUiTransition) {
        setPhase("chat");
        setGeneratingBatchKey(null);
      }
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
      const message =
        readyMessage?.trim() || (source === "fallback" ? questionnaireReadyMessageForBatchKey(batchKey) : "");
      if (message) {
        const bubbleModel =
          source === "fallback" ? "deterministic" : (assistantModel ?? AGENT_STREAM_MODEL_FALLBACK);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            model: bubbleModel,
            content: message,
            ...(thinkDurationSec != null && Number.isFinite(thinkDurationSec)
              ? { thinkDurationSec }
              : {}),
          },
        ]);
      }
    },
    [commitSessionState]
  );

  const generateQuestionnaireBatch = useCallback(
    async (
      batchKey: QuestionnaireBatchKey,
      options?: {
        signal?: AbortSignal;
        pauseBeforeSpinner?: boolean;
        /** 为 true 时跳过聊天页准备阶段（2.5s 等已由调用方完成） */
        skipChatPreparationPhase?: boolean;
      }
    ) => {
      const signal = options?.signal;
      const skipChatPreparationPhase = options?.skipChatPreparationPhase === true;

      setPhase("chat");
      setGeneratingBatchKey(null);
      setPendingQuestionnaireBatchKey(null);
      setIsQuestionnaireReady(false);

      if (!skipChatPreparationPhase) {
        setIsPreparingQuestionnaireGeneration(true);
        setIsTyping(false);
        setTypingNotice(null);
        setTypingPrimaryLabel(QUESTIONNAIRE_PREP_GEN_LABEL);

        try {
          if (options?.pauseBeforeSpinner !== false) {
            await waitForNextPaint(signal);
            await sleep(QUESTIONNAIRE_GENERATION_TRANSITION_DELAY_MS, signal);
          }
          if (signal?.aborted) return;

          setIsPreparingQuestionnaireGeneration(false);
        } catch (prepError) {
          setIsPreparingQuestionnaireGeneration(false);
          throw prepError;
        }
      } else {
        setIsTyping(false);
        setTypingNotice(null);
        setTypingPrimaryLabel("思考中…");
      }

      try {
        if (signal?.aborted) return;

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
            debug: process.env.NODE_ENV !== "production",
          }),
          signal: timeoutSignal(QUESTIONNAIRE_GENERATE_REQUEST_TIMEOUT_MS, signal),
        });

        const data: unknown = await res.json().catch(() => ({}));
        if (process.env.NODE_ENV !== "production" && data && typeof data === "object") {
          console.info("[questionnaire/generate response]", data);
        }
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
          data.source,
          typeof data.model === "string" ? data.model : undefined,
          typeof data.thinkDurationSec === "number" && Number.isFinite(data.thinkDurationSec)
            ? data.thinkDurationSec
            : undefined,
          { deferUiTransition: true }
        );
        setIsQuestionnaireReady(true);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setPhase("chat");
          setGeneratingBatchKey(null);
          setIsQuestionnaireReady(false);
          return;
        }
        const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
        console.error("Questionnaire generation error:", error);
        setPhase("chat");
        setGeneratingBatchKey(null);
        setPendingQuestionnaireBatchKey(null);
        setIsQuestionnaireReady(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            model: AGENT_STREAM_MODEL_FALLBACK,
            content: isTimeout
              ? "问卷生成时间过长，已自动停止。请稍后再试。"
              : "抱歉，没能生成问卷。请稍后再试。",
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

  const generateSecondBatchFromOneShotMidDialog = useCallback(
    async (
      currentMessages: Message[],
      currentRound: number,
      options?: { signal?: AbortSignal }
    ) => {
      const signal = options?.signal;
      const dialogKey = getMidDialogueKeyForPhase(sessionStateRef.current.phase);
      const nextBatchKey = getNextBatchKeyForMidDialogPhase(sessionStateRef.current.phase);
      if (!dialogKey || !nextBatchKey) return false;

      const userFeedback = [...currentMessages]
        .reverse()
        .find((message) => message.role === "user")?.content ?? "";
      const dialogueMessages = currentMessages.slice(midDialogStartIndexRef.current ?? 0);
      const currentState = sessionStateRef.current;
      const stateWithDialogue = applySessionStatePatch(
        currentState,
        {
          midDialogues: { [dialogKey]: dialogueMessages },
          scenarioGuidance: buildOneShotScenarioGuidance(userFeedback, currentState),
          phase: currentState.phase,
        },
        { phase: currentState.phase }
      );

      commitSessionState(stateWithDialogue);
      setRoundCount(currentRound + 1);
      setIsComplete(false);
      midDialogStartIndexRef.current = null;
      setIsTyping(false);
      setTypingNotice(null);
      setIsPreparingQuestionnaireGeneration(true);
      setTypingPrimaryLabel(QUESTIONNAIRE_PREP_GEN_LABEL);

      try {
        await waitForNextPaint(signal);
        await sleep(QUESTIONNAIRE_GENERATION_TRANSITION_DELAY_MS, signal);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setIsPreparingQuestionnaireGeneration(false);
          setTypingPrimaryLabel("思考中…");
          return true;
        }
        throw e;
      }

      setIsPreparingQuestionnaireGeneration(false);
      await generateQuestionnaireBatch(nextBatchKey, {
        signal,
        skipChatPreparationPhase: true,
      });
      return true;
    },
    [commitSessionState, generateQuestionnaireBatch]
  );

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
      setTypingPrimaryLabel(isQuestionnaireGenRound ? QUESTIONNAIRE_PREP_GEN_LABEL : "思考中…");

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

          // 每次可重试失败后固定等待再发下一轮请求（问卷生成轮为 60s，其余 30s）。
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
        model:
          opening?.source === "model"
            ? (opening.model ?? AGENT_STREAM_MODEL_FALLBACK)
            : "deterministic",
        content: opening?.message || buildMidDialogPrompt(activeBatchKey, newAnswers, baseMidDialogState),
        ...(opening?.thinkDurationSec != null && Number.isFinite(opening.thinkDurationSec)
          ? { thinkDurationSec: opening.thinkDurationSec }
          : {}),
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

    if (sessionStateRef.current.phase === "mid_dialog1") {
      void generateSecondBatchFromOneShotMidDialog(newMessages, roundCount);
      return;
    }

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
  const isMidDialogPhase = sessionState.phase === "mid_dialog1";
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
              第 {activeBatchNumber}/2 部分
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
            {(isTyping || isPreparingQuestionnaireGeneration) && (
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
	                开始第 {getBatchNumber(pendingQuestionnaireBatchKey)}/2 部分问卷
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
        <QuestionnaireGenerating
          estimatedDuration={30000}
          isReady={isQuestionnaireReady}
          onComplete={() => {
            setPhase("chat");
            setGeneratingBatchKey(null);
            setIsQuestionnaireReady(false);
          }}
        />
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[rgba(95,201,146,0.05)] rounded-full blur-[100px] pointer-events-none"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <div className="text-center relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
              className="w-20 h-20 rounded-full bg-raycast-green/20 flex items-center justify-center mx-auto mb-6 relative"
            >
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-raycast-green"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 12,
                  delay: 0.4,
                }}
                className="text-raycast-green text-3xl"
              >
                ✓
              </motion.span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-[24px] font-semibold text-near-white mb-3"
            >
              问卷完成！
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="text-dim-gray text-[15px] mb-10"
            >
              感谢你的耐心回答
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToReport}
              className="w-full max-w-xs h-[52px] bg-[hsla(0,0%,100%,0.9)] hover:bg-white text-[#18191a] font-semibold text-[16px] rounded-pill tracking-[0.3px] flex items-center justify-center gap-2 transition-all shadow-button-native mx-auto relative overflow-hidden group"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              <FileText className="w-5 h-5 relative z-10" />
              <span className="relative z-10">生成我的 AI-MBTI 报告</span>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 流式占位、错误提示或与旧版 API 兼容时；问卷/中场开场以服务端返回的 `model` 为准 */
const AGENT_STREAM_MODEL_FALLBACK = "claude-opus-4-6";
