import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  buildPublicAnalyticsSummary,
  sanitizeTestResultPayload,
  sanitizeVisitPayload,
  type AdminAnalyticsSummary,
  type PublicAnalyticsSummary,
  type SanitizedTestResult,
  type SanitizedVisit,
} from "@/lib/analytics/shared";

type RecordResult =
  | { ok: true; disabled?: boolean; limited?: boolean; deduped?: boolean }
  | { ok: false; status: number; error: string };

type AnalyticsDb = Database.Database;

let db: AnalyticsDb | null = null;
const rateLimitBuckets = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;

export function getAnalyticsDatabasePath() {
  return path.resolve(process.env.ANALYTICS_DB_PATH || path.join(process.cwd(), "data", "analytics.db"));
}

export async function recordVisit(payload: unknown, headers?: Headers): Promise<RecordResult> {
  const sanitized = sanitizeVisitPayload(payload);
  if (!sanitized.ok) return { ok: false, status: 400, error: sanitized.error };

  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV !== "production") return { ok: true, disabled: true };
    return { ok: false, status: 503, error: "analytics salt is not configured" };
  }

  const visit = sanitized.visit;
  const visitorHash = hashVisitorId(visit.visitorId);
  if (isRateLimited(visitorHash, getIpPrefix(headers))) {
    return { ok: true, limited: true };
  }

  try {
    const database = getDb();
    const result = database.transaction(() => {
      const inserted = database.prepare(`
        insert or ignore into analytics_visits (visit_id, visitor_hash, path, referrer_host, occurred_at)
        values (?, ?, ?, ?, ?)
      `).run(visit.visitId, visitorHash, visit.path, visit.referrerHost ?? null, visit.occurredAt);
      if (inserted.changes === 0) return { deduped: true };
      upsertVisitor(database, visit, visitorHash);
      upsertVisitDay(database, visit, visitorHash);
      return { deduped: false };
    })();
    return { ok: true, deduped: result.deduped };
  } catch (error) {
    console.error("[analytics] visit write failed", error);
    return { ok: false, status: 500, error: "analytics visit write failed" };
  }
}

export async function recordTestResult(payload: unknown): Promise<RecordResult> {
  const sanitized = sanitizeTestResultPayload(payload);
  if (!sanitized.ok) return { ok: false, status: 400, error: sanitized.error };

  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV !== "production") return { ok: true, disabled: true };
    return { ok: false, status: 503, error: "analytics salt is not configured" };
  }

  try {
    const result = sanitized.result;
    const visitorHash = hashVisitorId(result.visitorId);
    getDb().transaction(() => {
      upsertTestResult(getDb(), result, visitorHash);
    })();
    return { ok: true };
  } catch (error) {
    console.error("[analytics] test result write failed", error);
    return { ok: false, status: 500, error: "analytics test result write failed" };
  }
}

export async function readPublicAnalyticsSummary(): Promise<PublicAnalyticsSummary> {
  const now = new Date().toISOString();
  if (!isAnalyticsEnabled()) {
    return buildPublicAnalyticsSummary({}, now);
  }

  const row = getDb().prepare(`
    select
      (select count(*) from analytics_visitors) as total_visitors,
      (select count(*) from analytics_visit_days where metric_date = date('now', 'localtime')) as today_visitors,
      (select coalesce(sum(visit_count), 0) from analytics_visitors) as total_visits,
      (select count(*) from test_results) as completed_tests_total
  `).get() as {
    total_visitors?: number;
    today_visitors?: number;
    total_visits?: number;
    completed_tests_total?: number;
  } | undefined;

  return buildPublicAnalyticsSummary({
    total_visitors: row?.total_visitors,
    today_visitors: row?.today_visitors,
    total_visits: row?.total_visits,
    completed_tests_total: row?.completed_tests_total,
  }, now);
}

export async function readAdminAnalyticsSummary(input: {
  from?: string | null;
  to?: string | null;
}): Promise<AdminAnalyticsSummary> {
  const range = normalizeDateRange(input.from, input.to);
  if (!isAnalyticsEnabled()) {
    return emptyAdminSummary(range.from, range.to);
  }

  const database = getDb();
  const totals = database.prepare(`
    select
      (select count(*) from analytics_visitors) as total_visitors,
      (select count(*) from analytics_visit_days where metric_date = date('now', 'localtime')) as today_visitors,
      (select coalesce(sum(visit_count), 0) from analytics_visitors) as total_visits,
      (select count(*) from test_results where date(completed_at) between date(?) and date(?)) as completed_tests,
      (select count(*) from questionnaire_samples where date(created_at) between date(?) and date(?)) as questionnaire_samples
  `).get(range.from, range.to, range.from, range.to) as {
    total_visitors?: number;
    today_visitors?: number;
    total_visits?: number;
    completed_tests?: number;
    questionnaire_samples?: number;
  } | undefined;

  const personalityRows = database.prepare(`
    select personality_code, personality_name, count(*) as count
    from test_results
    where date(completed_at) between date(?) and date(?)
    group by personality_code, personality_name
    order by count(*) desc, personality_code asc
    limit 32
  `).all(range.from, range.to) as Array<{
    personality_code: string;
    personality_name: string;
    count: number;
  }>;

  const roleRows = database.prepare(`
    select
      role,
      count(distinct visitor_hash) as visitors,
      count(*) as completed_tests
    from test_results
    where date(completed_at) between date(?) and date(?)
    group by role
    order by count(*) desc, role asc
    limit 24
  `).all(range.from, range.to) as Array<{
    role: string;
    visitors: number;
    completed_tests: number;
  }>;

  const totalVisitors = Number(totals?.total_visitors ?? 0);
  const completedTests = Number(totals?.completed_tests ?? 0);
  return {
    from: range.from,
    to: range.to,
    totals: {
      totalVisitors,
      todayVisitors: Number(totals?.today_visitors ?? 0),
      totalVisits: Number(totals?.total_visits ?? 0),
      completedTests,
      questionnaireSamples: Number(totals?.questionnaire_samples ?? 0),
      completionRate: totalVisitors > 0 ? completedTests / totalVisitors : 0,
    },
    personalityDistribution: personalityRows.map((row) => ({
      personalityCode: row.personality_code,
      personalityName: row.personality_name,
      count: Number(row.count),
    })),
    roleDistribution: roleRows.map((row) => ({
      role: row.role,
      visitors: Number(row.visitors),
      completedTests: Number(row.completed_tests),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function isAuthorizedAnalyticsAdmin(headers: Headers) {
  const token = process.env.ADMIN_ANALYTICS_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production";
  const authorization = headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const headerToken = headers.get("x-admin-analytics-token") ?? "";
  return bearerToken === token || headerToken === token;
}

function getDb() {
  if (!db) {
    const dbPath = getAnalyticsDatabasePath();
    mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    ensureAnalyticsSchema(db);
  }
  return db;
}

function ensureAnalyticsSchema(database: AnalyticsDb) {
  const migrationPath = path.join(process.cwd(), "db", "migrations", "001_analytics.sql");
  if (!existsSync(migrationPath)) throw new Error(`Missing analytics migration: ${migrationPath}`);
  database.exec(readFileSync(migrationPath, "utf8"));
}

function upsertVisitor(database: AnalyticsDb, visit: SanitizedVisit, visitorHash: string) {
  database.prepare(`
    insert into analytics_visitors (
      visitor_hash,
      first_seen_at,
      last_seen_at,
      visit_count,
      first_path,
      last_path,
      referrer_host
    )
    values (?, ?, ?, 1, ?, ?, ?)
    on conflict(visitor_hash) do update set
      last_seen_at = max(analytics_visitors.last_seen_at, excluded.last_seen_at),
      visit_count = analytics_visitors.visit_count + 1,
      last_path = excluded.last_path,
      referrer_host = coalesce(analytics_visitors.referrer_host, excluded.referrer_host),
      updated_at = datetime('now')
  `).run(visitorHash, visit.occurredAt, visit.occurredAt, visit.path, visit.path, visit.referrerHost ?? null);
}

function upsertVisitDay(database: AnalyticsDb, visit: SanitizedVisit, visitorHash: string) {
  database.prepare(`
    insert into analytics_visit_days (metric_date, visitor_hash, visit_count, first_seen_at, last_seen_at)
    values (date(?), ?, 1, ?, ?)
    on conflict(metric_date, visitor_hash) do update set
      visit_count = analytics_visit_days.visit_count + 1,
      last_seen_at = max(analytics_visit_days.last_seen_at, excluded.last_seen_at)
  `).run(visit.occurredAt, visitorHash, visit.occurredAt, visit.occurredAt);
}

function upsertTestResult(database: AnalyticsDb, result: SanitizedTestResult, visitorHash: string) {
  database.prepare(`
    insert into test_results (
      result_id,
      visitor_hash,
      session_id,
      role,
      tools,
      personality_code,
      personality_name,
      dimension_scores,
      completed_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(session_id) do update set
      result_id = excluded.result_id,
      role = excluded.role,
      tools = excluded.tools,
      personality_code = excluded.personality_code,
      personality_name = excluded.personality_name,
      dimension_scores = excluded.dimension_scores,
      completed_at = excluded.completed_at
  `).run(
    result.resultId,
    visitorHash,
    result.sessionId,
    result.role,
    JSON.stringify(result.tools),
    result.personalityCode,
    result.personalityName,
    JSON.stringify(result.dimensions),
    result.completedAt
  );

  const resultRow = database.prepare("select id from test_results where session_id = ?").get(result.sessionId) as { id: number } | undefined;
  if (!resultRow) return;
  database.prepare("delete from questionnaire_samples where test_result_id = ?").run(resultRow.id);
  const insertSample = database.prepare(`
    insert into questionnaire_samples (
      test_result_id,
      session_id,
      role,
      tools,
      batch_key,
      question_index,
      dimension,
      question,
      scenario,
      question_type,
      reverse,
      score,
      skipped
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const sample of result.questionnaireSamples) {
    insertSample.run(
      resultRow.id,
      result.sessionId,
      result.role,
      JSON.stringify(result.tools),
      sample.batchKey ?? null,
      sample.index,
      sample.dimension,
      sample.question,
      sample.scenario ?? null,
      sample.questionType ?? null,
      sample.reverse ? 1 : 0,
      sample.score,
      sample.skipped ? 1 : 0
    );
  }
}

function normalizeDateRange(from?: string | null, to?: string | null) {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(today.getDate() - 13);
  return {
    from: normalizeDateOnly(from) ?? formatDateOnly(defaultFrom),
    to: normalizeDateOnly(to) ?? formatDateOnly(today),
  };
}

function normalizeDateOnly(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? value : null;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function emptyAdminSummary(from: string, to: string): AdminAnalyticsSummary {
  return {
    from,
    to,
    totals: {
      totalVisitors: 0,
      todayVisitors: 0,
      totalVisits: 0,
      completedTests: 0,
      questionnaireSamples: 0,
      completionRate: 0,
    },
    personalityDistribution: [],
    roleDistribution: [],
    updatedAt: new Date().toISOString(),
  };
}

function isAnalyticsEnabled() {
  return Boolean(process.env.ANALYTICS_SALT);
}

function hashVisitorId(visitorId: string) {
  return createHash("sha256")
    .update(`${visitorId}:${process.env.ANALYTICS_SALT ?? ""}`)
    .digest("hex");
}

function isRateLimited(visitorHash: string, ipPrefix: string | null) {
  const limit = Number(process.env.ANALYTICS_RATE_LIMIT_PER_MINUTE ?? 60);
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const now = Date.now();
  const keys = [`visitor:${visitorHash}`, ipPrefix ? `ip:${ipPrefix}` : ""].filter(Boolean);
  for (const key of keys) {
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      rateLimitBuckets.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
      continue;
    }
    bucket.count += 1;
    if (bucket.count > limit) return true;
  }
  if (rateLimitBuckets.size > 5000) {
    for (const [key, bucket] of Array.from(rateLimitBuckets.entries())) {
      if (bucket.expiresAt <= now) rateLimitBuckets.delete(key);
    }
  }
  return false;
}

function getIpPrefix(headers?: Headers) {
  const forwardedFor = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers?.get("x-real-ip")?.trim();
  const value = forwardedFor || realIp || "";
  if (!value) return null;
  if (value.includes(":")) return value.split(":").slice(0, 4).join(":");
  const parts = value.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : null;
}
