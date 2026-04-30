// [archived] AI-HQ v0.1 — pending rework as MBTI capability sub-module. See docs/codex-next-iteration.md §Phase 3.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HQReport } from "@/lib/types";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, ClipboardList, Lightbulb, Quote } from "lucide-react";

const LEVEL_META = {
  L1: { label: "新手", color: "text-medium-gray", bg: "bg-card-surface border-[rgba(255,255,255,0.08)]" },
  L2: { label: "熟悉", color: "text-raycast-blue", bg: "bg-[rgba(85,179,255,0.08)] border-[rgba(85,179,255,0.18)]" },
  L3: { label: "专家", color: "text-raycast-green", bg: "bg-[rgba(95,201,146,0.08)] border-[rgba(95,201,146,0.18)]" },
};

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 75 ? "bg-raycast-green" : pct >= 50 ? "bg-raycast-blue" : "bg-raycast-red";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-dark-border rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-dim-gray w-14 text-right">
        {score} / {max}
      </span>
    </div>
  );
}

function DimensionCard({
  dim,
  index,
}: {
  dim: HQReport["dimensions"][number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAdvice = !!dim.advice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-surface-100 border border-[rgba(255,255,255,0.06)] shadow-card-ring rounded-[16px] overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-medium text-near-white">{dim.label}</span>
          {hasAdvice && (
            <span className="text-xs text-raycast-yellow bg-[rgba(255,188,51,0.08)] border border-[rgba(255,188,51,0.18)] px-2 py-0.5 rounded-pill">
              有建议
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 ml-4">
          <div className="w-32 hidden sm:block">
            <ScoreBar score={dim.score} max={dim.max} />
          </div>
          <ChevronDown
            className={`w-4 h-4 text-dim-gray transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-[rgba(255,255,255,0.06)] space-y-4">
          <div className="sm:hidden">
            <ScoreBar score={dim.score} max={dim.max} />
          </div>
          <p className="text-sm text-light-gray leading-relaxed">{dim.analysis}</p>
          {dim.evidence.length > 0 && (
            <div className="bg-card-surface border border-[rgba(255,255,255,0.06)] rounded-[10px] p-4 space-y-2">
              <p className="text-xs font-semibold text-dim-gray uppercase tracking-wide flex items-center gap-2">
                <Quote className="w-3.5 h-3.5" />
                证据
              </p>
              <ul className="space-y-2">
                {dim.evidence.map((item, evidenceIndex) => (
                  <li key={evidenceIndex} className="text-sm text-light-gray leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasAdvice && (
            <div className="bg-[rgba(255,188,51,0.05)] border border-[rgba(255,188,51,0.15)] rounded-[10px] p-4">
              <p className="text-xs font-semibold text-raycast-yellow uppercase tracking-wide mb-2">
                建议
              </p>
              <p className="text-sm text-light-gray leading-relaxed">{dim.advice}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function HQReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<HQReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("hq_report");
    if (!raw) {
      router.push("/");
      return;
    }
    try {
      setReport(JSON.parse(raw) as HQReport);
    } catch {
      setError("报告数据无效，请重新完成测评。");
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center text-raycast-red text-sm">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center text-dim-gray text-sm">
        加载中…
      </div>
    );
  }

  const { scores, overall, dimensions } = report;
  const recommendations = report.recommendations ?? [];
  const promptTemplates = report.promptTemplates ?? [];
  const levelMeta = LEVEL_META[scores.level];

  return (
    <div className="min-h-screen bg-void text-near-white">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        {/* 返回 */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-dim-gray hover:text-light-gray transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回测试首页
        </button>

        <div className="rounded-[12px] border border-[rgba(255,188,51,0.18)] bg-[rgba(255,188,51,0.06)] px-4 py-3 text-sm leading-relaxed text-light-gray">
          AI-HQ 模块正在重构中，下版本会以 AI-MBTI 报告补充模块的形式回来。
        </div>

        {/* 总分 + 等级 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs text-dim-gray uppercase tracking-wide mb-1">
                AI-HQ 报告
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-near-white">{scores.total}</span>
                <span className="text-xl text-dim-gray">/ 100</span>
              </div>
            </div>
            <span
              className={`text-sm font-semibold px-4 py-1.5 rounded-full border ${levelMeta.bg} ${levelMeta.color}`}
            >
              {scores.level} · {levelMeta.label}
            </span>
          </div>
          <p className="text-sm text-light-gray leading-relaxed">{overall}</p>
        </motion.div>

        {/* 维度得分概览 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          {dimensions.map((dim) => (
            <div
              key={dim.dimension}
              className="bg-surface-100 border border-[rgba(255,255,255,0.06)] shadow-card-ring rounded-[16px] p-4 space-y-2"
            >
              <p className="text-xs text-dim-gray">{dim.label}</p>
              <ScoreBar score={dim.score} max={dim.max} />
            </div>
          ))}
        </motion.div>

        {/* 维度详细分析 */}
        <div className="space-y-3">
          <p className="text-xs text-dim-gray uppercase tracking-wide">维度分析</p>
          {dimensions.map((dim, i) => (
            <DimensionCard key={dim.dimension} dim={dim} index={i} />
          ))}
        </div>

        {recommendations.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs text-dim-gray uppercase tracking-wide flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              下一次使用 AI 可以怎么做
            </p>
            <div className="grid gap-3">
              {recommendations.map((item, index) => (
                <div
                  key={index}
                  className="bg-surface-100 border border-[rgba(255,255,255,0.06)] shadow-card-ring rounded-[14px] p-4 text-sm text-light-gray leading-relaxed"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        )}

        {promptTemplates.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs text-dim-gray uppercase tracking-wide flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              可复制 Prompt 模板
            </p>
            <div className="grid gap-3">
              {promptTemplates.map((template, index) => (
                <article
                  key={index}
                  className="bg-surface-100 border border-[rgba(255,255,255,0.06)] shadow-card-ring rounded-[14px] p-4 space-y-3"
                >
                  <h3 className="text-sm font-semibold text-near-white">{template.title}</h3>
                  <pre className="whitespace-pre-wrap break-words rounded-[10px] bg-card-surface border border-[rgba(255,255,255,0.06)] p-3 text-sm leading-relaxed text-light-gray">
                    {template.prompt}
                  </pre>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
