import { NextRequest, NextResponse } from "next/server";
import { saveStructuredFeedback } from "@/lib/feedbackStorage";
import type {
  FeedbackDialogueMessage,
  FeedbackPriority,
  FeedbackSentiment,
  FeedbackType,
  StructuredFeedback,
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const feedback = parseStructuredFeedback(extractFeedbackDraft(body));
  if (!feedback) {
    return NextResponse.json({ error: "bad_request", detail: "缺少有效结构化反馈。" }, { status: 400 });
  }

  try {
    const result = await saveStructuredFeedback(feedback);
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

function parseStructuredFeedback(value: unknown): StructuredFeedback | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<StructuredFeedback>;
  const sessionId = cleanString(input.sessionId, 120);
  const summary = cleanString(input.summary, 1000);
  if (!sessionId || !summary) return null;
  return {
    sessionId,
    personalityCode: cleanString(input.personalityCode, 40) || "unknown",
    role: cleanString(input.role, 200) || "用户",
    recentUse: cleanString(input.recentUse, 300) || "使用 AI 完成日常任务",
    goal: cleanString(input.goal, 300) || "更有效地使用 AI",
    totalQuestions: normalizeCount(input.totalQuestions),
    answeredQuestions: normalizeCount(input.answeredQuestions),
    skipRate: normalizeRate(input.skipRate),
    summary,
    usefulParts: parseStringArray(input.usefulParts, 8, 500),
    inaccurateParts: parseStringArray(input.inaccurateParts, 8, 500),
    questionIssues: parseStringArray(input.questionIssues, 8, 500),
    reportIssues: parseStringArray(input.reportIssues, 8, 500),
    improvementSuggestions: parseStringArray(input.improvementSuggestions, 8, 500),
    sentiment: parseEnum(input.sentiment, SENTIMENTS, "mixed"),
    priority: parseEnum(input.priority, PRIORITIES, "medium"),
    feedbackTypes: parseEnumArray(input.feedbackTypes, FEEDBACK_TYPES, ["report_issue"]),
    rawDialogue: parseDialogue(input.rawDialogue),
    createdAt: normalizeIsoDate(input.createdAt),
  };
}

function parseDialogue(value: unknown): FeedbackDialogueMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as Partial<FeedbackDialogueMessage>;
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = cleanString(message.content, 2000);
    if (!content) return [];
    return [{ role: message.role, content }];
  }).slice(-8);
}

function parseStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
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
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
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
