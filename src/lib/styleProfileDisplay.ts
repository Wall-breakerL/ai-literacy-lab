import type { Dimension, DimensionReport, FinalReport, ReportProblem } from "@/lib/types";

export type StyleProfileDisplay = {
  description: string;
  strengths: string[];
  weaknesses: string[];
};

const DIMENSION_LABELS: Record<Dimension, { low: string; high: string }> = {
  Relation: { low: "工具型", high: "伙伴型" },
  Workflow: { low: "探索型", high: "框架型" },
  Epistemic: { low: "信任型", high: "审计型" },
  RepairScope: { low: "局部型", high: "全局型" },
};

const STRENGTH_COPY: Record<Dimension, { low: string; high: string }> = {
  Relation: {
    low: "你能把 AI 当作明确的执行工具，指令边界通常比较清楚。",
    high: "你愿意让 AI 参与讨论，容易从对话中获得新的角度。",
  },
  Workflow: {
    low: "你能在不确定时先探索可能性，适合处理开放型任务。",
    high: "你会先搭好结构和规则，复杂任务更容易被稳定推进。",
  },
  Epistemic: {
    low: "你采纳信息的速度较快，适合需要快速启动和快速试错的场景。",
    high: "你会主动检查 AI 输出，关键事实和逻辑更不容易被放过。",
  },
  RepairScope: {
    low: "你擅长小步修正，能保留已有产出并持续打磨。",
    high: "你愿意在方向不对时整体重开，能避免在错误结构上越改越远。",
  },
};

const WEAKNESS_COPY: Record<Dimension, { low: string; high: string }> = {
  Relation: {
    low: "如果只把 AI 当作执行器，可能会错过它帮助补充思路的价值。",
    high: "如果讨论过多，任务可能变成不断发散，迟迟不进入执行。",
  },
  Workflow: {
    low: "如果一直探索，方案容易变多但难以收束到一个可执行版本。",
    high: "如果框架定得太满，AI 的补充空间会被压缩，结果可能不够新。",
  },
  Epistemic: {
    low: "如果太快接受输出，隐藏错误可能到后期才暴露出来。",
    high: "如果检查成本过高，协作可能变成反复挑错而不是推进任务。",
  },
  RepairScope: {
    low: "如果只做局部修补，整体结构问题可能会被保留下来。",
    high: "如果频繁推倒重来，前面已经有效的工作容易被浪费。",
  },
};

type ReportWithLegacyProfile = FinalReport & {
  styleProfile?: FinalReport["styleProfile"] & {
    comparison?: unknown;
  };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeList(value: unknown, limit = 3) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean).slice(0, limit);
}

function tendencySide(dimension: DimensionReport) {
  const score = dimension.scorePercent ?? dimension.score;
  return score >= 50 ? "high" : "low";
}

function strongestDimensions(dimensions: DimensionReport[]) {
  return dimensions
    .slice()
    .sort((a, b) => Math.abs((b.scorePercent ?? b.score) - 50) - Math.abs((a.scorePercent ?? a.score) - 50));
}

function fallbackStrengths(dimensions: DimensionReport[]) {
  return strongestDimensions(dimensions)
    .slice(0, 3)
    .map((dimension) => STRENGTH_COPY[dimension.dimension][tendencySide(dimension)]);
}

function fallbackWeaknesses(dimensions: DimensionReport[], problems?: ReportProblem[]) {
  const legacyProblems = (problems ?? [])
    .map((problem) => cleanText(problem.symptom) || cleanText(problem.title) || cleanText(problem.howToFix?.immediate))
    .filter(Boolean)
    .slice(0, 3);
  if (legacyProblems.length >= 2) return legacyProblems;

  const dimensionRisks = strongestDimensions(dimensions)
    .slice(0, 3)
    .map((dimension) => WEAKNESS_COPY[dimension.dimension][tendencySide(dimension)]);
  return [...legacyProblems, ...dimensionRisks].slice(0, 3);
}

function fallbackDescription(report: FinalReport) {
  const strongest = strongestDimensions(report.dimensions)[0];
  if (!strongest) return report.summary;
  const side = tendencySide(strongest);
  const tendency = DIMENSION_LABELS[strongest.dimension][side];
  return report.styleOverview?.corePattern
    || `你当前最明显的协作信号是「${tendency}」：${strongest.analysis || report.summary}`;
}

export function buildStyleProfileDisplay(report: ReportWithLegacyProfile): StyleProfileDisplay {
  const behaviorDescription = cleanText(report.styleProfile?.behaviors?.[0]?.behavior);
  const description = behaviorDescription || fallbackDescription(report);
  const strengths = normalizeList(report.styleProfile?.strengths);
  const weaknesses = normalizeList(report.styleProfile?.weaknesses);

  return {
    description,
    strengths: strengths.length >= 2 ? strengths : fallbackStrengths(report.dimensions).slice(0, 3),
    weaknesses: weaknesses.length >= 2 ? weaknesses : fallbackWeaknesses(report.dimensions, report.problems).slice(0, 3),
  };
}
