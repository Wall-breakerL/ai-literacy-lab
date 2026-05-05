"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FinalReport,
  FeedbackPriority,
  FeedbackSentiment,
  FeedbackType,
  Message,
  QuestionnaireAnswer,
  SessionState,
  TargetContext,
} from "@/lib/types";
import { DimensionCard } from "@/components/DimensionCard";
import { MarkdownText } from "@/components/MarkdownText";
import { HolographicLoading } from "@/components/HolographicLoading";
import { ReportStoryExperience } from "@/components/ReportStoryExperience";
import { normalizeSignatureDetailText } from "@/lib/reportPortableArtifacts";
import {
  getPersonalityNextAction,
  getReportTaskLabel,
  hasAwkwardReportContextText,
} from "@/lib/reportDisplayContext";
import { isSkippedQuestionnaireAnswer, scoreAnswer } from "@/lib/reportScoring";
import { flattenBatchAnswers, isSessionState } from "@/lib/sessionState";
import { ArrowLeft, ChevronDown } from "lucide-react";
import {
  isRetryableApiFailure,
  sleepAbortable,
} from "@/lib/clientApiRetry";

const REPORT_MAX_ATTEMPTS = 2;
const REPORT_REQUEST_TIMEOUT_MS = 75_000;
const REPORT_RETRY_DELAY_MS = 15_000;
const FEEDBACK_TEXT_LIMIT = 60;

function isFinalReport(data: unknown): data is FinalReport {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.summary === "string" &&
    Array.isArray(o.tags) &&
    Array.isArray(o.dimensions) &&
    (o.dimensions as unknown[]).length > 0
  );
}

type ReportPageModel = FinalReport & {
  styleOverview?: {
    corePattern?: string;
    fitScenario?: string;
    strengthArea?: string;
    growthDirection?: string;
  };
  collaborationManifesto?: string;
  collaborationSignature?: {
    headline?: string;
    detail?: string;
  };
};

type DimensionItem = FinalReport["dimensions"][number];

const SCALE_LABELS: Record<number, string> = {
  0: "肯定不会",
  1: "一般不会",
  2: "偶尔会",
  3: "经常会",
  4: "通常会",
  5: "肯定会",
};

const BATCH_LABELS = {
  batch1: "第一轮测试",
  batch2: "第二轮测试",
  batch3: "第三轮测试",
  all: "完整测试",
} as const;

type AnswerBatchKey = keyof typeof BATCH_LABELS;

interface AnswerScoreDetail {
  answer: QuestionnaireAnswer;
  batchKey: AnswerBatchKey;
  batchLabel: string;
  indexInBatch: number;
  contribution: number | null;
  rawPercent: number | null;
  skipped: boolean;
}

interface AnswerBatchDetail {
  key: AnswerBatchKey;
  label: string;
  answers: AnswerScoreDetail[];
}

interface DimensionScoreDetail {
  dimension: DimensionItem["dimension"];
  label: string;
  tendencyLabel: string;
  score: number;
  answeredCount: number;
  skippedCount: number;
  contributions: number[];
}

interface ScoreAudit {
  batches: AnswerBatchDetail[];
  dimensions: DimensionScoreDetail[];
  totalQuestions: number;
  answeredQuestions: number;
  skippedQuestions: number;
}

function firstText(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function stripMarkdown(text?: string) {
  return (text ?? "")
    .replace(/[#*_`>\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text?: string, maxLength = 140) {
  const cleaned = stripMarkdown(text);
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

function limitFeedbackText(text: string) {
  return Array.from(text).slice(0, FEEDBACK_TEXT_LIMIT).join("");
}

function rawScorePercent(score: number | null): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  const raw = Math.min(5, Math.max(0, Math.round(score)));
  return (raw / 5) * 100;
}

function formatScore(value: number | null) {
  if (value == null) return "不计分";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function dimensionAverageFormula(dimension: DimensionScoreDetail) {
  if (!dimension.contributions.length) return "无题目，使用默认中点 10/20";
  const sum = dimension.contributions.reduce((total, score) => total + score, 0);
  return `${dimension.contributions.map((score) => formatScore(score)).join(" + ")} = ${formatScore(sum)} / 20`;
}

function resolveAnswerBatchEntries(
  questionnaireAnswers: QuestionnaireAnswer[],
  sessionState?: SessionState,
): Array<[AnswerBatchKey, QuestionnaireAnswer[]]> {
  const batchAnswers = sessionState?.batchAnswers;
  if (batchAnswers?.batch1?.length || batchAnswers?.batch2?.length || batchAnswers?.batch3?.length) {
    return (["batch1", "batch2", "batch3"] as const)
      .map((key) => [key, batchAnswers?.[key] ?? []] as [AnswerBatchKey, QuestionnaireAnswer[]])
      .filter(([, answers]) => answers.length > 0);
  }

  if (questionnaireAnswers.length > 8) {
    return [
      ["batch1", questionnaireAnswers.slice(0, 8)],
      ["batch2", questionnaireAnswers.slice(8)],
    ];
  }

  return questionnaireAnswers.length ? [["all", questionnaireAnswers]] : [];
}

function buildScoreAudit(args: {
  report: FinalReport;
  questionnaireAnswers: QuestionnaireAnswer[];
  sessionState?: SessionState;
}): ScoreAudit | null {
  const { report, questionnaireAnswers, sessionState } = args;
  const batchEntries = resolveAnswerBatchEntries(questionnaireAnswers, sessionState);
  if (!batchEntries.length) return null;

  const batches = batchEntries.map(([key, answers]) => ({
    key,
    label: BATCH_LABELS[key],
    answers: answers.map((answer, index) => ({
      answer,
      batchKey: key,
      batchLabel: BATCH_LABELS[key],
      indexInBatch: index + 1,
      contribution: scoreAnswer(answer),
      rawPercent: rawScorePercent(answer.score),
      skipped: isSkippedQuestionnaireAnswer(answer),
    })),
  }));
  const flatDetails = batches.flatMap((batch) => batch.answers);

  const dimensions = report.dimensions.map((dimension) => {
    const answers = flatDetails.filter((item) => item.answer.dimension === dimension.dimension);
    const contributions = answers
      .filter((item) => !item.skipped)
      .map((item) => item.contribution)
      .filter((score): score is number => typeof score === "number");
    return {
      dimension: dimension.dimension,
      label: dimension.label,
      tendencyLabel: dimension.tendencyLabel,
      score: dimension.score,
      answeredCount: contributions.length,
      skippedCount: answers.length - contributions.length,
      contributions,
    };
  });

  const totalQuestions = flatDetails.length;
  const skippedQuestions = flatDetails.filter((item) => item.skipped).length;
  return {
    batches,
    dimensions,
    totalQuestions,
    answeredQuestions: totalQuestions - skippedQuestions,
    skippedQuestions,
  };
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  const id = window.setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, ms);
  controller.signal.addEventListener("abort", () => window.clearTimeout(id), { once: true });
  return controller.signal;
}

function buildStyleOverview(report: ReportPageModel, strongest: DimensionItem) {
  const style = report.styleOverview;
  const personalityLine = report.personality?.signatureHeadline ?? "";
  const taskLabel = getReportTaskLabel(report.targetContext);
  const providedScenario = firstText(style?.fitScenario, style?.strengthArea);
  const safeScenario = hasAwkwardReportContextText(providedScenario) ? "" : providedScenario;

  return [
    {
      label: "你的协作底色",
      value: firstText(style?.corePattern, personalityLine, compactText(report.summary)),
    },
    {
      label: "你最自如的场景",
      value: firstText(
        safeScenario,
        `在${taskLabel}这类任务里，你的「${strongest.tendencyLabel}」会自然冒出来，不用刻意发力就能跟 AI 搭上节拍。`,
        `任务一旦带上「${strongest.tendencyLabel}」的味道，你就更容易把 AI 用成顺手的搭子，而不是听不懂指令的工具。`,
      ),
    },
    {
      label: "下次可以试的小动作",
      value: getPersonalityNextAction(report.personality?.code),
    },
  ];
}

function dimensionPreference(dimension: DimensionItem) {
  const high = (dimension.scorePercent ?? dimension.score) >= 50;
  switch (dimension.dimension) {
    case "Relation":
      return high ? "把 AI 当作协作伙伴，欢迎它主动补充思路" : "把 AI 当作执行工具，先按我的目标完成任务";
    case "Workflow":
      return high ? "先定框架、步骤和交付标准" : "边探索边调整方向";
    case "Epistemic":
      return high ? "审计输出，重要判断请标注依据" : "较快试用 AI 的建议，再用结果校准";
    case "RepairScope":
      return high ? "必要时重组整体方案，但先说明取舍" : "优先做局部修改，并说明改动理由";
  }
}

function buildManifestoText(report: ReportPageModel) {
  const provided = report.collaborationManifesto?.trim();
  if (provided) return provided;

  const role = firstText(report.targetContext?.role, "AI 使用者");
  const work = firstText(report.targetContext?.recentUse, report.targetContext?.goal, "复杂任务推进");
  const preferences = [...report.dimensions]
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, 2)
    .map(dimensionPreference);

  return `我是一名${role}，主要用 AI 做${work}。我习惯${preferences[0] ?? "先说明目标和约束"}。请你在开始前复述目标，并给出简短计划。我倾向于${preferences[1] ?? "把不确定处单独标出来"}，欢迎你把需要我确认的信息清楚标注出来。`;
}

function buildSignature(report: ReportPageModel) {
  const headline = firstText(
    report.collaborationSignature?.headline,
    report.personality ? `${report.personality.code} · ${report.personality.name}` : "你的协作签名",
  );
  const detail = firstText(
    normalizeSignatureDetailText(report.collaborationSignature?.detail),
    compactText(report.summary),
  );
  return detail ? { headline, detail } : null;
}

function ReportFeedbackPanel({ report }: { report: ReportPageModel }) {
  const [expanded, setExpanded] = useState(false);
  const [sentiment, setSentiment] = useState<FeedbackSentiment>("mixed");
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedLocation, setSavedLocation] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackLength = Array.from(feedbackText).length;

  const submitFeedback = async () => {
    if (submitting || submitted) return;
    const text = limitFeedbackText(feedbackText.trim());
    if (!text) {
      setError("先随便写一句反馈，再提交。");
      return;
    }

    setSubmitting(true);
    setError("");
    setWarning("");

    try {
      const answers = JSON.parse(sessionStorage.getItem("ai_mbti_answers") || "[]") as QuestionnaireAnswer[];
      const sessionStateRaw = JSON.parse(sessionStorage.getItem("ai_mbti_session_state") || "null") as SessionState | null;
      const answeredFromReport = report.dimensions.reduce((sum, item) => sum + (item.answeredCount ?? 0), 0);
      const skippedFromReport = report.dimensions.reduce((sum, item) => sum + (item.skippedCount ?? 0), 0);
      const totalQuestions = answers.length || answeredFromReport + skippedFromReport;
      const answeredQuestions = answers.filter((item) => !item.skipped && item.score != null).length || answeredFromReport;
      const skipRate = totalQuestions > 0 ? (totalQuestions - answeredQuestions) / totalQuestions : 0;
      const createdAt = new Date().toISOString();
      const sessionId = sessionStateRaw?.sessionId || `report-${Date.now()}`;
      const mentionsQuestionnaire = /问卷|题目|选项|问题/.test(text);
      const mentionsReport = /报告|画像|结论|建议|分析|结果/.test(text);

      const feedbackTypes: FeedbackType[] = Array.from(
        new Set([
          mentionsQuestionnaire ? "question_issue" : null,
          mentionsReport || sentiment !== "positive" ? "report_issue" : null,
          !mentionsQuestionnaire && !mentionsReport ? "flow_issue" : null,
          sentiment === "positive" ? "positive_signal" : null,
        ].filter((value): value is FeedbackType => Boolean(value)))
      );
      const priority: FeedbackPriority = sentiment === "negative" ? "high" : sentiment === "positive" ? "low" : "medium";
      const payload = {
        sessionId,
        createdAt,
        feedback: text,
        sentiment,
        priority,
        types: feedbackTypes.length > 0 ? feedbackTypes : ["report_issue"],
        personalityCode: report.personality?.code || "unknown",
        context: {
          role: report.targetContext?.role || "用户",
          recentUse: report.targetContext?.recentUse || "使用 AI 完成日常任务",
          goal: report.targetContext?.goal || "更有效地使用 AI",
        },
        questionnaire: {
          total: totalQuestions,
          answered: answeredQuestions,
          skipRate,
        },
      };

      localStorage.setItem("ai_mbti_feedback_latest", JSON.stringify(payload));

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "反馈保存失败，请稍后再试。");
      }

      const location =
        typeof data.url === "string"
          ? data.url
          : typeof data.file === "string"
            ? data.file
            : "";
      setSavedLocation(location);
      setWarning(typeof data.warning === "string" ? data.warning : "");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "反馈提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-[8px] border border-white/10 bg-[#1e293b] p-6 shadow-card-ring sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase text-raycast-blue">反馈入口</p>
          <h2 className="text-[20px] font-semibold text-white">
            对于本次测试的问卷或者报告，感觉还算满意吗？
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-[#0f172a] px-4 py-2 text-[14px] font-semibold text-near-white transition-colors hover:border-white/20"
          aria-expanded={expanded}
        >
          {expanded ? "收起反馈" : "写点反馈"}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {submitted ? (
        <div className="rounded-[8px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-100">
          反馈已提交。{savedLocation ? `记录位置：${savedLocation}` : ""}
          {warning ? `（${warning}）` : ""}
        </div>
      ) : null}

      {expanded ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { key: "positive", label: "挺满意" },
              { key: "mixed", label: "还行" },
              { key: "negative", label: "不太满意" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSentiment(item.key as FeedbackSentiment)}
                className={`rounded-[8px] border px-4 py-2 text-[14px] font-semibold transition-colors ${
                  sentiment === item.key
                    ? "border-raycast-blue bg-[rgba(85,179,255,0.14)] text-near-white"
                    : "border-white/10 bg-[#0f172a] text-slate-300 hover:border-white/20"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] leading-relaxed text-slate-400">
            AI 有时候也会犯迷糊，生成的问卷难免偶尔有点瑕疵。如果哪道题不像你的真实场景，直接吐槽就好。
          </p>

          <textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(limitFeedbackText(event.target.value))}
            maxLength={FEEDBACK_TEXT_LIMIT}
            placeholder="比如：哪几道题不像人话、报告哪里说准了/没说准、或者你希望下个版本改什么。"
            className="min-h-[112px] w-full resize-y rounded-[8px] border border-white/10 bg-[#0f172a] px-4 py-3 text-[14px] leading-relaxed text-near-white placeholder:text-slate-500 focus:border-raycast-blue focus:outline-none"
          />
          <p className="text-right text-[12px] text-slate-500">
            {feedbackLength}/{FEEDBACK_TEXT_LIMIT}
          </p>

          {error ? (
            <p className="text-[13px] text-raycast-red">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={submitFeedback}
            disabled={submitting || submitted}
            className="inline-flex items-center justify-center rounded-[8px] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-950 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "提交中..." : submitted ? "已提交" : "提交反馈"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<FinalReport | null>(null);
  const [scoreAudit, setScoreAudit] = useState<ScoreAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportReady, setReportReady] = useState(false);
  const [error, setError] = useState("");
  const [waitHint, setWaitHint] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const generateReport = async () => {
      const historyStr = sessionStorage.getItem("ai_mbti_history");
      const identityStr = sessionStorage.getItem("ai_mbti_identity") || "用户";
      const answersStr = sessionStorage.getItem("ai_mbti_answers");
      const targetContextStr = sessionStorage.getItem("ai_mbti_target_context");
      const sessionStateStr = sessionStorage.getItem("ai_mbti_session_state");

      setLoading(true);
      setError("");
      setWaitHint(null);

      let messages: Message[] = [];
      let questionnaireAnswers: QuestionnaireAnswer[] = [];
      let sessionState: SessionState | undefined;
      if (sessionStateStr) {
        try {
          const parsed = JSON.parse(sessionStateStr);
          sessionState = isSessionState(parsed) ? parsed : undefined;
        } catch {
          sessionState = undefined;
        }
      }

      if (answersStr) {
        try {
          questionnaireAnswers = JSON.parse(answersStr) as QuestionnaireAnswer[];
        } catch {
          // Ignore invalid answers
        }
      }
      if (questionnaireAnswers.length === 0 && sessionState?.answers?.length) {
        questionnaireAnswers = sessionState.answers;
      }
      if (questionnaireAnswers.length === 0 && sessionState?.batchAnswers) {
        questionnaireAnswers = flattenBatchAnswers(sessionState.batchAnswers);
      }

      const hasNewFlowData = Boolean(sessionState && questionnaireAnswers.length > 0);
      const hasOldFlowData = Boolean(historyStr);
      if (!hasNewFlowData && !hasOldFlowData) {
        router.push("/");
        return;
      }

      if (historyStr) {
        try {
          messages = JSON.parse(historyStr) as Message[];
        } catch {
          if (!hasNewFlowData) {
            if (!cancelled) {
              setError("访谈记录无效，请重新完成访谈。");
              setLoading(false);
            }
            return;
          }
        }
      }

      let targetContext: TargetContext | undefined = undefined;
      if (targetContextStr) {
        try {
          targetContext = JSON.parse(targetContextStr) as TargetContext;
        } catch {
          targetContext = undefined;
        }
      }
      targetContext ??= sessionState
        ? {
            role: sessionState.background.role,
            tools: sessionState.background.tools,
            recentUse: sessionState.background.recentUse,
            goal: sessionState.background.goal,
          }
        : undefined;

      let failureCount = 0;
      let lastErr = "生成报告失败，请稍后再试。";

      for (let attempt = 0; attempt < REPORT_MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages, identity: identityStr, questionnaireAnswers, targetContext, sessionState }),
            signal: timeoutSignal(REPORT_REQUEST_TIMEOUT_MS),
          });

          let data: unknown = {};
          try {
            data = await res.json();
          } catch {
            data = {};
          }

          const d = data as Record<string, unknown>;
          const detail =
            typeof d?.detail === "string" && d.detail.trim()
              ? d.detail.trim()
              : typeof d?.error === "string"
                ? d.error
                : `HTTP ${res.status}`;

          if (!res.ok) {
            lastErr = detail;
            failureCount += 1;
            if (failureCount >= 3) setWaitHint("网络较差，正在重试…");
            console.error("Report API error:", res.status, data, `attempt ${attempt + 1}/${REPORT_MAX_ATTEMPTS}`);
            const retry = isRetryableApiFailure(res.status, detail) && attempt < REPORT_MAX_ATTEMPTS - 1;
            if (retry) {
              await sleepAbortable(REPORT_RETRY_DELAY_MS);
              continue;
            }
            break;
          }

          if (typeof d.error === "string" && d.error && !isFinalReport(data)) {
            lastErr = d.error;
            failureCount += 1;
            if (failureCount >= 3) setWaitHint("网络较差，正在重试…");
            const retry = attempt < REPORT_MAX_ATTEMPTS - 1;
            if (retry) {
              await sleepAbortable(REPORT_RETRY_DELAY_MS);
              continue;
            }
            break;
          }

          if (!isFinalReport(data)) {
            lastErr = "报告格式异常，正在重试…";
            failureCount += 1;
            if (failureCount >= 3) setWaitHint("网络较差，正在重试…");
            if (attempt < REPORT_MAX_ATTEMPTS - 1) {
              await sleepAbortable(REPORT_RETRY_DELAY_MS);
              continue;
            }
            break;
          }

          if (cancelled) return;
          setReport(data);
          setScoreAudit(buildScoreAudit({ report: data, questionnaireAnswers, sessionState }));
          setReportReady(true);
          return;
        } catch (err) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : String(err);
          lastErr = msg;
          console.error("Report fetch error:", err, `attempt ${attempt + 1}/${REPORT_MAX_ATTEMPTS}`);
          const networkLike =
            err instanceof TypeError ||
            err instanceof DOMException && err.name === "TimeoutError" ||
            /fetch|network|Failed to fetch|Load failed|ECONNRESET|ETIMEDOUT|timed out/i.test(msg);
          if (networkLike) {
            failureCount += 1;
            if (failureCount >= 3) setWaitHint("网络较差，正在重试…");
          }
          const retry = networkLike && attempt < REPORT_MAX_ATTEMPTS - 1;
          if (retry) {
            await sleepAbortable(REPORT_RETRY_DELAY_MS);
            continue;
          }
          break;
        }
      }

      if (!cancelled) {
        setError(lastErr);
        setLoading(false);
      }
    };

    void generateReport();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading && !showReport && !error) {
    return (
      <HolographicLoading
        reportReady={reportReady}
        onComplete={() => {
          setShowReport(true);
          setLoading(false);
        }}
      />
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-void">
        <p className="text-raycast-red text-[16px] mb-6">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-surface-100 border border-[rgba(255,255,255,0.06)] rounded-lg text-near-white"
        >
          返回测试首页
        </button>
      </div>
    );
  }

  const strongest = report.dimensions.reduce((prev, cur) =>
    Math.abs(cur.score - 50) > Math.abs(prev.score - 50) ? cur : prev
  );
  const uiReport = report as ReportPageModel;
  const styleOverview = buildStyleOverview(uiReport, strongest);
  const manifestoText = buildManifestoText(uiReport);
  const signature = buildSignature(uiReport);

  const fullReport = (
    <div className="space-y-6">
      {/* 新增：风格画像 */}
      {(report as any).styleProfile && (
        <section className="space-y-4 rounded-[8px] border border-white/10 bg-[#1e293b] p-6 shadow-card-ring sm:p-8">
          <h2 className="text-[20px] font-semibold text-white">你的协作风格画像</h2>

          {/* 你是这样用AI的 */}
          {(report as any).styleProfile.behaviors && (
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-slate-400">你是这样用AI的</p>
              {(report as any).styleProfile.behaviors.map((behavior: any, index: number) => (
                <div key={index} className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4">
                  <p className="text-[15px] text-near-white">{behavior.behavior}</p>
                  <p className="mt-2 text-[12px] text-slate-400">
                    基于：{behavior.basedOn} · 证据：{behavior.evidence}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 对比 */}
          {(report as any).styleProfile.comparison && (
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-slate-400">
                对比：{(report as any).styleProfile.comparison.scenario}
              </p>
              {(report as any).styleProfile.comparison.styles.map((style: any, index: number) => (
                <div key={index} className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4">
                  <p className="mb-2 text-[15px] font-semibold text-near-white">{style.type}</p>
                  <p className="mb-2 text-[14px] text-light-gray">{style.approach}</p>
                  <div className="flex gap-4 text-[13px]">
                    <span className="text-green-400">✓ {style.pros}</span>
                    <span className="text-orange-400">✗ {style.cons}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 独特组合 */}
          {(report as any).styleProfile.uniqueness && (
            <div className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4">
              <p className="mb-2 text-[15px] font-semibold text-near-white">
                {(report as any).styleProfile.uniqueness.combination}
              </p>
              <p className="mb-2 text-[13px] text-slate-400">
                {(report as any).styleProfile.uniqueness.percentage}
              </p>
              <p className="text-[13px] text-slate-400">
                相似用户：{(report as any).styleProfile.uniqueness.similarRoles.join('、')}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 新增：问题诊断 */}
      {(report as any).problems && (report as any).problems.length > 0 && (
        <section className="space-y-4 rounded-[8px] border border-white/10 bg-[#1e293b] p-6 shadow-card-ring sm:p-8">
          <h2 className="text-[20px] font-semibold text-white">你可能遇到的问题</h2>
          {(report as any).problems.map((problem: any, index: number) => (
            <div key={index} className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4 space-y-3">
              <h3 className="text-[16px] font-semibold text-near-white">{problem.title}</h3>
              <div>
                <p className="text-[12px] font-semibold text-slate-400">症状</p>
                <p className="text-[14px] text-light-gray">{problem.symptom}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-400">为什么</p>
                <p className="text-[14px] text-light-gray">{problem.why}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-400">怎么改</p>
                <p className="text-[14px] text-light-gray">{problem.howToFix.immediate}</p>
                <pre className="mt-2 text-[13px] text-slate-300 whitespace-pre-wrap">{problem.howToFix.example}</pre>
                <p className="mt-2 text-[13px] text-green-400">→ {problem.howToFix.expectedResult}</p>
              </div>
              <p className="text-[12px] text-slate-500">基于：{problem.basedOn}</p>
            </div>
          ))}
        </section>
      )}

      {/* 新增：工具箱 */}
      {(report as any).toolbox && (
        <section className="space-y-4 rounded-[8px] border border-white/10 bg-[#1e293b] p-6 shadow-card-ring sm:p-8">
          <h2 className="text-[20px] font-semibold text-white">适合你的AI工具箱</h2>

          {/* Prompt模板 */}
          {(report as any).toolbox.promptTemplates && (
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-slate-400">Prompt模板</p>
              {(report as any).toolbox.promptTemplates.map((template: any, index: number) => (
                <div key={index} className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[15px] font-semibold text-near-white">{template.title}</p>
                    <div className="flex gap-1">
                      {template.tags.map((tag: string, i: number) => (
                        <span key={i} className="rounded-[4px] bg-raycast-blue/20 px-2 py-0.5 text-[11px] text-raycast-blue">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mb-2 text-[13px] text-slate-400">{template.useCase}</p>
                  <pre className="rounded-[6px] bg-black/30 p-3 text-[13px] text-light-gray whitespace-pre-wrap">
                    {template.prompt}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Checklist */}
          {(report as any).toolbox.checklists && (
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-slate-400">Checklist</p>
              {(report as any).toolbox.checklists.map((checklist: any, index: number) => (
                <div key={index} className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4">
                  <p className="mb-2 text-[15px] font-semibold text-near-white">{checklist.title}</p>
                  <ul className="space-y-1">
                    {checklist.items.map((item: string, i: number) => (
                      <li key={i} className="text-[14px] text-light-gray">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* 工作流 */}
          {(report as any).toolbox.workflow && (
            <div className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4">
              <p className="mb-3 text-[15px] font-semibold text-near-white">
                {(report as any).toolbox.workflow.title}
              </p>
              <div className="space-y-2">
                {(report as any).toolbox.workflow.steps.map((step: any, index: number) => (
                  <div key={index} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raycast-blue/20 text-[12px] font-semibold text-raycast-blue">
                      {step.step}
                    </span>
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-near-white">{step.action}</p>
                      <p className="text-[13px] text-slate-400">{step.detail}</p>
                      <p className="text-[12px] text-slate-500">{step.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-slate-400">
                总时间：{(report as any).toolbox.workflow.totalTime} · 基于：{(report as any).toolbox.workflow.basedOn}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-[20px] font-semibold text-white">深度维度解析</h2>
        {report.dimensions.map((dim, i) => (
          <DimensionCard key={dim.dimension} report={dim} index={i} />
        ))}
      </section>

      <section className="space-y-6 rounded-[8px] border border-white/10 bg-[#1e293b] p-6 shadow-card-ring sm:p-8">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase text-slate-400">下一次可以怎么用</p>
          {uiReport.overallAdvice ? (
            <MarkdownText content={uiReport.overallAdvice} variant="body" />
          ) : (
            <p className="text-[14px] leading-relaxed text-light-gray">
              下次开始任务前，先让 AI 复述目标、列出关键假设和需要你确认的信息，再进入正式输出。
            </p>
          )}
        </div>

        {uiReport.recommendations?.length ? (
          <div className="grid gap-3">
            {uiReport.recommendations.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4"
              >
                <p className="mb-2 text-[15px] font-semibold text-near-white">{item.title}</p>
                <MarkdownText content={item.detail} variant="compact" />
              </div>
            ))}
          </div>
          ) : null}
        </section>

      {scoreAudit ? (
        <section className="space-y-5 rounded-[8px] border border-white/10 bg-[#1e293b] p-6 shadow-card-ring sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase text-raycast-blue">答题与计分明细</p>
              <h2 className="text-[20px] font-semibold text-white">两轮测试完整得分</h2>
            </div>
            <p className="text-[13px] text-slate-400">
              共 {scoreAudit.totalQuestions} 题，有效 {scoreAudit.answeredQuestions} 题，跳过{" "}
              {scoreAudit.skippedQuestions} 题
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {scoreAudit.dimensions.map((dimension) => (
              <div key={dimension.dimension} className="rounded-[8px] border border-white/10 bg-[#0f172a] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold text-near-white">{dimension.label}</p>
                  <p className="text-[18px] font-semibold text-raycast-yellow">{dimension.score}</p>
                </div>
                <p className="mt-1 text-[12px] text-slate-400">判定为「{dimension.tendencyLabel}」</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {scoreAudit.batches.map((batch) => (
              <details
                key={batch.key}
                className="group rounded-[8px] border border-white/10 bg-[#0f172a] p-4 open:border-raycast-blue/30"
                open
              >
                <summary className="cursor-pointer list-none text-[15px] font-semibold text-near-white">
                  {batch.label} · {batch.answers.length} 题
                </summary>
                <div className="mt-4 space-y-3">
                  {batch.answers.map((item) => {
                    const answer = item.answer;
                    const skipped = item.skipped;
                    return (
                      <div
                        key={`${batch.key}-${item.indexInBatch}-${answer.dimension}-${answer.question}`}
                        className="rounded-[8px] border border-white/10 bg-black/15 p-4"
                      >
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
                            <span className="rounded-[6px] border border-white/10 px-2 py-1">
                              第 {item.indexInBatch} 题
                            </span>
                            <span className="rounded-[6px] border border-white/10 px-2 py-1">
                              {report.dimensions.find((dim) => dim.dimension === answer.dimension)?.label ?? answer.dimension}
                            </span>
                            {answer.reverse ? (
                              <span
                                className="rounded-[6px] border px-2 py-1"
                                style={{
                                  borderColor: "rgba(251,191,36,0.3)",
                                  color: "#fbbf24",
                                  backgroundColor: "rgba(251,191,36,0.08)",
                                }}
                              >
                                反向题
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[13px] text-light-gray">
                            {skipped
                              ? <span className="text-slate-400">不了解 / 没想好</span>
                              : <>
                                  <span>{SCALE_LABELS[answer.score ?? 0] ?? `${answer.score} 分`}</span>
                                  <span className="mx-1.5 text-slate-500">·</span>
                                  <span className="text-raycast-yellow">贡献 {formatScore(item.contribution)}</span>
                                </>
                            }
                          </p>
                        </div>
                        <p className="break-words text-[14px] leading-relaxed text-light-gray">{answer.question}</p>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>

        </section>
      ) : null}

      <ReportFeedbackPanel report={uiReport} />

      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 rounded-[8px] border border-white/10 bg-[#1e293b] px-4 py-2 text-[14px] font-semibold text-light-gray transition-all hover:border-raycast-blue hover:text-near-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </button>
      </div>
    </div>
  );

  return (
    <ReportStoryExperience
      report={uiReport}
      insights={styleOverview}
      manifestoText={manifestoText}
      signature={signature}
      fullReport={fullReport}
    />
  );
}
