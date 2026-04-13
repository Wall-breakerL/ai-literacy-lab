"use client";

import { DimensionReport } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Quote } from "lucide-react";

interface DimensionCardProps {
  report: DimensionReport;
  index: number;
}

export function DimensionCard({ report, index }: DimensionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor =
    report.score < 30
      ? "text-raycast-blue"
      : report.score > 70
      ? "text-raycast-red"
      : "text-raycast-yellow";

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
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Score bar */}
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-dim-gray">工具型</span>
            <div className="w-24 h-1.5 bg-dark-border rounded-full overflow-hidden">
              <div
                className="h-full bg-raycast-blue rounded-full transition-all duration-700"
                style={{ width: `${report.score}%` }}
              />
            </div>
            <span className="text-[12px] text-dim-gray">伙伴型</span>
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
              {/* Evidence */}
              {report.evidence.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase mb-3">
                    你说过
                  </p>
                  <div className="space-y-2">
                    {report.evidence.map((quote, i) => (
                      <div
                        key={i}
                        className="flex gap-3 bg-card-surface rounded-[8px] px-4 py-3 border border-[rgba(255,255,255,0.04)]"
                      >
                        <Quote className="w-4 h-4 text-raycast-blue flex-shrink-0 mt-0.5" />
                        <p className="text-[14px] text-light-gray leading-[1.6] italic">
                          {quote}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis */}
              <div>
                <p className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray uppercase mb-2">
                  分析
                </p>
                <p className="text-[15px] text-light-gray leading-[1.7] tracking-[0.2px]">
                  {report.analysis}
                </p>
              </div>

              {/* Advice */}
              <div className="bg-[rgba(85,179,255,0.05)] border border-[rgba(85,179,255,0.12)] rounded-[10px] p-4">
                <p className="text-[12px] font-semibold tracking-[0.4px] text-raycast-blue uppercase mb-2">
                  进阶建议
                </p>
                <p className="text-[15px] text-light-gray leading-[1.7] tracking-[0.2px]">
                  {report.advice}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
