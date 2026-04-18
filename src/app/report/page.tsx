"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FinalReport, Message, QuestionnaireAnswer } from "@/lib/types";
import { DimensionCard } from "@/components/DimensionCard";
import { motion } from "framer-motion";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Loader2, ArrowLeft } from "lucide-react";
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

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waitHint, setWaitHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const generateReport = async () => {
      const historyStr = sessionStorage.getItem("ai_mbti_history");
      const identityStr = sessionStorage.getItem("ai_mbti_identity") || "用户";
      const answersStr = sessionStorage.getItem("ai_mbti_answers");

      if (!historyStr) {
        router.push("/");
        return;
      }

      setLoading(true);
      setError("");
      setWaitHint(null);

      let messages: Message[];
      let questionnaireAnswers: QuestionnaireAnswer[] = [];
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

      let failureCount = 0;
      let lastErr = "生成报告失败，请稍后再试。";

      for (let attempt = 0; attempt < API_RETRY_MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages, identity: identityStr, questionnaireAnswers }),
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
  const strongest = report.dimensions.reduce((prev, cur) => (cur.score > prev.score ? cur : prev));
  const strongestLetter =
    strongest.score >= 50
      ? DIMENSION_LETTERS[strongest.dimension].high
      : DIMENSION_LETTERS[strongest.dimension].low;

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

        {/* Overview Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row gap-8 items-center bg-surface-100 p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[rgba(85,179,255,0.05)] rounded-full blur-[60px] pointer-events-none" />

          {/* Radar Chart */}
          <div className="w-full md:w-[300px] h-[300px] flex-shrink-0">
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

          {/* Summary & Tags */}
          <div className="flex-1 space-y-6 relative z-10">
            <h2 className="text-[24px] font-medium text-near-white tracking-[0.2px] leading-[1.4]">
              {report.summary}
            </h2>
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
        </motion.div>

        {/* Dimension Details */}
        <div className="space-y-4">
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
      </div>
    </div>
  );
}
