import type { QuestionnaireQuestion } from "@/lib/types";

export function isHabitScenario(scenario: string): boolean {
  const s = scenario.trim().replace(/[。．]+$/, "");
  return s === "习惯" || s === "习惯题" || s === "通用";
}

function trimSentenceEnd(text: string): string {
  return text.trim().replace(/[。！？!?；;，,]+$/, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeScenarioPrefix(question: string, scenario: string): string {
  const cleanScenario = scenario.trim();
  if (!cleanScenario) return question;
  const escaped = escapeRegExp(cleanScenario);
  const prefixPattern = new RegExp(
    `^(?:在|当)?\\s*${escaped}\\s*(?:时|的时候|的情况下)?\\s*[，,、：:]?\\s*`
  );
  const stripped = question.replace(prefixPattern, "").trim();
  return stripped || question;
}

function getCompleteScenarioPrefix(question: string): string | null {
  const match = question.match(/^(?:在|当)(.{2,40})(?:时|的时候|的情况下)\s*[，,、：:]/);
  return match?.[1]?.trim() || null;
}

export function buildQuestionStem(question: QuestionnaireQuestion): {
  label: string;
  stem: string;
} {
  const cleanQuestion = question.question.trim();

  // 通用题：直接使用题干，不需要场景前缀
  if (question.questionType === "universal" || question.scenario.trim() === "通用") {
    return {
      label: "通用倾向",
      stem: cleanQuestion,
    };
  }

  // 半具体题和具体题：题干应该已经包含场景描述，直接使用
  return {
    label: question.questionType === "specific" ? "真实场景" : "任务场景",
    stem: cleanQuestion,
  };
}
