"use client";

import { DimensionReport } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { BarChart3, ChevronDown, Quote } from "lucide-react";
import { MarkdownText } from "@/components/MarkdownText";

interface DimensionCardProps {
  report: DimensionReport;
  index: number;
}

export function DimensionCard({ report, index }: DimensionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const DIMENSION_META: Record<
    DimensionReport["dimension"],
    { lowLabel: string; highLabel: string; lowLetter: string; highLetter: string }
  > = {
    Relation: { lowLabel: "工具型", highLabel: "伙伴型", lowLetter: "I", highLetter: "C" },
    Workflow: { lowLabel: "框架型", highLabel: "探索型", lowLetter: "F", highLetter: "E" },
    Epistemic: { lowLabel: "审计型", highLabel: "信任型", lowLetter: "A", highLetter: "T" },
    RepairScope: { lowLabel: "全局型", highLabel: "局部型", lowLetter: "G", highLetter: "L" },
  };
  const meta = DIMENSION_META[report.dimension];
  const lowScore = Math.max(0, Math.min(100, Math.round(100 - report.score)));
  const highScore = Math.max(0, Math.min(100, Math.round(report.score)));
  const answeredCount = report.answeredCount ?? 0;
  const skippedCount = report.skippedCount ?? 0;
  const confidenceLabel =
    report.confidence === "high" ? "证据充分" : report.confidence === "medium" ? "证据适中" : "初步观察";
  const analysisContent = report.analysis?.trim() || buildLocalAnalysisFallback({
    label: report.label,
    tendencyLabel: report.tendencyLabel,
    score: report.score,
    answeredCount,
    skippedCount,
    evidence: report.evidence,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-surface-100 rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-card-ring overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase mb-1">
              {report.label}
            </span>
            <span className="text-[18px] font-medium text-near-white tracking-[0.2px]">
              {report.tendencyLabel}
            </span>
            <span className="text-[12px] text-dim-gray mt-1">
              基于 {answeredCount} 道有效回答 · {confidenceLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Score bar */}
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-dim-gray whitespace-nowrap">
              {meta.lowLetter} · {meta.lowLabel} {lowScore}
            </span>
            <div className="w-24 h-1.5 bg-dark-border rounded-full overflow-hidden">
              <div
                className="h-full bg-raycast-blue rounded-full transition-all duration-700"
                style={{ width: `${report.score}%` }}
              />
            </div>
            <span className="text-[12px] text-dim-gray whitespace-nowrap">
              {meta.highLetter} · {meta.highLabel} {highScore}
            </span>
          </div>

          <ChevronDown
            className={`w-4 h-4 text-dim-gray transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-5 border-t border-[rgba(255,255,255,0.06)] pt-5">
              {/* Basis */}
              <div>
                <p className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase mb-3">
                  判断依据
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-card-surface px-4 py-3">
                    <p className="text-[11px] text-dim-gray mb-1">有效回答</p>
                    <p className="text-[16px] font-semibold text-near-white">{answeredCount} 题</p>
                  </div>
                  <div className="rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-card-surface px-4 py-3">
                    <p className="text-[11px] text-dim-gray mb-1">跳过 / 不适用</p>
                    <p className="text-[16px] font-semibold text-near-white">{skippedCount} 题</p>
                  </div>
                  <div className="rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-card-surface px-4 py-3">
                    <p className="text-[11px] text-dim-gray mb-1">当前判定</p>
                    <p className="text-[16px] font-semibold text-near-white">{report.tendencyLabel}</p>
                  </div>
                </div>
              </div>

              {/* Evidence */}
              {report.evidence.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase mb-3">
                    用户原话 / 答题证据
                  </p>
                  <div className="space-y-2">
                    {report.evidence.map((quote, i) => (
                      <div
                        key={i}
                        className="flex gap-3 bg-card-surface rounded-[8px] px-4 py-3 border border-[rgba(255,255,255,0.04)]"
                      >
                        <Quote className="w-4 h-4 text-raycast-blue flex-shrink-0 mt-0.5" />
                        <p className="min-w-0 break-words text-[14px] text-light-gray leading-[1.6] italic">
                          {quote}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-raycast-blue" />
                  <p className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase">
                    模型分析
                  </p>
                </div>
                <MarkdownText content={analysisContent} variant="body" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function buildLocalAnalysisFallback({
  label,
  tendencyLabel,
  score,
  answeredCount,
  skippedCount,
  evidence,
}: {
  label: string;
  tendencyLabel: string;
  score: number;
  answeredCount: number;
  skippedCount: number;
  evidence: string[];
}) {
  const evidenceText = evidence.length
    ? evidence.slice(0, 2).map((item) => `「${item}」`).join("、")
    : "当前有效回答";
  const skippedText = skippedCount > 0 ? `，另有 ${skippedCount} 题跳过或不适用` : "";
  return `从当前数据看，${label} 有 ${answeredCount} 题有效${skippedText}，分数为 ${score}，更接近「${tendencyLabel}」。主要依据是 ${evidenceText}。`;
}
