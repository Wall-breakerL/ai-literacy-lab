import type { Dimension, QuestionnaireBatchMode, QuestionnaireQuestion } from "@/lib/types";

const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];
const DIMENSION_SET = new Set<string>(DIMENSIONS);

export function validateQuestionnaireQuestions(
  questions: unknown
): questions is QuestionnaireQuestion[] {
  if (!Array.isArray(questions)) return false;
  if (questions.length !== 16 && questions.length !== 20) return false;

  const counts = new Map<Dimension, number>();
  const reverseCounts = new Map<Dimension, { forward: number; reverse: number }>();
  for (const dimension of DIMENSIONS) {
    counts.set(dimension, 0);
    reverseCounts.set(dimension, { forward: 0, reverse: 0 });
  }

  for (const item of questions) {
    if (!item || typeof item !== "object") return false;
    const question = item as Record<string, unknown>;
    if (typeof question.dimension !== "string" || !DIMENSION_SET.has(question.dimension)) {
      return false;
    }
    if (typeof question.question !== "string" || question.question.trim().length < 6) {
      return false;
    }
    if (typeof question.scenario !== "string" || question.scenario.trim().length < 2) {
      return false;
    }
    if (typeof question.reverse !== "boolean") return false;

    const dimension = question.dimension as Dimension;
    counts.set(dimension, (counts.get(dimension) ?? 0) + 1);
    const current = reverseCounts.get(dimension)!;
    if (question.reverse) current.reverse += 1;
    else current.forward += 1;
  }

  const expectedPerDimension = questions.length / DIMENSIONS.length;
  return DIMENSIONS.every((dimension) => {
    const count = counts.get(dimension) ?? 0;
    const reverse = reverseCounts.get(dimension)!;
    return (
      count === expectedPerDimension &&
      reverse.forward > 0 &&
      reverse.reverse > 0
    );
  });
}

export function validateQuestionnaireBatch(
  questions: unknown,
  mode: QuestionnaireBatchMode
): questions is QuestionnaireQuestion[] {
  if (!Array.isArray(questions)) return false;
  if (mode !== "hybrid_batch1" && mode !== "hybrid_batch2") return false;

  // hybrid_batch1: 8 题（四维各 2 题，全部正向）
  // hybrid_batch2: 16 题（四维各 4 题，每维 2 正 + 2 反）
  const expectedCount = mode === "hybrid_batch1" ? 8 : 16;
  const expectedPerDimension = mode === "hybrid_batch1" ? 2 : 4;
  const expectedReversePerDimension = mode === "hybrid_batch1" ? 0 : 2;

  if (questions.length !== expectedCount) return false;
  if (!validateQuestionShapeAndDirection(questions, expectedPerDimension)) return false;
  if (!validateReverseDistribution(questions, expectedReversePerDimension)) return false;

  const habitCount = countHabitQuestions(questions);
  const expectedHabits = mode === "hybrid_batch1" ? 4 : 8;
  return habitCount === expectedHabits;
}

export function validateQuestionnaireTotal(
  questions: unknown
): questions is QuestionnaireQuestion[] {
  if (!Array.isArray(questions)) return false;
  if (questions.length !== 24) return false;
  if (!validateQuestionShapeAndDirection(questions, 6)) return false;
  if (!validateReverseDistribution(questions, 2)) return false;
  return countHabitQuestions(questions) === 12;
}

export function questionTextSimilarity(left: string, right: string): number {
  const a = normalizeQuestionText(left);
  const b = normalizeQuestionText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return 0.95;

  const aTokens = makeCharacterNgrams(a);
  const bTokens = makeCharacterNgrams(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) intersection += 1;
  });
  const union = aTokens.size + bTokens.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function findSimilarQuestionText(
  questions: QuestionnaireQuestion[],
  existingQuestions: QuestionnaireQuestion[],
  threshold = 0.72
): { question: string; existingQuestion: string; similarity: number } | null {
  const allPairs = [
    ...questions.flatMap((question, index) =>
      questions.slice(index + 1).map((other) => [question, other] as const)
    ),
    ...questions.flatMap((question) =>
      existingQuestions.map((existing) => [question, existing] as const)
    ),
  ];

  for (const [question, existing] of allPairs) {
    const similarity = questionTextSimilarity(question.question, existing.question);
    if (similarity >= threshold) {
      return {
        question: question.question,
        existingQuestion: existing.question,
        similarity,
      };
    }
  }
  return null;
}

export function hasSimilarQuestionText(
  questions: QuestionnaireQuestion[],
  existingQuestions: QuestionnaireQuestion[],
  threshold = 0.72
): boolean {
  return Boolean(findSimilarQuestionText(questions, existingQuestions, threshold));
}

function validateQuestionShapeAndDirection(
  questions: unknown[],
  expectedPerDimension: number
): questions is QuestionnaireQuestion[] {
  const counts = new Map<Dimension, number>();
  for (const dimension of DIMENSIONS) {
    counts.set(dimension, 0);
  }

  for (const item of questions) {
    if (!item || typeof item !== "object") return false;
    const question = item as Record<string, unknown>;
    if (typeof question.dimension !== "string" || !DIMENSION_SET.has(question.dimension)) {
      return false;
    }
    if (typeof question.question !== "string" || question.question.trim().length < 6) {
      return false;
    }
    if (typeof question.scenario !== "string" || question.scenario.trim().length < 2) {
      return false;
    }
    if (typeof question.reverse !== "boolean") return false;

    const dimension = question.dimension as Dimension;
    counts.set(dimension, (counts.get(dimension) ?? 0) + 1);
  }

  return DIMENSIONS.every((dimension) => {
    const count = counts.get(dimension) ?? 0;
    return count === expectedPerDimension;
  });
}

function validateReverseDistribution(
  questions: QuestionnaireQuestion[],
  expectedReversePerDimension: number
): boolean {
  return DIMENSIONS.every((dimension) => {
    const items = questions.filter((question) => question.dimension === dimension);
    return items.filter((question) => question.reverse).length === expectedReversePerDimension;
  });
}

function countHabitQuestions(questions: QuestionnaireQuestion[]): number {
  return questions.filter((question) => isHabitScenario(question.scenario)).length;
}

function isHabitScenario(scenario: string): boolean {
  return scenario.trim() === "习惯";
}

export function isSpecificScenario(scenario: string): boolean {
  const clean = scenario.trim().replace(/[。．]+$/, "");
  if (!clean || isHabitScenario(clean)) return false;
  if (clean.length < 3) return false;
  if (/^(日常|平时|一般|普通|常规)?使用\s*(AI|ai)\s*(时|的时候)?$/.test(clean)) return false;
  if (/^(日常|平时|一般|普通|常规)?AI\s*(使用|协作|任务)\s*(时|的时候)?$/.test(clean)) return false;
  if (/^(当前|这个|某个|一些)?(任务|场景|工作|事情)$/.test(clean)) return false;
  if (/泛泛|通用场景|默认场景|用户确认后的场景/.test(clean)) return false;
  return true;
}

function normalizeQuestionText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"‘’'`，。！？、；：,.!?;:\s（）()\[\]【】《》<>]/g, "")
    .replace(/我通常|我一般|我会|我更愿意|我更喜欢|我倾向于|我习惯|的时候/g, "")
    .trim();
}

function makeCharacterNgrams(value: string): Set<string> {
  if (value.length <= 2) return new Set(value ? [value] : []);
  const tokens = new Set<string>();
  for (let i = 0; i <= value.length - 2; i += 1) {
    tokens.add(value.slice(i, i + 2));
  }
  for (let i = 0; i <= value.length - 3; i += 1) {
    tokens.add(value.slice(i, i + 3));
  }
  return tokens;
}
