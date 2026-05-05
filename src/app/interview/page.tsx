"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ParticleBackground } from "@/components/ParticleBackground";
import { QuestionnaireCard } from "@/components/QuestionnaireCard";
import { QuestionnaireGenerating } from "@/components/QuestionnaireGenerating";
import {
  applySessionStatePatch,
  flattenBatchAnswers,
  getBatchKeyForPhase,
  getBatchModeForKey,
} from "@/lib/sessionState";
import type {
  QuestionnaireAnswer,
  QuestionnaireBatchKey,
  QuestionnaireQuestion,
  SessionState,
} from "@/lib/types";

const REQUEST_TIMEOUT_MS = 75_000;

type ViewPhase = "loading" | "generating" | "answering" | "error";

type GenerateResponse = {
  questions: QuestionnaireQuestion[];
  sessionState?: SessionState;
  message?: string;
  warnings?: string[];
};

function storageGetSessionState(): SessionState | null {
  try {
    const raw = sessionStorage.getItem("ai_mbti_session_state");
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

function storageSetSessionState(state: SessionState) {
  sessionStorage.setItem("ai_mbti_session_state", JSON.stringify(state));
  sessionStorage.setItem("ai_mbti_target_context", JSON.stringify({
    role: state.background.role,
    tools: state.background.tools,
    recentUse: state.background.recentUse,
    goal: state.background.goal,
  }));
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), ms);
  controller.signal.addEventListener("abort", () => window.clearTimeout(id), { once: true });
  return controller.signal;
}

function batchFromQuery(value: string | null, state: SessionState): QuestionnaireBatchKey {
  if (value === "2") return "batch2";
  if (value === "1") return "batch1";
  return getBatchKeyForPhase(state.phase) ?? "batch1";
}

function answerFromQuestion(question: QuestionnaireQuestion, score: number | null): QuestionnaireAnswer {
  return {
    dimension: question.dimension,
    question: question.question,
    scenario: question.scenario,
    reverse: false,
    score,
    skipped: score == null,
    skipReason: score == null ? "unsure_or_not_applicable" : undefined,
  };
}

export default function InterviewPage() {
  const router = useRouter();
  const didStartGeneration = useRef(false);
  const [phase, setPhase] = useState<ViewPhase>("loading");
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [batchKey, setBatchKey] = useState<QuestionnaireBatchKey>("batch1");
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [isQuestionnaireReady, setIsQuestionnaireReady] = useState(false);

  const batchMode = useMemo(() => getBatchModeForKey(batchKey), [batchKey]);

  useEffect(() => {
    const state = storageGetSessionState();
    if (!state) {
      router.replace("/intake");
      return;
    }
    const search = new URLSearchParams(window.location.search);
    const key = batchFromQuery(search.get("batch"), state);
    const existingQuestions = state.questionnaireBatches?.[key] ?? [];
    const existingAnswers = state.batchAnswers?.[key] ?? [];
    setSessionState(state);
    setBatchKey(key);
    setQuestions(existingQuestions);
    setAnswers(existingAnswers);
    setIsQuestionnaireReady(false);
    setPhase(existingQuestions.length > 0 ? "answering" : "generating");
  }, [router]);

  const generateQuestions = useCallback(async () => {
    if (!sessionState || questions.length > 0 || phase !== "generating" || didStartGeneration.current) return;
    didStartGeneration.current = true;
    setError("");
    setIsQuestionnaireReady(false);

    try {
      const existingQuestions = batchKey === "batch2" ? sessionState.questionnaireBatches?.batch1 ?? [] : [];
      const response = await fetch("/api/questionnaire/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionState,
          batchMode,
          existingQuestions,
          scenarioGuidance: sessionState.scenarioGuidance,
        }),
        signal: timeoutSignal(REQUEST_TIMEOUT_MS),
      });
      const data = (await response.json().catch(() => null)) as GenerateResponse | { detail?: string } | null;
      if (!response.ok || !data || !Array.isArray((data as GenerateResponse).questions)) {
        throw new Error((data as { detail?: string } | null)?.detail ?? "问卷生成失败。");
      }

      const nextState = (data as GenerateResponse).sessionState ?? applySessionStatePatch(
        sessionState,
        { questionnaireBatches: { [batchKey]: (data as GenerateResponse).questions } },
        { phase: batchKey === "batch1" ? "questionnaire_batch1" : "questionnaire_batch2" }
      );
      storageSetSessionState(nextState);
      setSessionState(nextState);
      setQuestions((data as GenerateResponse).questions);
      setAnswers(nextState.batchAnswers?.[batchKey] ?? []);
      setIsQuestionnaireReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "问卷生成失败。");
      setIsQuestionnaireReady(false);
      setPhase("error");
    }
  }, [batchKey, batchMode, phase, questions.length, sessionState]);

  useEffect(() => {
    generateQuestions();
  }, [generateQuestions]);

  const persistAnswers = (nextAnswers: QuestionnaireAnswer[], nextPhase: SessionState["phase"]) => {
    if (!sessionState) return null;
    const nextState = applySessionStatePatch(
      sessionState,
      { batchAnswers: { [batchKey]: nextAnswers } },
      { phase: nextPhase }
    );
    storageSetSessionState(nextState);
    sessionStorage.setItem("ai_mbti_answers", JSON.stringify(flattenBatchAnswers(nextState.batchAnswers)));
    setSessionState(nextState);
    setAnswers(nextAnswers);
    return nextState;
  };

  const handleNext = (score: number | null) => {
    const question = questions[index];
    if (!question) return;
    const nextAnswers = [...answers];
    nextAnswers[index] = answerFromQuestion(question, score);

    if (index < questions.length - 1) {
      persistAnswers(nextAnswers, batchKey === "batch1" ? "questionnaire_batch1" : "questionnaire_batch2");
      setIndex(index + 1);
      return;
    }

    persistAnswers(nextAnswers, batchKey === "batch1" ? "mid_dialog1" : "report");
    if (batchKey === "batch1") {
      router.push("/mid-feedback");
    } else {
      router.push("/report");
    }
  };

  const handlePrevious = (score?: number | null) => {
    if (index <= 0) return;
    if (score !== undefined && questions[index]) {
      const nextAnswers = [...answers];
      nextAnswers[index] = answerFromQuestion(questions[index], score);
      persistAnswers(nextAnswers, batchKey === "batch1" ? "questionnaire_batch1" : "questionnaire_batch2");
    }
    setIndex(index - 1);
  };

  const currentQuestion = questions[index];
  const initialScore = answers[index]?.skipped ? null : answers[index]?.score;

  if (phase === "generating" || phase === "loading") {
    return (
      <QuestionnaireGenerating
        isReady={isQuestionnaireReady}
        onComplete={() => setPhase("answering")}
      />
    );
  }

  if (phase === "error") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-void text-near-white">
        <ParticleBackground />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-raycast-red/40 bg-raycast-red/10">
            <AlertCircle className="h-6 w-6 text-raycast-red" />
          </div>
          <h1 className="text-2xl font-semibold">问卷生成失败</h1>
          <p className="mt-3 text-sm leading-relaxed text-dim-gray">{error}</p>
          <button
            type="button"
            onClick={() => {
              didStartGeneration.current = false;
              setIsQuestionnaireReady(false);
              setPhase("generating");
            }}
            className="mt-8 h-11 rounded-[10px] bg-white px-5 text-sm font-semibold text-void"
          >
            重新生成
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-near-white">
      <ParticleBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-raycast-blue">
            {batchKey === "batch1" ? "第一轮问卷" : "第二轮问卷"}
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            {batchKey === "batch1" ? "先快速采样你的协作风格" : "再贴近你的真实场景校准"}
          </h1>
        </div>
        {currentQuestion ? (
          <QuestionnaireCard
            question={currentQuestion}
            index={index}
            total={questions.length}
            initialScore={initialScore}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        ) : null}
      </div>
    </main>
  );
}
