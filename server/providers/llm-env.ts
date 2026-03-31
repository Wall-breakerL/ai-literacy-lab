import type { LlmEnvConfig } from "@/server/providers/types";

function readEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

export function getLlmEnvConfig(): LlmEnvConfig {
  const apiKey = readEnv("OPENAI_API_KEY", "");
  const enabled = readEnv("LLM_ENABLED", "true").toLowerCase() !== "false" && apiKey.length > 0;
  return {
    apiKey: apiKey.length > 0 ? apiKey : null,
    baseUrl: readEnv("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, ""),
    modelAgentA: readEnv("OPENAI_MODEL_AGENT_A", "gpt-4o-mini"),
    modelAgentB: readEnv("OPENAI_MODEL_AGENT_B", "gpt-4o-mini"),
    timeoutMs: Math.max(5000, Number.parseInt(readEnv("LLM_TIMEOUT_MS", "45000"), 10) || 45000),
    enabled,
  };
}
