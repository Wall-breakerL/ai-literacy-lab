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
  normalizeMidDialogueVisibleText,
  type MidDialogueOpeningSkippedQuestion,
} from "@/lib/researcher";
import { getBatchSkipRate, isSessionState } from "@/lib/sessionState";
import type { MidDialogueKey, QuestionnaireAnswer, SessionState } from "@/lib/types";

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
      { error: "bad_request", detail: "请求体需要包含 sessionState 与 completedBatchKey=batch1。" },
      { status: 400 }
    );
  }

  const started = performance.now();
  const sessionState = body.sessionState;
  const answers = parseAnswers(body.answers);
  const dialogKey: MidDialogueKey = "dialog1";
  const skippedQuestionSamples = collectSkippedQuestionSamples(sessionState, answers);
  const fallback = buildFallbackOpening(dialogKey, answers, skippedQuestionSamples);
  const warnings: string[] = [];
  let message = fallback;
  let source: OpeningSource = "fallback";
  let modelOpening: { text: string; model: string } | null = null;

  const missing = assertClaudeApiKey();
  if (missing) {
    warnings.push(missing);
  } else {
    modelOpening = await generateOpening(sessionState, dialogKey, answers, skippedQuestionSamples).catch((error) => {
      warnings.push(getUpstreamErrorMessage(error) ?? String(error));
      return null;
    });
    if (modelOpening?.text) {
      message = modelOpening.text;
      source = "model";
    }
  }

  const responseModel = source === "model" && modelOpening ? modelOpening.model : "deterministic";

  return NextResponse.json({
    message,
    source,
    dialogKey,
    warnings,
    model: responseModel,
    thinkDurationSec: (performance.now() - started) / 1000,
  });
}

async function generateOpening(
  sessionState: SessionState,
  dialogKey: MidDialogueKey,
  answers: QuestionnaireAnswer[],
  skippedQuestionSamples: MidDialogueOpeningSkippedQuestion[]
): Promise<{ text: string; model: string } | null> {
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
    const text = cleanOpeningText(result.textBlocks.join("\n"));
    return text ? { text, model: RESEARCHER_MODEL } : null;
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    const result = await createClaudeMessageWithTools({
      ...params,
      model: RESEARCHER_FALLBACK_MODEL,
    });
    const text = cleanOpeningText(result.textBlocks.join("\n"));
    return text ? { text, model: RESEARCHER_FALLBACK_MODEL } : null;
  }
}

function cleanOpeningText(value: string): string {
  const clean = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
  return normalizeMidDialogueVisibleText(clean);
}

function buildFallbackOpening(
  dialogKey: MidDialogueKey,
  answers: QuestionnaireAnswer[],
  skippedQuestionSamples: MidDialogueOpeningSkippedQuestion[]
): string {
  const skippedText = formatSkippedQuestionReferences(skippedQuestionSamples);
  if (dialogKey === "dialog1") {
    if (skippedText) {
      return skippedText
        ? `刚才有几题你选了「不了解 / 没想好」，比如${skippedText}${skippedQuestionSamples.length > 1 ? "这两道题" : "这道题"}。你觉得是题意不清楚、没有类似经历，还是对这个方向不太感兴趣？`
        : "刚才有几题你选了「不了解 / 没想好」。你觉得是题意不清楚、没有类似经历，还是对这个方向不太感兴趣？";
    }
    return "第一部分答下来你觉得整体感觉怎么样？第二部分你更希望围绕哪些真实 AI 使用场景来问？";
  }
  return "第一部分答下来你觉得整体感觉怎么样？第二部分你更希望围绕哪些真实 AI 使用场景来问？";
}

function collectSkippedQuestionSamples(
  sessionState: SessionState,
  answers: QuestionnaireAnswer[]
): MidDialogueOpeningSkippedQuestion[] {
  const source = answers.length ? answers : sessionState.batchAnswers?.batch1 ?? [];
  const seen = new Set<string>();
  const skipped = source.flatMap((answer) => {
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
  });
  return skipped
    .sort((left, right) =>
      stableHash(`${sessionState.sessionId}|${left.dimension}|${left.question}`) -
      stableHash(`${sessionState.sessionId}|${right.dimension}|${right.question}`)
    )
    .slice(0, 2);
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

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function isCompletedBatchKey(value: unknown): value is "batch1" {
  return value === "batch1";
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
