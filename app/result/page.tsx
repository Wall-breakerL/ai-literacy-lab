"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { V2_DIMENSION_LABELS } from "@/lib/assessment-v2/labels";
import type { V2DimensionKey } from "@/lib/assessment-v2/weights";
import { chatAgainPathFromBrowser } from "@/lib/chat-entry";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RESULT_STORAGE_KEY = "ai-literacy-last-result";

type V2Dim = { score: number; max: number; evidence: string[]; reason: string };

type PhaseScoreData = {
  phase: string;
  score: number;
  dimensions?: Record<string, V2Dim>;
  eventCounts?: Record<string, number>;
};

type StoredResultV2 = {
  kind: "v2";
  weightedScore?: number;
  dimensions?: Record<string, V2Dim>;
  flags?: string[];
  suggestions?: string[];
  blindSpots?: string[];
  nextRecommendedScenarios?: string[];
  nextRecommendedProbes?: string[];
  rubricVersion?: string;
  scenarioVersion?: string;
  blueprintVersion?: string;
  eventSchemaVersion?: string;
  memorySchemaVersion?: string;
  judgePromptVersion?: string;
  judgeModel?: string;
  identityVersion?: string;
  scoredAt?: string;
  events?: { event: string; turnIndex?: number; phase?: string }[];
  rawJudgeJson?: unknown;
  phaseScores?: {
    helper: PhaseScoreData;
    talk: PhaseScoreData;
    weights: { helper: number; talk: number };
  };
  talkPrompt?: string;
  phaseSwitchTurn?: number;
};

const LAYER_A: V2DimensionKey[] = ["taskFraming", "dialogSteering", "evidenceSeeking"];
const LAYER_B: V2DimensionKey[] = [
  "modelMentalModel",
  "failureAwareness",
  "trustBoundaryCalibration",
  "reflectiveTransfer",
];

type LoadState =
  | { status: "pending" }
  | { status: "empty" }
  | { status: "legacy_cache" }
  | { status: "ok"; data: StoredResultV2 };

export default function ResultPage() {
  const [load, setLoad] = useState<LoadState>({ status: "pending" });
  const [showMeta, setShowMeta] = useState(false);
  const [showResearcher, setShowResearcher] = useState(false);
  const [showPhaseScores, setShowPhaseScores] = useState(false);
  const [chatAgainHref, setChatAgainHref] = useState("/setup");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw?.trim()) {
      setLoad({ status: "empty" });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { kind?: string };
      if (parsed?.kind !== "v2") {
        setLoad({ status: "legacy_cache" });
      } else {
        setLoad({ status: "ok", data: parsed as StoredResultV2 });
      }
    } catch {
      setLoad({ status: "legacy_cache" });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setChatAgainHref(chatAgainPathFromBrowser());
  }, []);

  if (load.status === "pending") {
    return (
      <main className="glass-page">
        <p className="text-sm text-muted-foreground">{copy.common.redirecting}</p>
      </main>
    );
  }

  if (load.status === "empty") {
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

  if (load.status === "legacy_cache") {
    return (
      <main className="glass-page">
        <Card>
          <CardHeader>
            <CardTitle className="section-title">{copy.result.title}</CardTitle>
            <CardDescription>{copy.result.legacyUnsupported}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/">{copy.result.backHome}</Link>
            </Button>
            <Button asChild>
              <Link href={chatAgainHref}>{copy.result.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const data = load.data;
  const dims = data.dimensions ?? {};
  const flags = data.flags ?? [];
  const suggestions = data.suggestions ?? [];

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
          <CardTitle className="text-lg">{copy.result.layerA}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {LAYER_A.map((key, idx) => renderV2Dim(key, dims[key], idx))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{copy.result.layerB}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {LAYER_B.map((key, idx) => renderV2Dim(key, dims[key], idx))}
        </CardContent>
      </Card>

      {data.blindSpots && data.blindSpots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.result.blindSpotsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-foreground">
              {data.blindSpots.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(data.nextRecommendedScenarios?.length || data.nextRecommendedProbes?.length) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.result.nextTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {data.nextRecommendedScenarios && data.nextRecommendedScenarios.length > 0 && (
              <p>
                <span className="font-medium text-foreground">场景：</span>
                {data.nextRecommendedScenarios.join("、")}
              </p>
            )}
            {data.nextRecommendedProbes && data.nextRecommendedProbes.length > 0 && (
              <p>
                <span className="font-medium text-foreground">探针：</span>
                {data.nextRecommendedProbes.join("、")}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

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
        <CardContent className="space-y-3 pt-6">
          {data.phaseScores && (
            <>
              <button
                type="button"
                onClick={() => setShowPhaseScores((v) => !v)}
                className="text-sm text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
              >
                {showPhaseScores ? copy.result.metaCollapse : copy.result.phaseScoresTitle}
              </button>
              {showPhaseScores && (
                <div className="glass-inset space-y-3 p-3 text-sm">
                  {data.talkPrompt && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{copy.result.talkPrompt}：</span>
                      {data.talkPrompt}
                    </p>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {(["helper", "talk"] as const).map((ph) => {
                      const ps = data.phaseScores![ph];
                      const w = data.phaseScores!.weights[ph];
                      return (
                        <div key={ph} className="rounded-lg border border-border p-3">
                          <p className="font-medium text-foreground">
                            {ph === "helper" ? copy.result.phaseHelper : copy.result.phaseTalk}
                          </p>
                          <p className="mt-1 tabular-nums">
                            {ps.score} <span className="text-xs text-muted-foreground">({copy.result.phaseWeight} {w})</span>
                          </p>
                          {ps.eventCounts && Object.keys(ps.eventCounts).length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {copy.result.phaseEvents}：{Object.entries(ps.eventCounts).map(([k, v]) => `${k}:${v}`).join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setShowMeta((v) => !v)}
            className="text-sm text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
          >
            {showMeta ? copy.result.metaCollapse : copy.result.metaToggle}
          </button>
          {showMeta && (
            <dl className="glass-inset grid gap-2 p-3 text-sm text-muted-foreground">
              <MetaRow label="rubricVersion" value={data.rubricVersion} />
              <MetaRow label="scenarioVersion" value={data.scenarioVersion} />
              <MetaRow label="blueprintVersion" value={data.blueprintVersion} />
              <MetaRow label="eventSchemaVersion" value={data.eventSchemaVersion} />
              <MetaRow label="memorySchemaVersion" value={data.memorySchemaVersion} />
              <MetaRow label="identityVersion" value={data.identityVersion} />
              <MetaRow label="judgePromptVersion" value={data.judgePromptVersion} />
              <MetaRow label="judgeModel" value={data.judgeModel} />
              <MetaRow label="scoredAt" value={data.scoredAt} />
            </dl>
          )}
          <button
            type="button"
            onClick={() => setShowResearcher((v) => !v)}
            className="text-sm text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
          >
            {copy.result.researcherToggle}
          </button>
          {showResearcher && (
            <pre className="glass-inset max-h-64 overflow-auto p-3 text-xs">
              {JSON.stringify({ events: data.events, phaseScores: data.phaseScores, rawJudgeJson: data.rawJudgeJson }, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={chatAgainHref}>{copy.result.cta}</Link>
        </Button>
        <p className="text-xs text-muted-foreground">{copy.result.ctaHint}</p>
      </div>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <dt className="font-semibold text-foreground">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </>
  );
}

function renderV2Dim(key: V2DimensionKey, d: V2Dim | undefined, idx: number) {
  const label = V2_DIMENSION_LABELS[key];
  const score = d?.score;
  const max = d?.max ?? 0;
  return (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: idx * 0.04 }}
      className="glass-inset p-4 transition-shadow hover:shadow-[0_0_24px_-10px_rgba(99,102,241,0.15)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <span className="rounded-lg border border-border bg-card px-2 py-0.5 text-sm font-semibold tabular-nums text-foreground">
          {score != null ? `${score} / ${max}` : "—"}
        </span>
      </div>
      {d?.reason && <p className="text-sm text-muted-foreground">{d.reason}</p>}
      {d?.evidence?.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {copy.result.evidenceLabel}：{d.evidence.join("；")}
        </p>
      ) : null}
    </motion.div>
  );
}
