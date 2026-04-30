import { NextRequest, NextResponse } from "next/server";
import {
  RESEARCHER_FALLBACK_MODEL,
  RESEARCHER_MODEL,
  assertClaudeApiKey,
  createClaudeMessageWithTools,
  getUpstreamErrorMessage,
} from "@/lib/claude";
import {
  buildMidDialogueOpeningPrompt,
  buildResearcherSystemPrompt,
  type MidDialogueOpeningSkippedQuestion,
} from "@/lib/researcher";
import { getBatchSkipRate, isSessionState } from "@/lib/sessionState";
import type { MidDialogueKey, QuestionnaireAnswer, QuestionnaireBatchKey, SessionState } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

type OpeningSource = "model" | "fallback";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | {
        sessionState?: unknown;
        completedBatchKey?: unknown;
        answers?: unknown;
      }
    | null;

  if (!body || !isSessionState(body.sessionState) || !isCompletedBatchKey(body.completedBatchKey)) {
    return NextResponse.json(
      { error: "bad_request", detail: "请求体需要包含 sessionState 与 completedBatchKey=batch1/batch2。" },
      { status: 400 }
    );
  }

  const sessionState = body.sessionState;
  const completedBatchKey = body.completedBatchKey;
  const answers = parseAnswers(body.answers);
  const dialogKey = completedBatchKey === "batch1" ? "dialog1" : "dialog2";
  const skippedQuestionSamples = collectSkippedQuestionSamples(dialogKey, sessionState, answers);
  const fallback = buildFallbackOpening(dialogKey, answers, skippedQuestionSamples);
  const warnings: string[] = [];
  let message = fallback;
  let source: OpeningSource = "fallback";

  const missing = assertClaudeApiKey();
  if (missing) {
    warnings.push(missing);
  } else {
    const modelMessage = await generateOpening(sessionState, dialogKey, answers, skippedQuestionSamples).catch((error) => {
      warnings.push(getUpstreamErrorMessage(error) ?? String(error));
      return "";
    });
    if (modelMessage) {
      message = modelMessage;
      source = "model";
    }
  }

  return NextResponse.json({ message, source, dialogKey, warnings });
}

async function generateOpening(
  sessionState: SessionState,
  dialogKey: MidDialogueKey,
  answers: QuestionnaireAnswer[],
  skippedQuestionSamples: MidDialogueOpeningSkippedQuestion[]
): Promise<string> {
  const params = {
    system: buildResearcherSystemPrompt(sessionState),
    messages: [
      {
        role: "user" as const,
        content: buildMidDialogueOpeningPrompt({
          dialogKey,
          sessionState,
          skipRate: getBatchSkipRate(answers),
          skippedQuestionSamples,
        }),
      },
    ],
    tools: [],
    toolChoice: "none" as const,
    temperature: 0.35,
    maxTokens: 256,
  };

  try {
    const result = await createClaudeMessageWithTools({
      ...params,
      model: RESEARCHER_MODEL,
    });
    return cleanOpeningText(result.textBlocks.join("\n"));
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    const result = await createClaudeMessageWithTools({
      ...params,
      model: RESEARCHER_FALLBACK_MODEL,
    });
    return cleanOpeningText(result.textBlocks.join("\n"));
  }
}

function cleanOpeningText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["“]|["”]$/g, "")
    .trim()
    .slice(0, 180);
}

function buildFallbackOpening(
  dialogKey: MidDialogueKey,
  answers: QuestionnaireAnswer[],
  skippedQuestionSamples: MidDialogueOpeningSkippedQuestion[]
): string {
  const skipRate = getBatchSkipRate(answers);
  const skippedText = formatSkippedQuestionReferences(skippedQuestionSamples);
  if (dialogKey === "dialog1") {
    if (skipRate > 0.5) {
      return skippedText
        ? `看起来刚才的习惯题不太贴近你，比如${skippedText}${skippedQuestionSamples.length > 1 ? "这两道题" : "这道题"}。你觉得哪些习惯题不太贴？你平时用 AI 主要做什么？`
        : "看起来刚才的习惯题不太贴近你。你觉得哪些习惯题不太贴？你平时用 AI 主要做什么？";
    }
    if (skipRate >= 0.25) {
      return skippedText
        ? `刚才有几道习惯题你选了「不了解 / 没想好」，比如${skippedText}${skippedQuestionSamples.length > 1 ? "这两道题" : "这道题"}。你觉得接下来的场景题，更希望围绕什么任务来问？`
        : "刚才有几道习惯题你选了「不了解 / 没想好」。你觉得接下来的场景题，更希望围绕什么任务来问？";
    }
    return "刚才的习惯题答下来你觉得感觉怎么样？接下来我想问一些具体场景，你平时用 AI 主要在哪些环节用得多？";
  }
  if (skipRate > 0.5) {
    return skippedText
      ? `看起来这些场景题还是不太贴近你，比如${skippedText}${skippedQuestionSamples.length > 1 ? "这两道题" : "这道题"}。你觉得这些场景哪里不太贴？你平时用 AI 最常做的是什么？`
      : "看起来这些场景题还是不太贴近你。你觉得这些场景哪里不太贴？你平时用 AI 最常做的是什么？";
  }
  if (skipRate >= 0.25) {
    return skippedText
      ? `刚才有几道场景题你选了「不了解 / 没想好」，比如${skippedText}${skippedQuestionSamples.length > 1 ? "这两道题" : "这道题"}。你觉得哪些场景不太贴？或者你更希望问什么场景？`
      : "刚才有几道场景题你选了「不了解 / 没想好」。你觉得哪些场景不太贴？或者你更希望问什么场景？";
  }
  return "这些场景题你觉得感觉怎么样？最后一批你更希望怎么调整场景颗粒度？可以说说想更具体，还是更抽象一些。";
}

function collectSkippedQuestionSamples(
  dialogKey: MidDialogueKey,
  sessionState: SessionState,
  answers: QuestionnaireAnswer[]
): MidDialogueOpeningSkippedQuestion[] {
  const source = dialogKey === "dialog2"
    ? [
        ...(sessionState.batchAnswers?.batch2?.length ? sessionState.batchAnswers.batch2 : answers),
        ...(sessionState.batchAnswers?.batch1 ?? []),
      ]
    : answers;
  const seen = new Set<string>();
  return source.flatMap((answer) => {
    if (!isSkippedAnswer(answer)) return [];
    const question = answer.question.trim();
    if (!question) return [];
    const key = question.replace(/\s+/g, "").slice(0, 32);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      dimension: answer.dimension,
      scenario: answer.scenario,
      question,
    }];
  }).slice(0, 2);
}

function isSkippedAnswer(answer: QuestionnaireAnswer): boolean {
  return answer.skipped === true || answer.score == null;
}

function formatSkippedQuestionReferences(samples: MidDialogueOpeningSkippedQuestion[]): string {
  if (samples.length === 0) return "";
  return samples
    .slice(0, 2)
    .map((sample) => `「${compactQuestionReference(sample)}」`)
    .join("和");
}

function compactQuestionReference(sample: MidDialogueOpeningSkippedQuestion): string {
  const scenarioPrefix = sample.scenario && sample.scenario !== "习惯" ? `${sample.scenario}：` : "";
  const text = `${scenarioPrefix}${sample.question}`.replace(/\s+/g, " ").trim();
  return text.length <= 42 ? text : `${text.slice(0, 41)}…`;
}

function isCompletedBatchKey(value: unknown): value is Exclude<QuestionnaireBatchKey, "batch3"> {
  return value === "batch1" || value === "batch2";
}

function parseAnswers(value: unknown): QuestionnaireAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<QuestionnaireAnswer>;
    if (
      typeof record.dimension !== "string" ||
      !["Relation", "Workflow", "Epistemic", "RepairScope"].includes(record.dimension) ||
      typeof record.question !== "string" ||
      typeof record.scenario !== "string"
    ) {
      return [];
    }
    return [{
      dimension: record.dimension,
      score: typeof record.score === "number" ? record.score : null,
      question: record.question,
      scenario: record.scenario,
      reverse: Boolean(record.reverse),
      skipped: Boolean(record.skipped) || record.score == null,
      skipReason: record.score == null ? "unsure_or_not_applicable" : record.skipReason,
    }];
  });
}
