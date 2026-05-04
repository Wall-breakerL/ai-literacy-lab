import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeedbackPriority, FeedbackSentiment, FeedbackType } from "@/lib/types";

export type LocalFeedbackRecord = {
  sessionId: string;
  createdAt: string;
  source: "report";
  feedback: string;
  sentiment: FeedbackSentiment;
  priority: FeedbackPriority;
  types: FeedbackType[];
  personalityCode: string;
  context: {
    role: string;
    recentUse: string;
    goal: string;
  };
  questionnaire: {
    total: number;
    answered: number;
    skipRate: number;
  };
};

type FeedbackStorageResult = {
  storage: "local";
  file?: string;
};

const LOCAL_FEEDBACK_DIR = path.join(process.cwd(), ".local-debug", "feedback");

export async function saveLocalFeedback(feedback: LocalFeedbackRecord): Promise<FeedbackStorageResult> {
  const prepared = {
    ...feedback,
    createdAt: feedback.createdAt || new Date().toISOString(),
  };

  return saveToLocal(prepared);
}

async function saveToLocal(feedback: LocalFeedbackRecord): Promise<FeedbackStorageResult> {
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
