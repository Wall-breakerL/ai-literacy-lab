"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DIMENSION_KEYS, DIMENSION_LABELS, RUBRIC_WEIGHTS } from "@/lib/constants";
import { copy } from "@/lib/copy";

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
      <main className="page-main">
        <h1 style={{ marginBottom: "var(--space-sm)", fontSize: "var(--text-2xl)", fontWeight: 700 }}>{copy.result.title}</h1>
        <p style={{ color: "var(--color-text-muted)" }}>{copy.result.noData}</p>
        <Link href="/" style={{ marginTop: "var(--space-md)", display: "inline-block", color: "var(--color-primary)", textDecoration: "underline" }}>
          {copy.result.backHome}
        </Link>
      </main>
    );
  }

  const scores = data.dimensionScores ?? {};
  const evidence = data.evidence ?? {};
  const suggestions = data.suggestions ?? [];
  const dimensionsRich = data.dimensions;
  const flags = data.flags ?? [];

  return (
    <main className="page-main">
      <h1 style={{ marginBottom: "var(--space-sm)", fontSize: "var(--text-2xl)", fontWeight: 700 }}>{copy.result.title}</h1>

      <section
        className="card"
        style={{
          padding: "var(--space-md)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <p style={{ marginBottom: "var(--space-xs)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>{copy.result.totalLabel}</p>
        <p style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>
          {data.weightedScore ?? "—"}
        </p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-subtle)" }}>{copy.result.totalHint}</p>
      </section>

      <section style={{ marginBottom: "var(--space-lg)" }}>
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-sm)" }}>{copy.result.dimensionsTitle}</h2>
        {dimensionsRich ? (
          <ul style={{ listStyle: "none" }}>
            {DIMENSION_KEYS.map((key) => {
              const dr = dimensionsRich[key];
              const level = dr?.level ?? scores[key];
              const reason = dr?.reason;
              const evList = dr?.evidence ?? evidence[key];
              return (
                <li
                  key={key}
                  style={{
                    padding: "var(--space-sm) 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: reason ? "var(--space-xs)" : 0 }}>
                    <span>
                      {DIMENSION_LABELS[key]}
                      <span style={{ color: "var(--color-text-subtle)", fontWeight: 400, marginLeft: "var(--space-xs)" }}>（{RUBRIC_WEIGHTS[key]}%）</span>
                    </span>
                    <span style={{ fontWeight: 600 }}>{level != null ? level : "—"}</span>
                  </div>
                  {reason && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>{reason}</p>}
                  {evList?.length > 0 && (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-subtle)", marginTop: "var(--space-xs)" }}>
                      {copy.result.evidenceLabel}：{evList.join("；")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {DIMENSION_KEYS.map((key) => (
            <li
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-sm) 0",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
                <span>
                  {DIMENSION_LABELS[key]}
                  <span style={{ color: "var(--color-text-subtle)", fontWeight: 400, marginLeft: "var(--space-xs)" }}>（{RUBRIC_WEIGHTS[key]}%）</span>
                </span>
                <span style={{ fontWeight: 600 }}>{scores[key] != null ? scores[key] : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {flags.length > 0 && (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-sm)" }}>{copy.result.flagsTitle}</h2>
          <ul style={{ paddingLeft: "1.25rem", color: "var(--color-text)", fontSize: "var(--text-sm)" }}>
            {flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {!dimensionsRich && Object.keys(evidence).length > 0 && (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-sm)" }}>{copy.result.evidenceLabel}（事件）</h2>
          <ul style={{ paddingLeft: "1.25rem", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            {DIMENSION_KEYS.filter((k) => evidence[k]?.length).map((key) => (
              <li key={key} style={{ marginBottom: "0.25rem" }}>
                <strong>{DIMENSION_LABELS[key]}</strong>：{evidence[key].join("、")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-sm)" }}>{copy.result.suggestionsTitle}</h2>
          <ul style={{ paddingLeft: "1.25rem", color: "var(--color-text)" }}>
            {suggestions.map((s, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginBottom: "var(--space-lg)" }}>
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {showMeta ? copy.result.metaCollapse : copy.result.metaToggle}
        </button>
        {showMeta && (
          <dl
            style={{
              marginTop: "var(--space-sm)",
              padding: "var(--space-sm)",
              background: "var(--color-surface-muted)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            <dt style={{ fontWeight: 600 }}>rubricVersion</dt>
            <dd style={{ marginBottom: "0.5rem" }}>{data.rubricVersion ?? "—"}</dd>
            <dt style={{ fontWeight: 600 }}>scenarioVersion</dt>
            <dd style={{ marginBottom: "0.5rem" }}>{data.scenarioVersion ?? "—"}</dd>
            <dt style={{ fontWeight: 600 }}>eventSchemaVersion</dt>
            <dd style={{ marginBottom: "0.5rem" }}>{data.eventSchemaVersion ?? "—"}</dd>
            <dt style={{ fontWeight: 600 }}>judgePromptVersion</dt>
            <dd style={{ marginBottom: "0.5rem" }}>{data.judgePromptVersion ?? "—"}</dd>
            <dt style={{ fontWeight: 600 }}>judgeModel</dt>
            <dd style={{ marginBottom: "0.5rem" }}>{data.judgeModel ?? "—"}</dd>
            <dt style={{ fontWeight: 600 }}>scoredAt</dt>
            <dd>{data.scoredAt ?? "—"}</dd>
          </dl>
        )}
      </section>

      <Link href="/profile" className="btn-primary">
        {copy.result.cta}
      </Link>
    </main>
  );
}
