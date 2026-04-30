"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackContext, FinalReport, Message, QuestionnaireAnswer, SessionState, TargetContext } from "@/lib/types";
import { DimensionCard } from "@/components/DimensionCard";
import { FeedbackDialogue } from "@/components/FeedbackDialogue";
import { MarkdownText } from "@/components/MarkdownText";
import { PersonalityAvatar } from "@/components/PersonalityAvatar";
import { normalizeSignatureDetailText } from "@/lib/reportPortableArtifacts";
import { flattenBatchAnswers, isSessionState } from "@/lib/sessionState";
import { motion } from "framer-motion";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { ArrowLeft, ClipboardList, Fingerprint, Loader2 } from "lucide-react";
import {
  API_RETRY_MAX_ATTEMPTS,
  isRetryableApiFailure,
  nextRetryDelayMs,
  sleepAbortable,
} from "@/lib/clientApiRetry";

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

const TOC_ITEMS = [
  { id: "style-overview", label: "风格速览" },
  { id: "profile", label: "我的画像" },
  { id: "summary", label: "画像简介" },
  { id: "dimensions", label: "四维解析" },
  { id: "prompts", label: "Prompt 模板" },
  { id: "manifesto", label: "我的协作宣言" },
  { id: "signature", label: "协作签名" },
  { id: "feedback", label: "反馈" },
];

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

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildStyleOverview(report: ReportPageModel, strongest: DimensionItem) {
  const style = report.styleOverview;
  const personalityLine = report.personality
    ? `${report.personality.name}：${report.personality.tagline}`
    : "";
  const targetText = firstText(report.targetContext?.goal, report.targetContext?.recentUse);

  return [
    {
      label: "你的核心协作模式",
      value: firstText(style?.corePattern, personalityLine, compactText(report.summary)),
    },
    {
      label: "更自然的协作场景",
      value: firstText(
        style?.fitScenario,
        style?.strengthArea,
        targetText ? `在「${targetText}」这类任务里，你的 ${strongest.tendencyLabel} 倾向会更容易形成稳定节奏。` : "",
        `当任务能匹配「${strongest.tendencyLabel}」时，你更容易把 AI 用成可控的协作工具。`,
      ),
    },
    {
      label: "下一步可以尝试",
      value: firstText(
        style?.growthDirection,
        compactText(report.overallAdvice),
        "下次开始任务前，先让 AI 用一句话复述目标，再列出它准备采用的步骤和需要你确认的部分。",
      ),
    },
  ];
}

function dimensionPreference(dimension: DimensionItem) {
  const high = dimension.score >= 50;
  switch (dimension.dimension) {
    case "Relation":
      return high ? "把 AI 当作协作伙伴，欢迎它主动补充思路" : "把 AI 当作执行工具，先按我的目标完成任务";
    case "Workflow":
      return high ? "边探索边调整方向" : "先定框架、步骤和交付标准";
    case "Epistemic":
      return high ? "较快试用 AI 的建议，再用结果校准" : "审计输出，重要判断请标注依据";
    case "RepairScope":
      return high ? "优先做局部修改，并说明改动理由" : "必要时重组整体方案，但先说明取舍";
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
    report.personality?.tagline,
    compactText(report.summary),
  );
  return detail ? { headline, detail } : null;
}

function buildFeedbackContext(args: {
  report: FinalReport;
  messages: Message[];
  identity: string;
  questionnaireAnswers: QuestionnaireAnswer[];
  sessionState?: SessionState;
  targetContext?: TargetContext;
}): FeedbackContext {
  const { report, messages, identity, questionnaireAnswers, sessionState, targetContext } = args;
  void messages;
  const answerSource = questionnaireAnswers.length
    ? questionnaireAnswers
    : sessionState?.answers?.length
      ? sessionState.answers
      : flattenBatchAnswers(sessionState?.batchAnswers);
  const totalQuestions = answerSource.length || sessionState?.questionnaire?.length || 24;
  const skippedQuestions = answerSource.filter((answer) => answer.skipped || answer.score === null).length;
  const answeredQuestions = Math.max(0, totalQuestions - skippedQuestions);
  const effectiveTargetContext = report.targetContext ?? targetContext;

  return {
    sessionId: sessionState?.sessionId ?? `report-${Date.now()}`,
    identity,
    personalityCode: report.personality?.code,
    personalityName: report.personality?.name,
    role: effectiveTargetContext?.role || "用户",
    recentUse: effectiveTargetContext?.recentUse || "使用 AI 完成日常任务",
    goal: effectiveTargetContext?.goal || "更有效地使用 AI",
    totalQuestions,
    answeredQuestions,
    skipRate: totalQuestions > 0 ? skippedQuestions / totalQuestions : 0,
    reportSummary: compactText(report.summary, 500),
    reportTags: report.tags,
    collaborationManifesto: report.collaborationManifesto,
    promptTemplateTitles: report.promptTemplates?.map((template) => template.title),
  };
}

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<FinalReport | null>(null);
  const [feedbackContext, setFeedbackContext] = useState<FeedbackContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waitHint, setWaitHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const generateReport = async () => {
      const historyStr = sessionStorage.getItem("ai_mbti_history");
      const identityStr = sessionStorage.getItem("ai_mbti_identity") || "用户";
      const answersStr = sessionStorage.getItem("ai_mbti_answers");
      const targetContextStr = sessionStorage.getItem("ai_mbti_target_context");
      const sessionStateStr = sessionStorage.getItem("ai_mbti_session_state");

      if (!historyStr) {
        router.push("/");
        return;
      }

      setLoading(true);
      setError("");
      setWaitHint(null);

      let messages: Message[];
      let questionnaireAnswers: QuestionnaireAnswer[] = [];
      let sessionState: SessionState | undefined;
      try {
        messages = JSON.parse(historyStr) as Message[];
      } catch {
        if (!cancelled) {
          setError("访谈记录无效，请重新完成访谈。");
          setLoading(false);
        }
        return;
      }

      if (answersStr) {
        try {
          questionnaireAnswers = JSON.parse(answersStr) as QuestionnaireAnswer[];
        } catch {
          // Ignore invalid answers
        }
      }
      if (sessionStateStr) {
        try {
          const parsed = JSON.parse(sessionStateStr);
          sessionState = isSessionState(parsed) ? parsed : undefined;
          if (questionnaireAnswers.length === 0 && sessionState?.answers) {
            questionnaireAnswers = sessionState.answers;
          }
        } catch {
          sessionState = undefined;
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
            recentUse: sessionState.background.recentUse,
            goal: sessionState.background.goal,
            goalStatus: sessionState.background.goalStatus,
            goalType: sessionState.background.goalType,
          }
        : undefined;

      let failureCount = 0;
      let lastErr = "生成报告失败，请稍后再试。";

      for (let attempt = 0; attempt < API_RETRY_MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages, identity: identityStr, questionnaireAnswers, targetContext, sessionState }),
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
            console.error("Report API error:", res.status, data, `attempt ${attempt + 1}/${API_RETRY_MAX_ATTEMPTS}`);
            const retry = isRetryableApiFailure(res.status, detail) && attempt < API_RETRY_MAX_ATTEMPTS - 1;
            if (retry) {
              await sleepAbortable(nextRetryDelayMs(attempt));
              continue;
            }
            break;
          }

          if (typeof d.error === "string" && d.error && !isFinalReport(data)) {
            lastErr = d.error;
            failureCount += 1;
            if (failureCount >= 3) setWaitHint("网络较差，正在重试…");
            const retry = attempt < API_RETRY_MAX_ATTEMPTS - 1;
            if (retry) {
              await sleepAbortable(nextRetryDelayMs(attempt));
              continue;
            }
            break;
          }

          if (!isFinalReport(data)) {
            lastErr = "报告格式异常，正在重试…";
            failureCount += 1;
            if (failureCount >= 3) setWaitHint("网络较差，正在重试…");
            if (attempt < API_RETRY_MAX_ATTEMPTS - 1) {
              await sleepAbortable(nextRetryDelayMs(attempt));
              continue;
            }
            break;
          }

          if (cancelled) return;
          setReport(data);
          setFeedbackContext(
            buildFeedbackContext({
              report: data,
              messages,
              identity: identityStr,
              questionnaireAnswers,
              sessionState,
              targetContext,
            }),
          );
          setLoading(false);
          return;
        } catch (err) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : String(err);
          lastErr = msg;
          console.error("Report fetch error:", err, `attempt ${attempt + 1}/${API_RETRY_MAX_ATTEMPTS}`);
          const networkLike =
            err instanceof TypeError ||
            /fetch|network|Failed to fetch|Load failed|ECONNRESET|ETIMEDOUT/i.test(msg);
          if (networkLike) {
            failureCount += 1;
            if (failureCount >= 3) setWaitHint("网络较差，正在重试…");
          }
          const retry = networkLike && attempt < API_RETRY_MAX_ATTEMPTS - 1;
          if (retry) {
            await sleepAbortable(nextRetryDelayMs(attempt));
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-void relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[rgba(85,179,255,0.05)] rounded-full blur-[80px] pointer-events-none" />
        <Loader2 className="w-8 h-8 text-raycast-blue animate-spin mb-6" />
        <p className="text-light-gray text-[16px] tracking-[0.2px] text-center">
          正在深度分析你的 AI-MBTI 特征...
        </p>
        <p className="text-dim-gray text-[13px] tracking-raycast-small mt-4 text-center max-w-md leading-relaxed px-2">
          耐心等待，请不要退出浏览器。
        </p>
        {waitHint ? (
          <p className="text-dim-gray text-[12px] tracking-raycast-small mt-2 text-center max-w-md px-2">
            {waitHint}
          </p>
        ) : null}
      </div>
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

  // Map scores for radar chart
  const DIMENSION_LETTERS: Record<
    "Relation" | "Workflow" | "Epistemic" | "RepairScope",
    { low: string; high: string }
  > = {
    Relation: { low: "I", high: "C" },
    Workflow: { low: "F", high: "E" },
    Epistemic: { low: "A", high: "T" },
    RepairScope: { low: "G", high: "L" },
  };

  const radarData = report.dimensions.map((d) => ({
    subject: d.score >= 50 ? DIMENSION_LETTERS[d.dimension].high : DIMENSION_LETTERS[d.dimension].low,
    score: d.score,
    fullMark: 100,
  }));
  const dimensionSnapshot = report.dimensions.map((d) => ({
    dimension: d.dimension,
    label: d.label,
    letter: d.score >= 50 ? DIMENSION_LETTERS[d.dimension].high : DIMENSION_LETTERS[d.dimension].low,
    tendencyLabel: d.tendencyLabel,
    score: Math.round(d.score),
  }));
  const strongest = report.dimensions.reduce((prev, cur) =>
    Math.abs(cur.score - 50) > Math.abs(prev.score - 50) ? cur : prev
  );
  const strongestLetter =
    strongest.score >= 50
      ? DIMENSION_LETTERS[strongest.dimension].high
      : DIMENSION_LETTERS[strongest.dimension].low;
  const uiReport = report as ReportPageModel;
  const personality = uiReport.personality;
  const styleOverview = buildStyleOverview(uiReport, strongest);
  const manifestoText = buildManifestoText(uiReport);
  const signature = buildSignature(uiReport);
  const promptTemplates = uiReport.promptTemplates ?? [];

  return (
    <div className="min-h-screen bg-void py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-dim-gray hover:text-light-gray transition-colors text-[14px]"
          >
            <ArrowLeft className="w-4 h-4" />
            返回测试首页
          </button>
          <div className="text-[14px] font-semibold tracking-[0.4px] text-dim-gray uppercase">
            你的 AI 协作画像
          </div>
        </motion.div>

        {/* Style Overview */}
        <motion.section
          id="style-overview"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="scroll-mt-6 rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-raycast-red/15 via-surface-100 to-raycast-yellow/10 p-6 shadow-card-ring sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-yellow">
                Your AI Collaboration Style
              </p>
              <h2 className="break-words text-[22px] font-semibold leading-tight tracking-[0.2px] text-near-white">
                风格速览
              </h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {styleOverview.map((item) => (
              <article
                key={item.label}
                className="min-w-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#07080a]/35 p-4"
              >
                <p className="mb-2 text-[12px] font-semibold tracking-[0.2px] text-dim-gray">
                  {item.label}
                </p>
                <p className="break-words text-[14px] leading-relaxed text-light-gray">{item.value}</p>
              </article>
            ))}
          </div>
        </motion.section>

        {/* TOC */}
        <motion.nav
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          aria-label="报告章节导航"
        >
          <div className="flex w-max min-w-full gap-2 pb-1">
            {TOC_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="h-9 shrink-0 rounded-pill border border-[rgba(255,255,255,0.08)] bg-surface-100 px-3 text-[13px] font-semibold text-light-gray transition-colors hover:border-raycast-blue hover:text-near-white"
              >
                {item.label}
              </button>
            ))}
          </div>
        </motion.nav>

        {/* Profile Section */}
        <motion.div
          id="profile"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="scroll-mt-6 bg-surface-100 p-6 sm:p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[rgba(85,179,255,0.05)] rounded-full blur-[60px] pointer-events-none" />

          <div className="relative z-10 grid gap-6 md:grid-cols-[168px_minmax(0,1fr)_220px] md:items-center">
            <div className="flex justify-center md:justify-start">
              <PersonalityAvatar profile={report.personality} />
            </div>

            <div className="min-w-0 space-y-4">
              {personality ? (
                <div className="min-w-0">
                  <p className="mb-2 text-[12px] font-semibold tracking-[0.4px] text-raycast-blue uppercase">
                    {personality.code}
                  </p>
                  <h1 className="break-words text-[28px] font-semibold text-near-white tracking-[0.2px] leading-tight">
                    {personality.name}
                  </h1>
                  <p className="mt-2 break-words text-[14px] text-light-gray leading-relaxed">
                    {personality.tagline}
                  </p>
                </div>
              ) : null}
              <div className="text-[13px] text-light-gray">
                主导字母：<span className="text-near-white font-semibold">{strongestLetter}</span>
                {" · "}
                约{Math.round(strongest.score)}分（{strongest.label}）
              </div>
              <div className="flex flex-wrap gap-2">
                {report.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-card-surface border border-[rgba(255,255,255,0.08)] rounded-pill text-[12px] font-semibold text-light-gray"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Radar Chart */}
            <div className="mx-auto h-[220px] w-full max-w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#9c9c9d", fontSize: 12, fontWeight: 500 }}
                  />
                  <Radar
                    name="AI-MBTI"
                    dataKey="score"
                    stroke="#55b3ff"
                    fill="#55b3ff"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2">
            {dimensionSnapshot.map((item) => (
              <div
                key={item.dimension}
                className="min-w-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-card-surface p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-[12px] font-semibold tracking-[0.2px] text-dim-gray">
                      {item.label}
                    </p>
                    <p className="mt-1 break-words text-[15px] font-semibold text-near-white">
                      {item.letter} · {item.tendencyLabel}
                    </p>
                  </div>
                  <span className="shrink-0 text-[18px] font-semibold text-raycast-blue">
                    {item.score}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-dark-border">
                  <div
                    className="h-full rounded-full bg-raycast-blue"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Summary Section */}
        <motion.section
          id="summary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="scroll-mt-6 rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-surface-100 p-6 shadow-card-ring sm:p-8"
        >
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-dim-gray">
            画像简介
          </p>
          <MarkdownText content={report.summary} variant="summary" />
        </motion.section>

        {/* Dimension Details */}
        <div id="dimensions" className="scroll-mt-6 space-y-4">
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[20px] font-medium text-near-white tracking-[0.2px] mb-6"
          >
            深度维度解析
          </motion.h3>

          {report.dimensions.map((dim, i) => (
            <DimensionCard key={dim.dimension} report={dim} index={i} />
          ))}
        </div>

        {/* Overall Advice */}
        {Boolean(uiReport.overallAdvice || uiReport.recommendations?.length || promptTemplates.length) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-surface-100 p-6 sm:p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] space-y-6"
          >
            <div>
              <p className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase mb-2">
                下一次可以怎么用
              </p>
              <MarkdownText content={report.overallAdvice} variant="body" />
            </div>

            {uiReport.recommendations?.length ? (
              <div className="grid gap-3">
                {uiReport.recommendations.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="border border-[rgba(255,255,255,0.06)] rounded-[12px] p-4 bg-card-surface"
                  >
                    <p className="text-[15px] font-semibold text-near-white mb-2">{item.title}</p>
                    <MarkdownText content={item.detail} variant="compact" />
                  </div>
                ))}
              </div>
            ) : null}

            {promptTemplates.length ? (
              <div id="prompts" className="scroll-mt-6 space-y-3">
                <p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.4px] text-raycast-blue uppercase">
                  <ClipboardList className="h-4 w-4" />
                  Prompt 模板
                </p>
                {promptTemplates.map((template, index) => (
                  <div
                    key={`${template.title}-${index}`}
                    className="min-w-0 rounded-[12px] border border-[rgba(85,179,255,0.14)] bg-[rgba(85,179,255,0.04)] p-4"
                  >
                    <div className="mb-3 min-w-0">
                      <div className="min-w-0">
                        <p className="break-words text-[14px] font-semibold text-near-white">{template.title}</p>
                        <p className="mt-1 break-words text-[12px] text-dim-gray">{template.useCase}</p>
                      </div>
                    </div>
                    <pre className="min-w-0 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-light-gray font-mono tracking-[0.1px]">
                      {template.prompt}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.section>
        )}

        {/* Collaboration Manifesto */}
        <motion.section
          id="manifesto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="scroll-mt-6 rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-surface-100 p-6 shadow-card-ring sm:p-8"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-yellow">
                <Fingerprint className="h-4 w-4" />
                我的 AI 协作宣言
              </p>
              <p className="break-words text-[13px] leading-relaxed text-dim-gray">
                适合作为 ChatGPT / Claude / Cursor 的长期协作偏好配置。
              </p>
            </div>
          </div>
          <div className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-card-surface p-4">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.75] text-light-gray">
              {manifestoText}
            </p>
          </div>
        </motion.section>

        {/* Collaboration Signature */}
        {signature ? (
          <motion.section
            id="signature"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="scroll-mt-6 rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-raycast-red/15 via-surface-100 to-raycast-yellow/10 p-6 shadow-card-ring sm:p-8"
          >
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-yellow">
              Your Collaboration Signature
            </p>
            <h2 className="mb-3 break-words text-[22px] font-semibold leading-tight tracking-[0.2px] text-near-white">
              {signature.headline}
            </h2>
            <p className="break-words text-[14px] leading-relaxed text-light-gray">{signature.detail}</p>
          </motion.section>
        ) : null}

        {feedbackContext ? <FeedbackDialogue context={feedbackContext} /> : null}
      </div>
    </div>
  );
}
