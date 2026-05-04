"use client";

import { DimensionReport } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import { MarkdownText } from "@/components/MarkdownText";

interface DimensionCardProps {
  report: DimensionReport;
  index: number;
}

const DIMENSION_META: Record<
  DimensionReport["dimension"],
  { lowLabel: string; highLabel: string; lowLetter: string; highLetter: string; lowColor: string; highColor: string }
> = {
  Relation: { lowLabel: "工具型", highLabel: "伙伴型", lowLetter: "I", highLetter: "C", lowColor: "#2563eb", highColor: "#f97316" },
  Workflow: { lowLabel: "框架型", highLabel: "探索型", lowLetter: "F", highLetter: "E", lowColor: "#4f46e5", highColor: "#14b8a6" },
  Epistemic: { lowLabel: "审计型", highLabel: "信任型", lowLetter: "A", highLetter: "T", lowColor: "#64748b", highColor: "#fbbf24" },
  RepairScope: { lowLabel: "全局型", highLabel: "局部型", lowLetter: "G", highLetter: "L", lowColor: "#8b5cf6", highColor: "#10b981" },
};

function DimensionSpectrumBar({ report, index }: { report: DimensionReport; index: number }) {
  const meta = DIMENSION_META[report.dimension];
  const score = Math.max(0, Math.min(100, Math.round(report.score)));
  const accent = score >= 50 ? meta.highColor : meta.lowColor;
  const isExtreme = Math.abs(score - 50) >= 25;
  const lowScore = 100 - score;
  const highScore = score;

  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 sm:flex sm:gap-3">
      <span
        className="min-w-0 text-[11px] font-semibold leading-tight sm:whitespace-nowrap"
        style={{ color: meta.lowColor }}
      >
        {meta.lowLetter} {meta.lowLabel} {lowScore}
      </span>
      <span
        className="min-w-0 justify-self-end text-right text-[11px] font-semibold leading-tight sm:order-3 sm:whitespace-nowrap"
        style={{ color: meta.highColor }}
      >
        {highScore} {meta.highLabel} {meta.highLetter}
      </span>
      <div className="relative col-span-2 h-5 w-full min-w-0 sm:order-2 sm:w-28 sm:shrink-0">
        <div
          className="absolute left-0 right-0 top-[7px] h-2 rounded"
          style={{ background: `linear-gradient(90deg, ${meta.lowColor}, ${meta.highColor})` }}
        />
        <span className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.lowColor }} />
        <span className="absolute right-0 top-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.highColor }} />
        <motion.span
          className={`absolute top-0 rounded-[3px] border-2 border-[#1e293b] ${isExtreme ? "animate-pulse" : ""}`}
          initial={{ left: "50%" }}
          animate={{ left: `${score}%` }}
          transition={{ duration: 0.8, delay: index * 0.1 + 0.3, ease: "easeOut" }}
          style={{
            width: isExtreme ? 20 : 16,
            height: isExtreme ? 20 : 16,
            marginLeft: isExtreme ? -10 : -8,
            transform: "rotate(45deg)",
            backgroundColor: accent,
            boxShadow: `0 0 12px ${accent}90`,
          }}
        />
      </div>
    </div>
  );
}

export function DimensionCard({ report, index }: DimensionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = DIMENSION_META[report.dimension];
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
      whileHover={{ y: -4 }}
      className="bg-surface-100 rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-card-ring overflow-hidden hover:border-[rgba(85,179,255,0.3)] hover:shadow-glow-blue-sm transition-all duration-300"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full min-w-0 items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase mb-1">
              {report.label}
            </span>
            <span className="break-words text-[18px] font-medium text-near-white tracking-[0.2px]">
              {report.tendencyLabel}
            </span>
            <span className="mt-1 break-words text-[12px] text-dim-gray">
              基于 {answeredCount} 道有效回答 · {confidenceLabel}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden sm:block">
            <DimensionSpectrumBar report={report} index={index} />
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
            initial={{ height: 0, opacity: 0, scale: 0.95 }}
            animate={{ height: "auto", opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              className="px-6 pb-6 space-y-5 border-t border-[rgba(255,255,255,0.06)] pt-5"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.1,
                  },
                },
              }}
            >
              {/* Mobile spectrum bar */}
              <motion.div
                className="sm:hidden"
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              >
                <DimensionSpectrumBar report={report} index={index} />
              </motion.div>

              {/* Analysis */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-raycast-blue" />
                  <p className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase">
                    模型分析
                  </p>
                </div>
                <MarkdownText content={analysisContent} variant="body" />
              </motion.div>
            </motion.div>
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
