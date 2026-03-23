import type { EvaluationResultV2Payload } from "../evaluation/run-evaluation-v2";
import type { V2DimensionKey } from "../assessment-v2/weights";

export type PhaseScoreSummary = {
  phase: "helper" | "talk";
  score: number;
  eventCounts: Record<string, number>;
};

export type ExperienceCard = {
  sessionId: string;
  identityId: string;
  userId?: string;
  scenarioId: string;
  transcriptSummary: string;
  eventSummary: Record<string, number>;
  dimensionScores: Record<string, number>;
  evidence: Record<string, string[]>;
  blindSpots: string[];
  nextRecommendedScenarios: string[];
  nextRecommendedProbes: string[];
  /** Two-phase summary (present only for v3 blueprints). */
  phaseScores?: PhaseScoreSummary[];
  talkPrompt?: string;
  phaseSwitchTurn?: number;
  versions: {
    identityVersion: string;
    scenarioVersion: string;
    blueprintVersion: string;
    rubricVersion: string;
    eventSchemaVersion: string;
    memorySchemaVersion: string;
    judgePromptVersion: string;
    judgeModel: string;
    scoredAt: string;
  };
  createdAt: string;
};

function summarizeTranscript(text: string, maxLen = 400): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

export function buildExperienceCard(
  result: EvaluationResultV2Payload,
  opts: { sessionId: string; userId?: string; identityVersion: string; transcriptHint?: string }
): ExperienceCard {
  const dimScores: Record<string, number> = {};
  const evidence: Record<string, string[]> = {};
  for (const k of Object.keys(result.dimensions) as V2DimensionKey[]) {
    dimScores[k] = result.dimensions[k].score;
    evidence[k] = result.dimensions[k].evidence;
  }

  const eventSummary: Record<string, number> = {};
  for (const e of result.events ?? []) {
    eventSummary[e.event] = (eventSummary[e.event] ?? 0) + 1;
  }

  const transcriptSummary = summarizeTranscript(
    opts.transcriptHint ??
      `${Object.entries(eventSummary)
        .map(([k, v]) => `${k}:${v}`)
        .join("; ")} | scores:${JSON.stringify(dimScores)}`
  );

  // Phase scores summary
  let phaseScores: PhaseScoreSummary[] | undefined;
  if (result.phaseScores) {
    phaseScores = [
      { phase: "helper", score: result.phaseScores.helper.score, eventCounts: result.phaseScores.helper.eventCounts },
      { phase: "talk", score: result.phaseScores.talk.score, eventCounts: result.phaseScores.talk.eventCounts },
    ];
  }

  return {
    sessionId: opts.sessionId,
    identityId: result.identityId ?? "unknown",
    userId: opts.userId,
    scenarioId: result.scenarioId,
    transcriptSummary,
    eventSummary,
    dimensionScores: dimScores,
    evidence,
    blindSpots: result.blindSpots,
    nextRecommendedScenarios: result.nextRecommendedScenarios,
    nextRecommendedProbes: result.nextRecommendedProbes,
    phaseScores,
    talkPrompt: result.talkPrompt,
    phaseSwitchTurn: result.phaseSwitchTurn,
    versions: {
      identityVersion: opts.identityVersion,
      scenarioVersion: result.scenarioVersion,
      blueprintVersion: result.blueprintVersion,
      rubricVersion: result.rubricVersion,
      eventSchemaVersion: result.eventSchemaVersion,
      memorySchemaVersion: result.memorySchemaVersion,
      judgePromptVersion: result.judgePromptVersion,
      judgeModel: result.judgeModel,
      scoredAt: result.scoredAt,
    },
    createdAt: new Date().toISOString(),
  };
}
