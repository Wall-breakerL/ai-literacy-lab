import { flattenBatchAnswers } from "@/lib/sessionState";
import type { Dimension, DimensionReport, QuestionnaireAnswer, SessionState } from "@/lib/types";

const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];

const SCALE_LABELS: Record<number, string> = {
  0: "肯定不会",
  1: "一般不会",
  2: "偶尔会",
  3: "经常会",
  4: "通常会",
  5: "肯定会",
};
const LIKERT_MIN = 0;
const LIKERT_MAX = 5;
const DIMENSION_SCORE_MAX = 20;
const SKIPPED_SCORE = 2.5;

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
    lowTendency: "Exploratory",
    lowLabel: "探索型",
    highTendency: "Framed",
    highLabel: "框架型",
  },
  Epistemic: {
    label: "认知态度",
    lowTendency: "Trusting",
    lowLabel: "信任型",
    highTendency: "Auditing",
    highLabel: "审计型",
  },
  RepairScope: {
    label: "修复范围",
    lowTendency: "Local",
    lowLabel: "局部调整型",
    highTendency: "Global",
    highLabel: "全局重评型",
  },
};

function clampRawScore(score: number): number {
  if (!Number.isFinite(score)) return SKIPPED_SCORE;
  return Math.min(LIKERT_MAX, Math.max(LIKERT_MIN, Math.round(score)));
}

function toScorePercent(score: number, scoreMax = DIMENSION_SCORE_MAX): number {
  if (scoreMax <= 0) return 50;
  return Math.round((score / scoreMax) * 100);
}

export function scoreAnswer(answer: QuestionnaireAnswer): number {
  if (answer.skipped || answer.score == null) return SKIPPED_SCORE;
  const raw = clampRawScore(answer.score);
  return answer.reverse ? LIKERT_MAX - raw : raw;
}

function getConfidence(score: number, answeredCount: number) {
  if (answeredCount === 0) return "low";
  const distance = Math.abs(score - DIMENSION_SCORE_MAX / 2);
  const ratio = distance / (DIMENSION_SCORE_MAX / 2);
  if (ratio >= 0.6 && answeredCount >= 4) return "high";
  if (ratio >= 0.3 && answeredCount >= 2) return "medium";
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
    const scored = dimensionAnswers.map(scoreAnswer);
    const score =
      scored.length > 0
        ? roundHalf(scored.reduce((sum, value) => sum + value, 0))
        : DIMENSION_SCORE_MAX / 2;
    const scorePercent = toScorePercent(score);
    const high = score >= DIMENSION_SCORE_MAX / 2;

    return {
      dimension,
      label: meta.label,
      tendency: high ? meta.highTendency : meta.lowTendency,
      tendencyLabel: high ? meta.highLabel : meta.lowLabel,
      score,
      scoreMax: DIMENSION_SCORE_MAX,
      scorePercent,
      evidence: answered.slice(0, 2).map((answer) => {
        const scoreLabel = answer.score != null ? (SCALE_LABELS[answer.score] ?? `${answer.score} 分`) : null;
        return scoreLabel ? `${answer.question}（选：${scoreLabel}）` : answer.question;
      }),
      analysis: "",
      advice: "",
      answeredCount: answered.length,
      skippedCount,
      confidence: getConfidence(score, answered.length),
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
  const max = base.scoreMax ?? DIMENSION_SCORE_MAX;
  return `从当前数据看，${base.label} 有 ${answeredCount} 题有效${skippedText}，分数为 ${base.score}/${max}，更接近「${base.tendencyLabel}」。主要依据是 ${evidenceText}。这个判断更适合作为当前使用场景下的协作倾向，而不是固定不变的人格标签。`;
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}
