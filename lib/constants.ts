/**
 * Rubric weights (sum = 100). 每维 0–100，加权总分 = sum(score * weight) / 100.
 */
export const RUBRIC_WEIGHTS = {
  clarity: 20,
  context: 25,
  steering: 20,
  judgment: 20,
  safetyOwnership: 15,
} as const;

export const DIMENSION_KEYS = [
  "clarity",
  "context",
  "steering",
  "judgment",
  "safetyOwnership",
] as const;

export const DIMENSION_LABELS: Record<(typeof DIMENSION_KEYS)[number], string> = {
  clarity: "说清任务",
  context: "补足上下文",
  steering: "推进对话",
  judgment: "判断结果",
  safetyOwnership: "守住边界并落地",
};

export const VERSION = {
  rubricVersion: "1.0",
  scenarioVersion: "1.0",
  eventSchemaVersion: "1.0",
  judgePromptVersion: "1.0",
} as const;

export const SCENARIO_IDS = [
  "message_student",
  "message_general",
  "choice_student",
  "choice_general",
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];
