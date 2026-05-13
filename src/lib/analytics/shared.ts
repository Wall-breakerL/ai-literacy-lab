import type { Dimension } from "@/lib/types";

export type VisitPayload = {
  visitId: string;
  visitorId: string;
  path: string;
  referrer?: string;
  occurredAt: string;
};

export type SanitizedVisit = {
  visitId: string;
  visitorId: string;
  path: string;
  referrerHost?: string;
  occurredAt: string;
};

export type TestResultPayload = {
  resultId: string;
  visitorId: string;
  sessionId: string;
  role: string;
  tools?: string[];
  personalityCode: string;
  personalityName: string;
  dimensions: Array<{
    dimension: Dimension;
    score: number;
    scorePercent?: number;
    tendencyLabel?: string;
  }>;
  questionnaireSamples: QuestionnaireSamplePayload[];
  completedAt: string;
};

export type QuestionnaireSamplePayload = {
  batchKey?: string;
  index: number;
  dimension: Dimension;
  question: string;
  scenario?: string;
  questionType?: string;
  reverse?: boolean;
  score: number | null;
  skipped?: boolean;
};

export type SanitizedTestResult = Omit<TestResultPayload, "questionnaireSamples"> & {
  questionnaireSamples: QuestionnaireSamplePayload[];
};

export type PublicAnalyticsSummary = {
  totalVisitors: number;
  todayVisitors: number;
  totalVisits: number;
  completedTestsTotal: number;
  updatedAt: string;
};

export type AdminPersonalityMetric = {
  personalityCode: string;
  personalityName: string;
  count: number;
};

export type AdminRoleMetric = {
  role: string;
  visitors: number;
  completedTests: number;
};

export type AdminAnalyticsSummary = {
  from: string;
  to: string;
  totals: {
    totalVisitors: number;
    todayVisitors: number;
    totalVisits: number;
    completedTests: number;
    questionnaireSamples: number;
    completionRate: number;
  };
  personalityDistribution: AdminPersonalityMetric[];
  roleDistribution: AdminRoleMetric[];
  updatedAt: string;
};

const MAX_ID_LENGTH = 140;
const MAX_PATH_LENGTH = 180;
const MAX_SHORT_TEXT_LENGTH = 120;
const MAX_QUESTION_LENGTH = 420;
const MAX_SCENARIO_LENGTH = 160;
const DIMENSION_SET = new Set(["Relation", "Workflow", "Epistemic", "RepairScope"]);

export function sanitizeVisitPayload(value: unknown):
  | { ok: true; visit: SanitizedVisit }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "payload must be an object" };
  }

  const input = value as Record<string, unknown>;
  const visitId = cleanString(input.visitId, MAX_ID_LENGTH);
  const visitorId = cleanString(input.visitorId, MAX_ID_LENGTH);
  const path = normalizePath(cleanString(input.path, 500));
  const occurredAt = normalizeIsoDate(input.occurredAt);

  if (!visitId) return { ok: false, error: "missing visitId" };
  if (!visitorId) return { ok: false, error: "missing visitorId" };
  if (!path) return { ok: false, error: "missing path" };
  if (!occurredAt) return { ok: false, error: "invalid occurredAt" };

  return {
    ok: true,
    visit: {
      visitId,
      visitorId,
      path,
      referrerHost: normalizeReferrerHost(cleanString(input.referrer, 500)),
      occurredAt,
    },
  };
}

export function sanitizeTestResultPayload(value: unknown):
  | { ok: true; result: SanitizedTestResult }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "payload must be an object" };
  }

  const input = value as Record<string, unknown>;
  const resultId = cleanString(input.resultId, MAX_ID_LENGTH);
  const visitorId = cleanString(input.visitorId, MAX_ID_LENGTH);
  const sessionId = cleanString(input.sessionId, MAX_ID_LENGTH);
  const role = cleanString(input.role, MAX_SHORT_TEXT_LENGTH) || "未填写";
  const personalityCode = cleanString(input.personalityCode, 24);
  const personalityName = cleanString(input.personalityName, MAX_SHORT_TEXT_LENGTH);
  const completedAt = normalizeIsoDate(input.completedAt);
  const tools = Array.isArray(input.tools)
    ? input.tools.map((tool) => cleanString(tool, 40)).filter(Boolean).slice(0, 12)
    : [];
  const dimensions = sanitizeDimensions(input.dimensions);
  const questionnaireSamples = sanitizeQuestionnaireSamples(input.questionnaireSamples);

  if (!resultId) return { ok: false, error: "missing resultId" };
  if (!visitorId) return { ok: false, error: "missing visitorId" };
  if (!sessionId) return { ok: false, error: "missing sessionId" };
  if (!personalityCode) return { ok: false, error: "missing personalityCode" };
  if (!personalityName) return { ok: false, error: "missing personalityName" };
  if (!completedAt) return { ok: false, error: "invalid completedAt" };
  if (!dimensions.length) return { ok: false, error: "missing dimensions" };

  return {
    ok: true,
    result: {
      resultId,
      visitorId,
      sessionId,
      role,
      tools,
      personalityCode,
      personalityName,
      dimensions,
      questionnaireSamples,
      completedAt,
    },
  };
}

export function buildPublicAnalyticsSummary(
  totals: Record<string, number | undefined>,
  updatedAt: string
): PublicAnalyticsSummary {
  return {
    totalVisitors: normalizeCount(totals.total_visitors),
    todayVisitors: normalizeCount(totals.today_visitors),
    totalVisits: normalizeCount(totals.total_visits),
    completedTestsTotal: normalizeCount(totals.completed_tests_total),
    updatedAt: normalizeIsoDate(updatedAt) || new Date(0).toISOString(),
  };
}

function sanitizeDimensions(value: unknown): SanitizedTestResult["dimensions"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const dimension = cleanString(row.dimension, 40);
    if (!DIMENSION_SET.has(dimension)) return [];
    return [{
      dimension: dimension as Dimension,
      score: normalizeScore(row.score),
      scorePercent: typeof row.scorePercent === "number" && Number.isFinite(row.scorePercent)
        ? Math.max(0, Math.min(100, Math.round(row.scorePercent)))
        : undefined,
      tendencyLabel: cleanString(row.tendencyLabel, MAX_SHORT_TEXT_LENGTH) || undefined,
    }];
  });
}

function sanitizeQuestionnaireSamples(value: unknown): QuestionnaireSamplePayload[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const dimension = cleanString(row.dimension, 40);
    const question = cleanString(row.question, MAX_QUESTION_LENGTH);
    if (!DIMENSION_SET.has(dimension) || !question) return [];
    return [{
      batchKey: cleanString(row.batchKey, 24) || undefined,
      index: normalizeCount(row.index),
      dimension: dimension as Dimension,
      question,
      scenario: cleanString(row.scenario, MAX_SCENARIO_LENGTH) || undefined,
      questionType: cleanString(row.questionType, 40) || undefined,
      reverse: Boolean(row.reverse),
      score: typeof row.score === "number" && Number.isFinite(row.score) ? Math.max(0, Math.min(5, Math.round(row.score))) : null,
      skipped: Boolean(row.skipped) || row.score == null,
    }];
  }).slice(0, 40);
}

function normalizePath(value: string): string {
  if (!value) return "";
  const path = value.startsWith("http://") || value.startsWith("https://")
    ? safeUrl(value)?.pathname ?? ""
    : value.split("?")[0]?.split("#")[0] ?? "";
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean.slice(0, MAX_PATH_LENGTH);
}

function normalizeReferrerHost(value: string): string | undefined {
  if (!value) return undefined;
  return safeUrl(value)?.hostname.slice(0, 120) || undefined;
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString();
}

function normalizeCount(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function normalizeScore(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
