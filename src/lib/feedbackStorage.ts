import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StructuredFeedback } from "@/lib/types";

type FeedbackStorageResult = {
  storage: "notion" | "local";
  url?: string;
  file?: string;
  warning?: string;
};

const LOCAL_FEEDBACK_DIR = path.join(process.cwd(), ".local-debug", "feedback");
const NOTION_VERSION = process.env.NOTION_VERSION?.trim() || "2026-03-11";
const NOTION_DATA_SOURCE_ID =
  process.env.NOTION_FEEDBACK_DATA_SOURCE_ID?.trim() ||
  process.env.NOTION_FEEDBACK_DATABASE_ID?.trim();
const NOTION_API_KEY = process.env.NOTION_API_KEY?.trim();

export async function saveStructuredFeedback(feedback: StructuredFeedback): Promise<FeedbackStorageResult> {
  const prepared = {
    ...feedback,
    createdAt: feedback.createdAt || new Date().toISOString(),
  };

  if (NOTION_API_KEY && NOTION_DATA_SOURCE_ID) {
    try {
      return await saveToNotion(prepared);
    } catch (error) {
      const local = await saveToLocal(prepared);
      return {
        ...local,
        warning: `Notion write failed, saved locally: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  return saveToLocal(prepared);
}

async function saveToLocal(feedback: StructuredFeedback): Promise<FeedbackStorageResult> {
  await mkdir(LOCAL_FEEDBACK_DIR, { recursive: true });
  const safeTime = (feedback.createdAt || new Date().toISOString()).replace(/[:.]/g, "-");
  const safeSessionId = (feedback.sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const filePath = path.join(LOCAL_FEEDBACK_DIR, `${safeTime}-${safeSessionId}.json`);
  await writeFile(filePath, `${JSON.stringify(feedback, null, 2)}\n`, "utf8");
  return {
    storage: "local",
    file: path.relative(process.cwd(), filePath),
  };
}

async function saveToNotion(feedback: StructuredFeedback): Promise<FeedbackStorageResult> {
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { data_source_id: NOTION_DATA_SOURCE_ID },
      properties: buildNotionProperties(feedback),
      children: buildNotionChildren(feedback),
    }),
  });

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    storage: "notion",
    url: typeof data.url === "string" ? data.url : undefined,
  };
}

function buildNotionProperties(feedback: StructuredFeedback) {
  return {
    "Name": {
      title: [{ text: { content: notionText(`AI-MBTI Feedback · ${feedback.personalityCode} · ${formatDate(feedback.createdAt)}`, 120) } }],
    },
    "Created At": {
      date: { start: feedback.createdAt || new Date().toISOString() },
    },
    "Session ID": richText(feedback.sessionId),
    "Personality": richText(feedback.personalityCode || "unknown"),
    "Role": richText(feedback.role),
    "Recent Use": richText(feedback.recentUse),
    "Goal": richText(feedback.goal),
    "Total Questions": { number: feedback.totalQuestions },
    "Answered Questions": { number: feedback.answeredQuestions },
    "Skip Rate": { number: Math.round(feedback.skipRate * 100) / 100 },
    "Sentiment": { select: { name: feedback.sentiment } },
    "Priority": { select: { name: feedback.priority } },
    "Feedback Type": {
      multi_select: feedback.feedbackTypes.map((name) => ({ name })),
    },
    "Summary": richText(feedback.summary),
    "Stored Source": { select: { name: "claude_feedback_dialogue" } },
  };
}

function buildNotionChildren(feedback: StructuredFeedback) {
  return [
    heading("Claude 整理摘要"),
    paragraph(feedback.summary),
    heading("用户觉得有用"),
    ...listItems(feedback.usefulParts),
    heading("不准或空泛的部分"),
    ...listItems(feedback.inaccurateParts),
    heading("题目问题"),
    ...listItems(feedback.questionIssues),
    heading("报告问题"),
    ...listItems(feedback.reportIssues),
    heading("改进建议"),
    ...listItems(feedback.improvementSuggestions),
    heading("原始反馈对话"),
    ...feedback.rawDialogue.flatMap((message) => [
      paragraph(`${message.role === "assistant" ? "Claude" : "用户"}：${message.content}`),
    ]),
  ].slice(0, 80);
}

function richText(content: string) {
  return { rich_text: [{ text: { content: notionText(content, 1900) } }] };
}

function heading(content: string) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content } }] },
  };
}

function paragraph(content: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: notionText(content || "（无）", 1900) } }] },
  };
}

function listItems(items: string[]) {
  const source = items.length ? items : ["（无）"];
  return source.map((item) => ({
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: notionText(item, 1900) } }],
    },
  }));
}

function notionText(content: string | undefined, maxLength: number) {
  return (content || "（无）").replace(/\s+/g, " ").trim().slice(0, maxLength) || "（无）";
}

function formatDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}
