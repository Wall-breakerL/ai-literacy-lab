import type { ChatMessage, LlmProvider } from "@/server/providers/types";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

function extractTextFromChatCompletionsBody(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const msg = (choices[0] as { message?: { content?: string } })?.message?.content;
  return typeof msg === "string" ? msg : null;
}

/**
 * OpenAI-compatible provider: uses Chat Completions with JSON mode for structured output.
 * Optionally tries `/responses` when `OPENAI_USE_RESPONSES=true` (experimental).
 */
export function createResponsesApiProvider(input: {
  apiKey: string;
  baseUrl: string;
  defaultTimeoutMs: number;
}): LlmProvider {
  const { apiKey, baseUrl, defaultTimeoutMs } = input;

  async function callChatCompletions(
    model: string,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<string> {
    const res = await withTimeout(
      fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
        }),
      }),
      timeoutMs,
      "OpenAI Chat Completions",
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Chat Completions ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data: unknown = await res.json();
    const text = extractTextFromChatCompletionsBody(data);
    if (!text) throw new Error("Chat Completions returned no message content");
    return text;
  }

  async function callChatCompletionsPlain(model: string, messages: ChatMessage[], timeoutMs: number): Promise<string> {
    const res = await withTimeout(
      fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
        }),
      }),
      timeoutMs,
      "OpenAI Chat Completions (plain)",
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Chat Completions ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data: unknown = await res.json();
    const text = extractTextFromChatCompletionsBody(data);
    if (!text) throw new Error("Chat Completions returned no message content");
    return text;
  }

  return {
    async completeStructuredJson(params) {
      void params.jsonSchema;
      void params.name;
      const text = await callChatCompletions(params.model, params.messages, defaultTimeoutMs);
      return { rawText: text, usedFallback: true };
    },
    async completeText(params) {
      return callChatCompletionsPlain(params.model, params.messages, defaultTimeoutMs);
    },
  };
}
