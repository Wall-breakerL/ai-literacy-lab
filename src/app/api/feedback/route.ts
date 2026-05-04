import { NextRequest, NextResponse } from "next/server";
import { saveLocalFeedback, type LocalFeedbackRecord } from "@/lib/feedbackStorage";
import type {
  FeedbackPriority,
  FeedbackSentiment,
  FeedbackType,
} from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const FEEDBACK_TYPES: FeedbackType[] = [
  "question_issue",
  "report_issue",
  "prompt_template",
  "flow_issue",
  "positive_signal",
];
const SENTIMENTS: FeedbackSentiment[] = ["positive", "mixed", "negative"];
const PRIORITIES: FeedbackPriority[] = ["low", "medium", "high"];
const FEEDBACK_TEXT_LIMIT = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const feedback = parseLocalFeedback(extractFeedbackDraft(body));
  if (!feedback) {
    return NextResponse.json({ error: "bad_request", detail: "缺少有效结构化反馈。" }, { status: 400 });
  }

  try {
    const result = await saveLocalFeedback(feedback);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Feedback save error:", error);
    return NextResponse.json(
      { error: "feedback_save_failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function extractFeedbackDraft(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as { draft?: unknown };
  return "draft" in record ? record.draft : value;
}

function parseLocalFeedback(value: unknown): LocalFeedbackRecord | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const sessionId = cleanString(input.sessionId, 120);
  const feedback = cleanString(input.feedback ?? inferLegacyFeedback(input), FEEDBACK_TEXT_LIMIT);
  if (!sessionId || !feedback) return null;
  const context = readRecord(input.context);
  const questionnaire = readRecord(input.questionnaire);
  return {
    sessionId,
    createdAt: normalizeIsoDate(input.createdAt),
    source: "report",
    feedback,
    sentiment: parseEnum(input.sentiment, SENTIMENTS, "mixed"),
    priority: parseEnum(input.priority, PRIORITIES, "medium"),
    types: parseEnumArray(input.types ?? input.feedbackTypes, FEEDBACK_TYPES, ["report_issue"]),
    personalityCode: cleanString(input.personalityCode, 40) || "unknown",
    context: {
      role: cleanString(context.role ?? input.role, 120) || "用户",
      recentUse: cleanString(context.recentUse ?? input.recentUse, 160) || "使用 AI 完成日常任务",
      goal: cleanString(context.goal ?? input.goal, 160) || "更有效地使用 AI",
    },
    questionnaire: {
      total: normalizeCount(questionnaire.total ?? input.totalQuestions),
      answered: normalizeCount(questionnaire.answered ?? input.answeredQuestions),
      skipRate: normalizeRate(questionnaire.skipRate ?? input.skipRate),
    },
  };
}

function inferLegacyFeedback(input: Record<string, unknown>) {
  const candidates = [
    firstString(input.reportIssues),
    firstString(input.questionIssues),
    firstString(input.improvementSuggestions),
    firstString(input.inaccurateParts),
    firstString(input.usefulParts),
    input.summary,
  ];
  const text = candidates.find((item) => typeof item === "string" && item.trim());
  if (typeof text !== "string") return "";
  return text.replace(/^满意度：[^。]*。用户反馈：/, "");
}

function firstString(value: unknown) {
  return Array.isArray(value) ? value.find((item) => typeof item === "string") : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseEnumArray<T extends string>(value: unknown, allowed: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(value)) return fallback;
  const result = value.filter((item): item is T => typeof item === "string" && allowed.includes(item as T));
  return result.length ? Array.from(new Set(result)) : fallback;
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(/\s+/g, " ").trim()).slice(0, maxLength).join("");
}

function normalizeCount(value: unknown): number {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
}

function normalizeRate(value: unknown): number {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}
