/** 浏览器端请求 /api/* 时的重试参数（与访谈页一致） */
export const API_RETRY_MAX_ATTEMPTS = 5;
export const API_RETRY_BASE_DELAY_MS = 1000;
export const API_RETRY_DELAY_CAP_MS = 20000;

export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function isRetryableApiFailure(status: number, detail: string): boolean {
  if (status === 503 && /未配置 QWEN_API_KEY|configuration/i.test(detail)) return false;
  if (status === 401 || status === 403 || status === 400) return false;
  if (status === 500 || status === 502 || status === 503 || status === 429 || status === 504) return true;
  if (/529|负载|稍后重试|overloaded|timeout|rate limit|ECONNRESET|ETIMEDOUT|parse report|Failed to parse/i.test(detail))
    return true;
  return false;
}

export function nextRetryDelayMs(attemptIndex: number): number {
  return Math.min(
    API_RETRY_DELAY_CAP_MS,
    API_RETRY_BASE_DELAY_MS * 2 ** attemptIndex + Math.floor(Math.random() * 400)
  );
}
