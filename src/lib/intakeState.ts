import type { SessionState, TargetContext } from "@/lib/types";

export const UNIFIED_GOAL = "提高效率，并获得更多 idea/思路/选择/灵感";

export interface IntakeForm {
  role: string;
  recentUse: string;
  tools: string[];
}

export function createTargetContextFromIntake(form: IntakeForm): TargetContext {
  return {
    role: cleanText(form.role) || "用户",
    tools: normalizeTools(form.tools),
    recentUse: cleanText(form.recentUse) || "使用 AI 完成日常任务",
    goal: UNIFIED_GOAL,
  };
}

export function createSessionStateFromIntake(form: IntakeForm): SessionState {
  const target = createTargetContextFromIntake(form);
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    sessionId,
    turn: 0,
    phase: "questionnaire_batch1",
    background: {
      role: target.role,
      tools: target.tools ?? [],
      recentUse: target.recentUse,
      goal: target.goal,
      summary: "",
    },
    evidence: [],
    openProbes: [],
    questionnaireBatches: {},
    batchAnswers: {},
  };
}

export function validateIntakeForm(form: IntakeForm): string | null {
  if (!cleanText(form.role)) return "请填写职业或身份。";
  if (!cleanText(form.recentUse)) return "请选择或补充一个 AI 使用场景。";
  if (normalizeTools(form.tools).length === 0) return "请选择至少一个常用 AI 工具。";
  return null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTools(tools: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tool of tools) {
    const clean = cleanText(tool);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}
