"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HQReport } from "@/lib/types";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown } from "lucide-react";

const LEVEL_META = {
  L1: { label: "新手", color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20" },
  L2: { label: "熟悉", color: "text-indigo-400", bg: "bg-indigo-400/10 border-indigo-400/20" },
  L3: { label: "专家", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
};

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 75 ? "bg-emerald-400" : pct >= 50 ? "bg-indigo-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-gray-400 w-14 text-right">
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
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-medium text-white">{dim.label}</span>
          {hasAdvice && (
            <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              有建议
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 ml-4">
          <div className="w-32 hidden sm:block">
            <ScoreBar score={dim.score} max={dim.max} />
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-800 space-y-4">
          <div className="sm:hidden">
            <ScoreBar score={dim.score} max={dim.max} />
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{dim.analysis}</p>
          {hasAdvice && (
            <div className="bg-amber-400/5 border border-amber-400/15 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                建议
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{dim.advice}</p>
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        加载中…
      </div>
    );
  }

  const { scores, overall, dimensions } = report;
  const levelMeta = LEVEL_META[scores.level];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        {/* 返回 */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回测试首页
        </button>

        {/* 总分 + 等级 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                AI-HQ 报告
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-white">{scores.total}</span>
                <span className="text-xl text-gray-500">/ 100</span>
              </div>
            </div>
            <span
              className={`text-sm font-semibold px-4 py-1.5 rounded-full border ${levelMeta.bg} ${levelMeta.color}`}
            >
              {scores.level} · {levelMeta.label}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{overall}</p>
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
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2"
            >
              <p className="text-xs text-gray-500">{dim.label}</p>
              <ScoreBar score={dim.score} max={dim.max} />
            </div>
          ))}
        </motion.div>

        {/* 维度详细分析 */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">维度分析</p>
          {dimensions.map((dim, i) => (
            <DimensionCard key={dim.dimension} dim={dim} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
