import { getLlmEnvConfig } from "@/server/providers/llm-env";
import { createResponsesApiProvider } from "@/server/providers/responses-api-provider";
import type { LlmProvider } from "@/server/providers/types";

let singleton: LlmProvider | null = null;

/**
 * Returns a provider that prefers OpenAI Responses API when schema is provided,
 * and falls back to Chat Completions with JSON mode.
 */
export function getLlmProvider(): LlmProvider {
  if (singleton) return singleton;
  const cfg = getLlmEnvConfig();
  if (!cfg.apiKey) {
    singleton = {
      async completeStructuredJson() {
        throw new Error("LLM provider not configured (missing OPENAI_API_KEY)");
      },
      async completeText() {
        throw new Error("LLM provider not configured (missing OPENAI_API_KEY)");
      },
    };
    return singleton;
  }
  singleton = createResponsesApiProvider({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    defaultTimeoutMs: cfg.timeoutMs,
  });
  return singleton;
}

export function isLlmConfigured(): boolean {
  return getLlmEnvConfig().enabled && !!getLlmEnvConfig().apiKey;
}
