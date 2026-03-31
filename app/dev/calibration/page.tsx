"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface CalibrationResponse {
  calibration: {
    totalSessions: number;
    probeHitRate: Array<{
      probeId: string;
      overallHitRate: number;
      apartmentHitRate: number;
      brandHitRate: number;
      scoreVariance: number;
    }>;
    dimensionCoverage: Array<{ dimensionId: string; apartmentCoverage: number; brandCoverage: number }>;
    oneSceneDominantDimensions: string[];
    evidenceInsufficientSessions: string[];
    largeDirectionShiftSessions: string[];
    lowDiscriminativeProbes: string[];
  };
  coverage: {
    coverageStatus: "good" | "partial" | "insufficient";
    highlights: string[];
    gaps: string[];
    probeSuggestions: string[];
  };
}

export default function CalibrationPage() {
  const [data, setData] = useState<CalibrationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/dev/calibration");
        if (!response.ok) throw new Error("calibration 加载失败");
        setData((await response.json()) as CalibrationResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Calibration & Coverage</h1>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {!data ? null : (
        <div className="mt-4 space-y-4">
          <Card className="p-4">
            <p className="type-code text-xs text-lab-accent">总样本</p>
            <p className="mt-1 text-lg">{data.calibration.totalSessions}</p>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold">Probe 命中率</h2>
            <div className="mt-3 overflow-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="text-lab-muted">
                    <th className="py-1">probeId</th>
                    <th>overall%</th>
                    <th>apartment%</th>
                    <th>brand%</th>
                    <th>delta variance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.calibration.probeHitRate.map((probe) => (
                    <tr className="border-t border-lab" key={probe.probeId}>
                      <td className="py-1 type-code">{probe.probeId}</td>
                      <td>{probe.overallHitRate}</td>
                      <td>{probe.apartmentHitRate}</td>
                      <td>{probe.brandHitRate}</td>
                      <td>{probe.scoreVariance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold">Scene-level 维度覆盖</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {data.calibration.dimensionCoverage.map((dimension) => (
                <div className="rounded border border-lab bg-lab-panel p-3 text-xs" key={dimension.dimensionId}>
                  <p className="type-code text-lab-accent">{dimension.dimensionId}</p>
                  <p className="mt-1 text-lab-muted">
                    Apartment: {dimension.apartmentCoverage}% · Brand: {dimension.brandCoverage}%
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold">差异与风险提示</h2>
            <ul className="mt-2 space-y-1 text-sm text-lab-muted">
              <li>单场景主导维度：{data.calibration.oneSceneDominantDimensions.join(", ") || "-"}</li>
              <li>证据不足 sessions：{data.calibration.evidenceInsufficientSessions.join(", ") || "-"}</li>
              <li>方向波动大 sessions：{data.calibration.largeDirectionShiftSessions.join(", ") || "-"}</li>
              <li>低区分 probes：{data.calibration.lowDiscriminativeProbes.join(", ") || "-"}</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold">Coverage Report（描述性）</h2>
            <p className="mt-1 text-sm">status: {data.coverage.coverageStatus}</p>
            <p className="mt-2 type-code text-xs text-lab-accent">highlights</p>
            <ul className="mt-1 space-y-1 text-sm text-lab-muted">
              {data.coverage.highlights.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
            <p className="mt-3 type-code text-xs text-lab-accent">gaps</p>
            <ul className="mt-1 space-y-1 text-sm text-lab-muted">
              {data.coverage.gaps.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
            <p className="mt-3 type-code text-xs text-lab-accent">probe suggestions</p>
            <ul className="mt-1 space-y-1 text-sm text-lab-muted">
              {data.coverage.probeSuggestions.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold">导出</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <a className="rounded border border-lab bg-lab-panel px-3 py-1.5" href="/api/dev/exports/transcript">
                transcript JSONL
              </a>
              <a className="rounded border border-lab bg-lab-panel px-3 py-1.5" href="/api/dev/exports/score-events">
                score events CSV
              </a>
              <a className="rounded border border-lab bg-lab-panel px-3 py-1.5" href="/api/dev/exports/session-summary">
                session summary CSV
              </a>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}

