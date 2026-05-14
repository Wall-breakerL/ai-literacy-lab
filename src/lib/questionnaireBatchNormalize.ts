import type { Dimension, QuestionnaireBatchMode, QuestionnaireQuestion } from "@/lib/types";

export function normalizeGeneratedQuestionBatch(
  questions: QuestionnaireQuestion[],
  batchMode: QuestionnaireBatchMode
): QuestionnaireQuestion[] {
  const seenByDimension = new Map<Dimension, number>();
  return questions.map((question) => {
    const dimension = question.dimension;
    const count = seenByDimension.get(dimension) ?? 0;
    seenByDimension.set(dimension, count + 1);
    // Active two-part batches have fixed slots per dimension; model-supplied
    // questionType is advisory and may be over-specific.
    const inferredType =
      batchMode === "hybrid_batch1"
        ? count === 0 ? "universal" : "semi_specific"
        : count === 0 ? "semi_specific" : "specific";
    return {
      ...question,
      questionType: inferredType,
      scenario: inferredType === "universal" ? "通用" : question.scenario,
      reverse: typeof question.reverse === "boolean" ? question.reverse : false,
    };
  });
}
