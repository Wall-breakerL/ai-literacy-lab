import { getUpstreamErrorMessage } from "@/lib/minimax";

function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const s = (err as { status?: number | string }).status;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  if (typeof s === "string" && /^\d+$/.test(s)) return parseInt(s, 10);
  return undefined;
}

function isRetryableUpstreamError(err: unknown): boolean {
  const status = getHttpStatus(err);
  if (status === 429 || status === 503 || status === 529) return true;
  const msg = getUpstreamErrorMessage(err) ?? String(err);
  return /负载|稍后重试|overloaded|529|503|timeout|rate limit|ECONNRESET|ETIMEDOUT/i.test(msg);
}

const LLM_RETRY_DELAY_MS = 20_000;

/**
 * 上游短时过载（如 529）时重试；固定间隔，避免打爆 API。
 */
export async function withLlmRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retry = isRetryableUpstreamError(e) && attempt < maxAttempts - 1;
      if (!retry) throw e;
      await new Promise((r) => setTimeout(r, LLM_RETRY_DELAY_MS));
    }
  }
  throw last;
}
