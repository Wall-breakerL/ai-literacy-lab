/**
 * LLM provider contracts — keep HTTP/fetch out of engine code.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface LlmCallOptions {
  timeoutMs?: number;
  /** When set, request JSON-only output (OpenAI-compatible). */
  jsonMode?: boolean;
}

export interface LlmProvider {
  /** Prefer Responses API when available; may fall back to Chat Completions internally. */
  completeStructuredJson(input: {
    model: string;
    messages: ChatMessage[];
    /** Optional JSON Schema for Responses API text.format */
    jsonSchema?: Record<string, unknown>;
    name?: string;
  }): Promise<{ rawText: string; usedFallback: boolean }>;
  /** Plain assistant text (Agent A user-visible). */
  completeText(input: { model: string; messages: ChatMessage[] }): Promise<string>;
}

export interface LlmEnvConfig {
  apiKey: string | null;
  baseUrl: string;
  modelAgentA: string;
  modelAgentB: string;
  timeoutMs: number;
  /** When false or no key, engine uses rule-based fallbacks only. */
  enabled: boolean;
}
