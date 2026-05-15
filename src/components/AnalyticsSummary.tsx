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
    <div className="text-center text-xs text-medium-gray">
      <span>已有 {summary.totalVisitors.toLocaleString("zh-CN")} 人访问 AI-MBTI</span>
    </div>
  );
}
