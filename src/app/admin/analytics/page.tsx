"use client";

import { useState } from "react";
import type { AdminAnalyticsSummary } from "@/lib/analytics/shared";

export default function AdminAnalyticsPage() {
  const [token, setToken] = useState("");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/analytics/summary?from=${from}&to=${to}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.error === "unauthorized" ? "Token 无效或未配置。" : "统计数据读取失败。");
      }
      setSummary(data as AdminAnalyticsSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "统计数据读取失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b1020] px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-raycast-blue">Internal Analytics</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">AI-MBTI 数据面板</h1>
            <p className="mt-2 text-sm text-slate-400">当前只记录访问、测试结果和问卷样本。</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[150px_150px_220px_auto]">
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-10 rounded-[8px] border border-white/10 bg-[#111827] px-3 text-sm outline-none focus:border-raycast-blue"
            />
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-10 rounded-[8px] border border-white/10 bg-[#111827] px-3 text-sm outline-none focus:border-raycast-blue"
            />
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ADMIN_ANALYTICS_TOKEN"
              className="h-10 rounded-[8px] border border-white/10 bg-[#111827] px-3 text-sm outline-none focus:border-raycast-blue"
            />
            <button
              type="button"
              onClick={loadSummary}
              disabled={loading}
              className="h-10 rounded-[8px] bg-white px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {loading ? "读取中..." : "刷新"}
            </button>
          </div>
        </header>

        {error ? (
          <p className="mt-5 rounded-[8px] border border-raycast-red/30 bg-raycast-red/10 px-4 py-3 text-sm text-raycast-red">
            {error}
          </p>
        ) : null}

        {summary ? (
          <div className="mt-6 space-y-6">
            <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Metric label="累计访客" value={summary.totals.totalVisitors} highlight />
              <Metric label="今日访客" value={summary.totals.todayVisitors} />
              <Metric label="访问次数" value={summary.totals.totalVisits} />
              <Metric label="完成测试" value={summary.totals.completedTests} highlight />
              <Metric label="问卷样本" value={summary.totals.questionnaireSamples} />
              <Metric label="完成/访客" value={`${Math.round(summary.totals.completionRate * 100)}%`} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <DistributionTable
                title="人格结果分布"
                empty="暂无测试结果。"
                headers={["类型", "名称", "数量"]}
                rows={summary.personalityDistribution.map((item) => [
                  item.personalityCode,
                  item.personalityName,
                  formatNumber(item.count),
                ])}
              />
              <DistributionTable
                title="职业分布"
                empty="暂无职业样本。"
                headers={["职业", "完成测试", "访客"]}
                rows={summary.roleDistribution.map((item) => [
                  item.role,
                  formatNumber(item.completedTests),
                  formatNumber(item.visitors),
                ])}
              />
            </section>
          </div>
        ) : (
          <p className="mt-10 text-sm text-slate-500">输入 token 后读取统计数据。</p>
        )}
      </div>
    </main>
  );
}

function DistributionTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string;
  empty: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-[8px] border border-white/10 bg-[#111827] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                {headers.map((header, index) => (
                  <th key={header} className={`py-2 ${index > 0 ? "text-right" : ""}`}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.join("-")} className="border-t border-white/10">
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`} className={`py-2 ${index > 0 ? "text-right" : "text-slate-300"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-[#111827] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${highlight ? "text-raycast-yellow" : "text-white"}`}>
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 13);
  return date.toISOString().slice(0, 10);
}
