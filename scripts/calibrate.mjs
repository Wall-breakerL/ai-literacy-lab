#!/usr/bin/env node
/**
 * 离线校准占位流水线：读取 data/runtime/experiences/*.json，输出聚合报告到 reports/
 * 使用：node scripts/calibrate.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const expDir = path.join(root, "data", "runtime", "experiences");
const reportsDir = path.join(root, "reports");

function main() {
  let files = [];
  try {
    files = fs.readdirSync(expDir).filter((f) => f.endsWith(".json"));
  } catch {
    console.warn("No experiences dir or empty:", expDir);
  }

  const cards = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(expDir, f), "utf-8"));
      cards.push(raw);
    } catch {
      /* skip */
    }
  }

  const probeCoverageGap = {};
  const rubricDrift = { note: "对比专家标注后填写；当前为自动占位", byVersion: {} };
  const scenarioPoolWeakness = {};
  for (const c of cards) {
    for (const p of c.nextRecommendedProbes ?? []) {
      probeCoverageGap[p] = (probeCoverageGap[p] ?? 0) + 1;
    }
    const sid = c.scenarioId ?? "unknown";
    scenarioPoolWeakness[sid] = (scenarioPoolWeakness[sid] ?? 0) + 1;
  }

  const judgePromptRevisionCandidates = [
    {
      id: "candidate-1",
      note: "若 failureAwareness 与 evidenceSeeking 系统性偏低，可在 Judge 提示中强化「区分事实与模型陈述」示例。",
      requiresHumanReview: true,
    },
  ];

  fs.mkdirSync(reportsDir, { recursive: true });
  const out = {
    generatedAt: new Date().toISOString(),
    experienceCount: cards.length,
    probeCoverageGap,
    rubricDrift,
    scenarioPoolWeakness,
    judgePromptRevisionCandidates,
  };
  fs.writeFileSync(path.join(reportsDir, "calibration_aggregate.json"), JSON.stringify(out, null, 2));
  fs.writeFileSync(
    path.join(reportsDir, "rubric_drift_summary.md"),
    `# Rubric drift summary (auto)\n\n- experiences: ${cards.length}\n- See calibration_aggregate.json for details.\n`
  );
  console.log("Wrote reports/calibration_aggregate.json and reports/rubric_drift_summary.md");
}

main();
