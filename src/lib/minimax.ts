import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY ?? "",
  baseURL: process.env.MINIMAX_BASE_URL?.trim() || "https://api.minimaxi.com/v1",
});

export const MODEL = "MiniMax-M2.7";

/** 部署前必须在环境变量中配置（如 Vercel → Environment Variables → Production） */
export function assertMiniMaxApiKey(): string | null {
  if (!process.env.MINIMAX_API_KEY?.trim()) {
    return "未配置 MINIMAX_API_KEY：在 Vercel 打开项目 → Settings → Environment Variables，为 Production 添加该变量并重新部署。";
  }
  return null;
}

export function getUpstreamErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as Record<string, unknown>;
  if (typeof e.message === "string" && e.message.length > 0) return e.message;
  const nested = e.error;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    if (typeof n.message === "string") return n.message;
  }
  return undefined;
}

export default client;
