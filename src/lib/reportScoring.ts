import { flattenBatchAnswers } from "@/lib/sessionState";
import type { Dimension, DimensionReport, QuestionnaireAnswer, SessionState } from "@/lib/types";

const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];

const DIMENSION_META: Record<
  Dimension,
  {
    label: string;
    lowTendency: string;
    lowLabel: string;
    highTendency: string;
    highLabel: string;
  }
> = {
  Relation: {
    label: "关系定位",
    lowTendency: "Instrumental",
    lowLabel: "工具型",
    highTendency: "Collaborative",
    highLabel: "伙伴型",
  },
  Workflow: {
    label: "工作流程",
    lowTendency: "Framed",
    lowLabel: "框架型",
    highTendency: "Exploratory",
    highLabel: "探索型",
  },
  Epistemic: {
    label: "认知态度",
    lowTendency: "Auditing",
    lowLabel: "审计型",
    highTendency: "Trusting",
    highLabel: "信任型",
  },
  RepairScope: {
    label: "修复范围",
    lowTendency: "Global",
    lowLabel: "全局重评型",
    highTendency: "Local",
    highLabel: "局部调整型",
  },
};

function clampRawScore(score: number): number {
  if (!Number.isFinite(score)) return 3;
  return Math.min(6, Math.max(1, Math.round(score)));
}

export function scoreAnswer(answer: QuestionnaireAnswer): number | null {
  if (answer.skipped || answer.score == null) return null;
  const raw = clampRawScore(answer.score);
  return answer.reverse ? (6 - raw) * 20 : (raw - 1) * 20;
}

function getConfidence(answeredCount: number) {
  if (answeredCount >= 4) return "high";
  if (answeredCount >= 2) return "medium";
  return "low";
}

export function resolveReportQuestionnaireAnswers({
  questionnaireAnswers,
  sessionState,
}: {
  questionnaireAnswers?: QuestionnaireAnswer[];
  sessionState?: SessionState;
}): QuestionnaireAnswer[] {
  if (questionnaireAnswers?.length) return questionnaireAnswers;
  if (sessionState?.answers?.length) return sessionState.answers;
  return flattenBatchAnswers(sessionState?.batchAnswers);
}

export function scoreQuestionnaireAnswers(answers: QuestionnaireAnswer[]): DimensionReport[] {
  return DIMENSIONS.map((dimension) => {
    const meta = DIMENSION_META[dimension];
    const dimensionAnswers = answers.filter((answer) => answer.dimension === dimension);
    const answered = dimensionAnswers.filter((answer) => !answer.skipped && answer.score != null);
    const skippedCount = dimensionAnswers.length - answered.length;
    const scored = answered
      .map(scoreAnswer)
      .filter((score): score is number => typeof score === "number");
    const score =
      scored.length > 0
        ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
        : 50;
    const high = score >= 50;

    return {
      dimension,
      label: meta.label,
      tendency: high ? meta.highTendency : meta.lowTendency,
      tendencyLabel: high ? meta.highLabel : meta.lowLabel,
      score,
      evidence: answered.slice(0, 2).map((answer) => answer.question),
      analysis: "",
      advice: "",
      answeredCount: answered.length,
      skippedCount,
      confidence: getConfidence(answered.length),
    };
  });
}

export function mergeScoredDimensions(
  generated:
    | (Pick<DimensionReport, "dimension"> & Partial<Pick<DimensionReport, "analysis" | "evidence">>)[]
    | undefined,
  scored: DimensionReport[]
): DimensionReport[] {
  return scored.map((base) => {
    const text = generated?.find((item) => item.dimension === base.dimension);
    return {
      ...base,
      analysis: text?.analysis?.trim() || base.analysis || buildDimensionAnalysisFallback(base),
      advice: "",
      evidence: base.evidence.length > 0 ? base.evidence : text?.evidence ?? [],
    };
  });
}

function buildDimensionAnalysisFallback(base: DimensionReport): string {
  const answeredCount = base.answeredCount ?? 0;
  const skippedCount = base.skippedCount ?? 0;
  const evidenceText = base.evidence.length
    ? base.evidence.slice(0, 2).map((item) => `「${item}」`).join("、")
    : "当前有效回答";
  const skippedText = skippedCount > 0 ? `，另有 ${skippedCount} 题跳过或不适用` : "";
  return `从当前数据看，${base.label} 有 ${answeredCount} 题有效${skippedText}，分数为 ${base.score}，更接近「${base.tendencyLabel}」。主要依据是 ${evidenceText}。这个判断更适合作为当前使用场景下的协作倾向，而不是固定不变的人格标签。`;
}
