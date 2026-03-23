import type { ChatMessage } from "../types";
import { extractEventsV2 } from "../assessment-v2/extract-events-v2";
import { getBlueprintById } from "../scenario-v2/loader";
import { callJudgeApiV2, judgePromptVersionV2 } from "../llm/judge-v2";
import { runRuleJudgeV2 } from "../judge-rule-v2";
import { applyRuleCorrectionsV2, computeWeightedScoreV2 } from "../rule-corrector-v2";
import type { JudgeOutputV2 } from "../assessment-v2/types";
import { VERSION } from "../constants";
import { RUBRIC_VERSION_V2, EVENT_SCHEMA_VERSION_V2 } from "../assessment-v2/weights";

export type EvaluationV2Input = {
  sessionId: string;
  scenarioId: string;
  messages: ChatMessage[];
  identityId?: string;
  identityCompiledPrompt?: string | null;
  identityVersion?: string;
};

export type EvaluationResultV2Payload = JudgeOutputV2 & {
  weightedScore: number;
  rubricVersion: string;
  scenarioVersion: string;
  blueprintVersion: string;
  eventSchemaVersion: string;
  memorySchemaVersion: string;
  judgePromptVersion: string;
  judgeModel: string;
  /** dossier schema version */
  identityVersion?: string;
  scoredAt: string;
  rawJudgeJson?: unknown;
  events?: { event: string; turnIndex?: number }[];
};

export async function runEvaluationV2(input: EvaluationV2Input): Promise<EvaluationResultV2Payload> {
  const { sessionId, scenarioId, messages, identityId, identityCompiledPrompt, identityVersion } = input;
  const events = extractEventsV2(messages);
  const blueprint = getBlueprintById(scenarioId);

  const hasKey = Boolean(process.env.OPENAI_JUDGE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
  let judgeModel = hasKey
    ? (process.env.OPENAI_JUDGE_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "llm")
    : "rule-based";

  let rich = await callJudgeApiV2(
    sessionId,
    scenarioId,
    blueprint,
    identityCompiledPrompt ?? null,
    messages,
    events,
    identityId
  );
  let rawJudgeJson: unknown = rich;

  if (!rich) {
    rich = runRuleJudgeV2(scenarioId, sessionId, events, identityId);
    judgeModel = "rule-based";
    rawJudgeJson = rich;
  }

  const corrected = applyRuleCorrectionsV2(rich, events);
  const weightedScore = computeWeightedScoreV2(corrected.dimensions);

  return {
    ...corrected,
    identityId,
    weightedScore,
    rubricVersion: RUBRIC_VERSION_V2,
    scenarioVersion: VERSION.scenarioVersion,
    blueprintVersion: blueprint?.version ?? "unknown",
    eventSchemaVersion: EVENT_SCHEMA_VERSION_V2,
    memorySchemaVersion: VERSION.memorySchemaVersion,
    judgePromptVersion: judgePromptVersionV2(),
    judgeModel,
    identityVersion,
    scoredAt: new Date().toISOString(),
    events,
  };
}
