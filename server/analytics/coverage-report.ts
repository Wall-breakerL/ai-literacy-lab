import type { CalibrationReport } from "@/server/analytics/calibration";

export interface CoverageReport {
  coverageStatus: "good" | "partial" | "insufficient";
  highlights: string[];
  gaps: string[];
  probeSuggestions: string[];
}

export function buildCoverageReport(calibration: CalibrationReport): CoverageReport {
  const highlights: string[] = [];
  const gaps: string[] = [];
  const probeSuggestions: string[] = [];

  if (calibration.totalSessions === 0) {
    return {
      coverageStatus: "insufficient",
      highlights: [],
      gaps: ["暂无可分析 session。"],
      probeSuggestions: ["先积累至少 8-12 个完整双场景 session 再看覆盖充分性。"],
    };
  }

  const underCovered = calibration.dimensionCoverage.filter(
    (item) => item.apartmentCoverage < 30 || item.brandCoverage < 30,
  );
  if (underCovered.length === 0) {
    highlights.push("5 维 FAA 在两个 scene 都有基础覆盖。");
  } else {
    gaps.push(`以下维度在某一 scene 覆盖偏弱：${underCovered.map((item) => item.dimensionId).join(", ")}`);
  }

  if (calibration.oneSceneDominantDimensions.length > 0) {
    gaps.push(`存在单场景主导维度：${calibration.oneSceneDominantDimensions.join(", ")}`);
    probeSuggestions.push("考虑在弱覆盖 scene 增补对应维度 probe，提升双场景平衡性。");
  } else {
    highlights.push("当前未发现明显单场景主导维度。");
  }

  if (calibration.lowDiscriminativeProbes.length > 0) {
    gaps.push(`低区分 probe：${calibration.lowDiscriminativeProbes.join(", ")}`);
    probeSuggestions.push("对低区分 probe 调整触发条件或替换提示模板。");
  }

  if (calibration.evidenceInsufficientSessions.length > calibration.totalSessions * 0.35) {
    gaps.push("证据不足 session 占比偏高。");
    probeSuggestions.push("优化引导文案，鼓励用户提供可引用的判断-证据-修正链。");
  }

  const coverageStatus =
    gaps.length === 0 ? "good" : underCovered.length <= 2 && calibration.lowDiscriminativeProbes.length <= 2 ? "partial" : "insufficient";

  return {
    coverageStatus,
    highlights,
    gaps,
    probeSuggestions,
  };
}

