import type { MidDialogueStatus, ScenarioGuidance, SessionState, TargetContext } from "@/lib/types";

export interface MidFeedbackForm {
  overallFeeling: "close" | "neutral" | "far";
  issueText: string;
  focusScenario: string;
}

export function buildScenarioGuidanceFromForm(
  form: MidFeedbackForm,
  fallbackScenario: string
): ScenarioGuidance {
  const focus = cleanText(form.focusScenario);
  const issue = cleanText(form.issueText);
  const fallback = cleanText(fallbackScenario);

  return {
    status: mapFeelingToStatus(form.overallFeeling),
    scenarioSummary: focus || fallback || "（用户未指定）",
    granularity: inferGranularity(form),
    avoidTopics: extractKeywords(issue),
    includeTopics: extractKeywords(focus),
    userCorrectionQuote: issue || undefined,
  };
}

export function buildRefinedTargetContextFromFeedback(
  state: SessionState,
  guidance: ScenarioGuidance
): TargetContext {
  return {
    role: state.background.role,
    tools: state.background.tools,
    recentUse:
      guidance.scenarioSummary && guidance.scenarioSummary !== "（用户未指定）"
        ? guidance.scenarioSummary
        : state.background.recentUse,
    goal: state.background.goal,
  };
}

function mapFeelingToStatus(feeling: MidFeedbackForm["overallFeeling"]): MidDialogueStatus {
  if (feeling === "close") return "confirmed";
  if (feeling === "far") return "abstract_scenarios";
  return "refined";
}

function inferGranularity(form: MidFeedbackForm): ScenarioGuidance["granularity"] {
  if (cleanText(form.focusScenario).length >= 6) return "specific";
  if (form.overallFeeling === "far") return "abstract";
  return "balanced";
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/[，。、,.\s\n;；！!？?]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2 && item.length <= 24)
    )
  ).slice(0, 5);
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
