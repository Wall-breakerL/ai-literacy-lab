import type { UserProfile, ChatMessage } from "../types";
import type { CorrectedOutput } from "../rule-corrector";
import { extractEvents } from "../event-logger";
import { applyRuleCorrections } from "../rule-corrector";
import { getScenarioById } from "../scenario-loader";
import { callJudgeApi } from "../llm/judge";
import { richToScores, applyCorrectedScoresToRich, computeWeightedScore } from "../judge-adapter";
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
 * Full pipeline: messages → Event Logger → LLM Judge (API) → Rule Corrector → versioned result.
 * 暂不启用 rule-based 回退，未配置 API 时直接报错；等 memory 部分完成后再考虑启用规则 Judge。
 */
export async function runEvaluation(input: EvaluationInput): Promise<EvaluationResult> {
  const { sessionId, scenarioId, profile, messages } = input;

  const events = extractEvents(messages);
  const scenario = getScenarioById(scenarioId);

  const rich = await callJudgeApi(sessionId, scenarioId, profile, scenario, messages, events);

  if (!rich) {
    throw new Error(
      "评分需要接入 Judge API。请设置 OPENAI_API_KEY 或 OPENAI_JUDGE_API_KEY 后重试。"
    );
  }

  const scores = richToScores(rich);
  const rawForCorrector = {
    scenarioId,
    sessionId,
    dimensionScores: scores,
    weightedScore: computeWeightedScore(scores),
  };
  const corrected = applyRuleCorrections(rawForCorrector, events);
  const richCorrected = applyCorrectedScoresToRich(rich, corrected.dimensionScores, corrected.suggestions);
  const judgeModel = process.env.OPENAI_JUDGE_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "llm";

  return {
    ...corrected,
    rubricVersion: VERSION.rubricVersion,
    scenarioVersion: VERSION.scenarioVersion,
    eventSchemaVersion: VERSION.eventSchemaVersion,
    judgePromptVersion: VERSION.judgePromptVersion,
    judgeModel,
    scoredAt: new Date().toISOString(),
    dimensions: richCorrected.dimensions,
    flags: richCorrected.flags,
  };
}
