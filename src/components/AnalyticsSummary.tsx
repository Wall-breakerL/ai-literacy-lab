"use client";

import { useEffect, useState } from "react";
import type { PublicAnalyticsSummary } from "@/lib/analytics/shared";

export function AnalyticsSummary() {
  const [summary, setSummary] = useState<PublicAnalyticsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/analytics/summary", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: PublicAnalyticsSummary | null) => {
        if (!cancelled && data) setSummary(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary || summary.totalVisitors <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-medium-gray">
      <span>已有 {summary.totalVisitors.toLocaleString("zh-CN")} 人访问 AI-MBTI</span>
      <span className="hidden h-1 w-1 rounded-full bg-dark-gray sm:inline-block" />
      <span>累计完成 {summary.completedTestsTotal.toLocaleString("zh-CN")} 份测试</span>
    </div>
  );
}
