import type { QuestionnaireQuestion } from "@/lib/types";

export function isHabitScenario(scenario: string): boolean {
  const s = scenario.trim().replace(/[。．]+$/, "");
  return s === "习惯" || s === "习惯题";
}

function trimSentenceEnd(text: string): string {
  return text.trim().replace(/[。！？!?；;，,]+$/, "");
}

export function buildQuestionStem(question: QuestionnaireQuestion): {
  label: string;
  stem: string;
} {
  const habit = isHabitScenario(question.scenario);
  const cleanQuestion = question.question.trim();
  if (habit) {
    return {
      label: "日常习惯",
      stem: cleanQuestion,
    };
  }

  const scenario = trimSentenceEnd(question.scenario)
    .replace(/^(如果|假设|当|在)\s*/, "")
    .trim();
  return {
    label: "目标场景",
    stem: `在${scenario}时，${cleanQuestion}`,
  };
}
