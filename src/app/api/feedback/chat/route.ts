import { NextRequest, NextResponse } from "next/server";
import {
  RESEARCHER_FALLBACK_MODEL,
  RESEARCHER_MODEL,
  assertClaudeApiKey,
  createClaudeMessageWithTools,
  getUpstreamErrorMessage,
} from "@/lib/claude";
import {
  FEEDBACK_AGENT_SYSTEM,
  FEEDBACK_DIALOGUE_TOOL,
  buildFeedbackDialoguePrompt,
  feedbackChatResponseFromToolUses,
} from "@/lib/feedbackAgent";
import { withLlmRetry } from "@/lib/llmRetry";
import type { FeedbackContext, FeedbackDialogueMessage } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const missing = assertClaudeApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as
    | {
        context?: unknown;
        messages?: unknown;
      }
    | null;
  const context = parseFeedbackContext(body?.context);
  const messages = parseFeedbackMessages(body?.messages);

  if (!context) {
    return NextResponse.json({ error: "bad_request", detail: "缺少有效反馈上下文。" }, { status: 400 });
  }

  try {
    const result = await withLlmRetry(async () => createFeedbackMessage(context, messages), 2);
    const parsed = feedbackChatResponseFromToolUses({
      toolUses: result.toolUses,
      context,
      messages,
      model: result.model,
    });
    if (!parsed) {
      return NextResponse.json(
        { error: "invalid_model_output", detail: "反馈模型没有返回有效结构。" },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Feedback chat error:", error);
    return NextResponse.json(
      { error: "feedback_chat_failed", detail: getUpstreamErrorMessage(error) ?? String(error) },
      { status: 502 }
    );
  }
}

async function createFeedbackMessage(
  context: FeedbackContext,
  messages: FeedbackDialogueMessage[]
) {
  const params = {
    system: FEEDBACK_AGENT_SYSTEM,
    messages: [
      {
        role: "user" as const,
        content: buildFeedbackDialoguePrompt({ context, messages }),
      },
    ],
    tools: [FEEDBACK_DIALOGUE_TOOL],
    toolChoice: { type: "tool" as const, name: FEEDBACK_DIALOGUE_TOOL.name },
    temperature: 0.35,
    maxTokens: 2048,
  };

  try {
    return {
      ...(await createClaudeMessageWithTools({ ...params, model: RESEARCHER_MODEL })),
      model: RESEARCHER_MODEL,
    };
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    return {
      ...(await createClaudeMessageWithTools({ ...params, model: RESEARCHER_FALLBACK_MODEL })),
      model: RESEARCHER_FALLBACK_MODEL,
    };
  }
}

function parseFeedbackContext(value: unknown): FeedbackContext | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<FeedbackContext>;
  const sessionId = cleanString(input.sessionId, 120);
  if (!sessionId) return null;
  return {
    sessionId,
    identity: cleanString(input.identity, 120) || "用户",
    personalityCode: cleanString(input.personalityCode, 40) || "unknown",
    personalityName: cleanString(input.personalityName, 120),
    role: cleanString(input.role, 200) || "用户",
    recentUse: cleanString(input.recentUse, 300) || "使用 AI 完成日常任务",
    goal: cleanString(input.goal, 300) || "更有效地使用 AI",
    totalQuestions: normalizeCount(input.totalQuestions),
    answeredQuestions: normalizeCount(input.answeredQuestions),
    skipRate: normalizeRate(input.skipRate),
    reportSummary: cleanString(input.reportSummary, 1000),
    reportTags: parseStringArray(input.reportTags, 20, 80),
    collaborationManifesto: cleanString(input.collaborationManifesto, 1000),
    promptTemplateTitles: parseStringArray(input.promptTemplateTitles, 10, 120),
  };
}

function parseFeedbackMessages(value: unknown): FeedbackDialogueMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as Partial<FeedbackDialogueMessage>;
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = cleanString(message.content, 2000);
    if (!content) return [];
    return [{ role: message.role, content }];
  }).slice(-6);
}

function parseStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function normalizeCount(value: unknown): number {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
}

function normalizeRate(value: unknown): number {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}
