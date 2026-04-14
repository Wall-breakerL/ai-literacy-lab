"use client";

import { CoverageStatus, Dimension } from "@/lib/types";
import { motion } from "framer-motion";

interface ProgressIndicatorProps {
  coverage: Record<Dimension, CoverageStatus>;
}

export function ProgressIndicator({ coverage }: ProgressIndicatorProps) {
  const dimensions: { key: Dimension; label: string }[] = [
    { key: "Relation", label: "关系" },
    { key: "Workflow", label: "工作流" },
    { key: "Epistemic", label: "认知" },
    { key: "RepairScope", label: "修复" },
  ];

  return (
    <div className="flex gap-2 items-center justify-center py-2 px-4 bg-surface-100 rounded-pill border border-[rgba(255,255,255,0.06)] shadow-card-ring">
      <span className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray mr-2 uppercase">
        分析进度
      </span>
      {dimensions.map((dim) => {
        const status = coverage?.[dim.key] || "uncovered";

        let bgColor = "bg-dark-border";
        let shadow = "";

        if (status === "weak") {
          bgColor = "bg-raycast-yellow";
          shadow = "shadow-[0_0_8px_rgba(255,188,51,0.4)]";
        } else if (status === "covered") {
          bgColor = "bg-raycast-green";
          shadow = "shadow-[0_0_8px_rgba(95,201,146,0.4)]";
        }

        return (
          <div key={dim.key} className="group relative">
            <motion.div
              className={`w-2 h-2 rounded-full ${bgColor} ${shadow} transition-shadow duration-500`}
              initial={false}
              animate={{ scale: status === "uncovered" ? 1 : 1.08 }}
              transition={{ duration: 0.2 }}
            />

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1b1c1e] border border-[#252829] rounded text-[10px] text-light-gray whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {dim.label}: {status === "uncovered" ? "待探索" : status === "weak" ? "需追问" : "已完成"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
