"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DIMENSION_KEYS, DIMENSION_LABELS, RUBRIC_WEIGHTS } from "@/lib/constants";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RESULT_STORAGE_KEY = "ai-literacy-last-result";

type DimensionRich = { level: number; evidence: string[]; reason: string };

type StoredResult = {
  weightedScore?: number;
  dimensionScores?: Record<string, number>;
  evidence?: Record<string, string[]>;
  suggestions?: string[];
  dimensions?: Record<string, DimensionRich>;
  flags?: string[];
  rubricVersion?: string;
  scenarioVersion?: string;
  eventSchemaVersion?: string;
  judgePromptVersion?: string;
  judgeModel?: string;
  scoredAt?: string;
};

export default function ResultPage() {
  const [data, setData] = useState<StoredResult | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(RESULT_STORAGE_KEY);
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch {
        setData(null);
      }
    }
  }, []);

  if (data === null) {
    return (
      <main className="glass-page">
        <Card>
          <CardHeader>
            <CardTitle className="section-title">{copy.result.title}</CardTitle>
            <CardDescription>{copy.result.noData}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/">{copy.result.backHome}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const scores = data.dimensionScores ?? {};
  const evidence = data.evidence ?? {};
  const suggestions = data.suggestions ?? [];
  const dimensionsRich = data.dimensions;
  const flags = data.flags ?? [];

  return (
    <main className="glass-page max-w-4xl space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="relative overflow-hidden pt-0 ring-1 ring-indigo-200/25">
          <div
            className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-400/80 via-indigo-500/90 to-violet-500/80 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
            aria-hidden
          />
          <CardHeader className="pt-6">
            <CardTitle className="section-title">{copy.result.title}</CardTitle>
            <CardDescription>{copy.result.totalHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {copy.result.totalLabel}
            </p>
            <p className="tech-score-value mt-1">{data.weightedScore ?? "—"}</p>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{copy.result.dimensionsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {DIMENSION_KEYS.map((key, idx) => {
            const dr = dimensionsRich?.[key];
            const level = dr?.level ?? scores[key];
            const reason = dr?.reason;
            const evList = dr?.evidence ?? evidence[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className="glass-inset p-4 transition-shadow hover:shadow-[0_0_24px_-10px_rgba(99,102,241,0.15)]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {DIMENSION_LABELS[key]}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      （{RUBRIC_WEIGHTS[key]}%）
                    </span>
                  </p>
                  <span className="rounded-lg border border-border bg-card px-2 py-0.5 text-sm font-semibold tabular-nums text-foreground">
                    {level != null ? level : "—"}
                  </span>
                </div>
                {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
                {evList?.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copy.result.evidenceLabel}：{evList.join("；")}
                  </p>
                ) : null}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.result.flagsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-foreground">
              {flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!dimensionsRich && Object.keys(evidence).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.result.evidenceLabel}（事件）</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {DIMENSION_KEYS.filter((k) => evidence[k]?.length).map((key) => (
                <li key={key}>
                  <strong className="text-foreground">{DIMENSION_LABELS[key]}</strong>：
                  {evidence[key].join("、")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.result.suggestionsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-foreground">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card/60">
        <CardContent className="pt-6">
          <button
            type="button"
            onClick={() => setShowMeta((v) => !v)}
            className="text-sm text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
          >
            {showMeta ? copy.result.metaCollapse : copy.result.metaToggle}
          </button>
          {showMeta && (
            <dl className="glass-inset mt-3 grid gap-2 p-3 text-sm text-muted-foreground">
              <dt className="font-semibold text-foreground">rubricVersion</dt>
              <dd>{data.rubricVersion ?? "—"}</dd>
              <dt className="font-semibold text-foreground">scenarioVersion</dt>
              <dd>{data.scenarioVersion ?? "—"}</dd>
              <dt className="font-semibold text-foreground">eventSchemaVersion</dt>
              <dd>{data.eventSchemaVersion ?? "—"}</dd>
              <dt className="font-semibold text-foreground">judgePromptVersion</dt>
              <dd>{data.judgePromptVersion ?? "—"}</dd>
              <dt className="font-semibold text-foreground">judgeModel</dt>
              <dd>{data.judgeModel ?? "—"}</dd>
              <dt className="font-semibold text-foreground">scoredAt</dt>
              <dd>{data.scoredAt ?? "—"}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href="/profile">{copy.result.cta}</Link>
      </Button>
    </main>
  );
}
