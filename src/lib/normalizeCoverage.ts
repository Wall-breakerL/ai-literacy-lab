import type { CoverageStatus, Dimension } from "@/lib/types";

const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];

const VALID: CoverageStatus[] = ["uncovered", "weak", "covered"];

function parseStatus(raw: unknown): CoverageStatus | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (VALID.includes(s as CoverageStatus)) return s as CoverageStatus;
  // 常见模型漂移
  if (s === "none" || s === "unknown" || s === "pending" || s === "todo") return "uncovered";
  if (s === "partial" || s === "low" || s === "medium") return "weak";
  if (s === "full" || s === "complete" || s === "done") return "covered";
  return null;
}

/** 从任意 key 的对象里取某一维的值（兼容大小写、空格） */
function pickDimensionValue(
  cov: Record<string, unknown>,
  dim: Dimension
): unknown {
  const target = dim.toLowerCase();
  if (dim in cov) return cov[dim];
  for (const key of Object.keys(cov)) {
    if (key.trim().toLowerCase() === target) return cov[key];
  }
  return undefined;
}

/**
 * 将 Agent B 返回的 coverage 规整为四键 + 三态，避免 UI 与 tooltip 因模型漂移而不一致。
 */
export function normalizeCoverage(cov: unknown): Record<Dimension, CoverageStatus> {
  const base: Record<Dimension, CoverageStatus> = {
    Relation: "uncovered",
    Workflow: "uncovered",
    Epistemic: "uncovered",
    RepairScope: "uncovered",
  };
  if (!cov || typeof cov !== "object") return base;

  const rec = cov as Record<string, unknown>;
  for (const dim of DIMENSIONS) {
    const parsed = parseStatus(pickDimensionValue(rec, dim));
    if (parsed) base[dim] = parsed;
  }
  return base;
}
