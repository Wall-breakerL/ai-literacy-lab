import type { UserProfile, ChatMessage } from "../types";
import type { CorrectedOutput } from "../rule-corrector";
import { extractEvents } from "../event-logger";
import { runRuleJudge } from "../judge-rule";
import { applyRuleCorrections } from "../rule-corrector";
import { getScenarioById } from "../scenario-loader";
import { callJudgeApi } from "../llm/judge";
import {
  richToScores,
  applyCorrectedScoresToRich,
  scoresToMinimalRich,
  computeWeightedScore,
} from "../judge-adapter";
import { VERSION } from "../constants";

export type EvaluationInput = {
  sessionId: string;
  scenarioId: string;
  profile: UserProfile;
  messages: ChatMessage[];
};

export type EvaluationResult = CorrectedOutput & {
  rubricVersion: string;
  scenarioVersion: string;
  eventSchemaVersion: string;
  judgePromptVersion: string;
  judgeModel: string;
  scoredAt: string;
  /** 富结构：每维 level / evidence / reason，供结果页展示 */
  dimensions?: Record<string, { level: number; evidence: string[]; reason: string }>;
  flags?: string[];
};

/**
 * Full pipeline: messages → Event Logger → (LLM Judge 或规则 Judge) → Rule Corrector → versioned result.
 */
export async function runEvaluation(input: EvaluationInput): Promise<EvaluationResult> {
  const { sessionId, scenarioId, profile, messages } = input;

  const events = extractEvents(messages);
  const scenario = getScenarioById(scenarioId);

  const rich = await callJudgeApi(sessionId, scenarioId, profile, scenario, messages, events);

  let corrected: CorrectedOutput;
  let judgeModel: string;
  let dimensions: EvaluationResult["dimensions"];
  let flags: string[];

  if (rich) {
    const scores = richToScores(rich);
    const rawForCorrector = {
      scenarioId,
      sessionId,
      dimensionScores: scores,
      weightedScore: computeWeightedScore(scores),
    };
    corrected = applyRuleCorrections(rawForCorrector, events);
    const richCorrected = applyCorrectedScoresToRich(rich, corrected.dimensionScores, corrected.suggestions);
    dimensions = richCorrected.dimensions;
    flags = richCorrected.flags;
    judgeModel = process.env.OPENAI_JUDGE_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "llm";
  } else {
    const rawOutput = runRuleJudge(scenarioId, sessionId, events);
    corrected = applyRuleCorrections(rawOutput, events);
    const minimalRich = scoresToMinimalRich(
      scenarioId,
      profile,
      corrected.dimensionScores,
      corrected.suggestions ?? [],
      VERSION.rubricVersion
    );
    dimensions = minimalRich.dimensions;
    flags = minimalRich.flags;
    judgeModel = "rule-based";
  }

  return {
    ...corrected,
    rubricVersion: VERSION.rubricVersion,
    scenarioVersion: VERSION.scenarioVersion,
    eventSchemaVersion: VERSION.eventSchemaVersion,
    judgePromptVersion: VERSION.judgePromptVersion,
    judgeModel,
    scoredAt: new Date().toISOString(),
    dimensions,
    flags,
  };
}
