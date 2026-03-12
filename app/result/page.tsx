"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DIMENSION_KEYS, DIMENSION_LABELS } from "@/lib/constants";

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
      <main style={{ padding: "2rem", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>评估结果</h1>
        <p style={{ color: "#555" }}>
          未找到本次评估数据，请从首页重新开始。
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: "1rem",
            color: "#111",
            textDecoration: "underline",
          }}
        >
          返回首页
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
    <main style={{ padding: "2rem", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>评估结果</h1>

      <section
        style={{
          padding: "1rem",
          background: "#f5f5f5",
          borderRadius: 8,
          marginBottom: "1.5rem",
        }}
      >
        <p style={{ marginBottom: "0.25rem", color: "#555" }}>总分（加权）</p>
        <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          {data.weightedScore ?? "—"}
        </p>
        <p style={{ fontSize: "0.85rem", color: "#888" }}>满分 100，按五维权重换算</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>五维得分</h2>
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
                    padding: "0.75rem 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: reason ? "0.25rem" : 0 }}>
                    <span>{DIMENSION_LABELS[key]}</span>
                    <span style={{ fontWeight: 600 }}>{level != null ? level : "—"}</span>
                  </div>
                  {reason && <p style={{ fontSize: "0.85rem", color: "#666", margin: 0 }}>{reason}</p>}
                  {evList?.length > 0 && (
                    <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.25rem" }}>
                      证据：{evList.join("；")}
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
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>{DIMENSION_LABELS[key]}</span>
                <span style={{ fontWeight: 600 }}>{scores[key] != null ? scores[key] : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {flags.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>标记</h2>
          <ul style={{ paddingLeft: "1.25rem", color: "#c00", fontSize: "0.9rem" }}>
            {flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {!dimensionsRich && Object.keys(evidence).length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>证据（事件）</h2>
          <ul style={{ paddingLeft: "1.25rem", color: "#555", fontSize: "0.9rem" }}>
            {DIMENSION_KEYS.filter((k) => evidence[k]?.length).map((key) => (
              <li key={key} style={{ marginBottom: "0.25rem" }}>
                <strong>{DIMENSION_LABELS[key]}</strong>：{evidence[key].join("、")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>建议</h2>
          <ul style={{ paddingLeft: "1.25rem", color: "#333" }}>
            {suggestions.map((s, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "#666",
            fontSize: "0.9rem",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {showMeta ? "收起" : "关于本次评估（版本信息）"}
        </button>
        {showMeta && (
          <dl
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem",
              background: "#f9f9f9",
              borderRadius: 6,
              fontSize: "0.85rem",
              color: "#666",
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

      <Link
        href="/profile"
        style={{
          display: "inline-block",
          padding: "0.6rem 1.2rem",
          background: "#111",
          color: "#fff",
          borderRadius: 6,
        }}
      >
        再测一次
      </Link>
    </main>
  );
}
