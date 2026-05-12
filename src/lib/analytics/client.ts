import type { TestResultPayload, VisitPayload } from "@/lib/analytics/shared";
import { trackObservabilityEvent } from "@/lib/observability/browser";

const VISITOR_ID_KEY = "ai_mbti_visitor_id";
const TRACKING_SESSION_ID_KEY = "ai_mbti_tracking_session_id";
const SESSION_STATE_KEY = "ai_mbti_session_state";
const RECORDED_RESULT_PREFIX = "ai_mbti_recorded_result";

export function getOrCreateAnalyticsVisitorId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;
  const next = randomId("visitor");
  localStorage.setItem(VISITOR_ID_KEY, next);
  return next;
}

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") return "";
  const sessionId = readSessionStateId();
  if (sessionId) return sessionId;
  const existing = sessionStorage.getItem(TRACKING_SESSION_ID_KEY);
  if (existing) return existing;
  const next = randomId("session");
  sessionStorage.setItem(TRACKING_SESSION_ID_KEY, next);
  return next;
}

export function recordVisit(path?: string) {
  if (typeof window === "undefined") return;
  const visitorId = getOrCreateAnalyticsVisitorId();
  if (!visitorId) return;
  const payload: VisitPayload = {
    visitId: randomId("visit"),
    visitorId,
    path: path ?? `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer,
    occurredAt: new Date().toISOString(),
  };

  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") {
    console.info("[analytics:visit]", payload);
  }

  sendPayload("/api/analytics/visit", payload);
  trackObservabilityEvent({
    type: "visit",
    path: payload.path,
    occurredAt: payload.occurredAt,
  });
}

export function recordTestResult(payload: Omit<TestResultPayload, "resultId" | "visitorId" | "completedAt">) {
  if (typeof window === "undefined") return;
  const visitorId = getOrCreateAnalyticsVisitorId();
  if (!visitorId) return;
  const key = `${RECORDED_RESULT_PREFIX}:${payload.sessionId}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");

  const fullPayload: TestResultPayload = {
    ...payload,
    resultId: randomId("result"),
    visitorId,
    completedAt: new Date().toISOString(),
  };

  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") {
    console.info("[analytics:test-result]", fullPayload);
  }

  sendPayload("/api/analytics/test-result", fullPayload);
  trackObservabilityEvent({
    type: "test_result",
    path: window.location.pathname,
    sessionId: payload.sessionId,
    occurredAt: fullPayload.completedAt,
    metadata: {
      personalityCode: payload.personalityCode,
      role: payload.role,
      questionnaireSamples: payload.questionnaireSamples.length,
    },
  });
}

function sendPayload(endpoint: string, payload: unknown) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }
  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function readSessionStateId() {
  try {
    const raw = sessionStorage.getItem(SESSION_STATE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { sessionId?: unknown };
    return typeof parsed.sessionId === "string" ? parsed.sessionId : "";
  } catch {
    return "";
  }
}

function randomId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}
