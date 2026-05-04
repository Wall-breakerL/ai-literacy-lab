const OPENAI_COMPATIBLE_BASE_URL =
  process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() || "https://api.openai.com/v1";
const OPENAI_COMPATIBLE_FORCE_TEMPERATURE = parseOptionalNumber(
  process.env.OPENAI_COMPATIBLE_FORCE_TEMPERATURE
);
const ENABLE_PROMPT_CACHE = process.env.ENABLE_PROMPT_CACHE !== "0";

export const QWEN_BASE_URL = OPENAI_COMPATIBLE_BASE_URL;
export const RESEARCHER_MODEL = process.env.QWEN_MODEL?.trim() || "qwen3.6-plus";
export const RESEARCHER_FALLBACK_MODEL =
  process.env.QWEN_FALLBACK_MODEL?.trim() || RESEARCHER_MODEL;
export const RESEARCHER_MAX_TOKENS = parsePositiveInt(process.env.QWEN_MAX_TOKENS, 8192);
export const REPORT_MODEL = process.env.QWEN_REPORT_MODEL?.trim() || RESEARCHER_MODEL;
export const REPORT_MAX_TOKENS = parsePositiveInt(process.env.QWEN_REPORT_MAX_TOKENS, 8192);

type QwenRole = "user" | "assistant";

export type QwenMessage = {
  role: QwenRole;
  content: string;
};

type CreateQwenMessageParams = {
  model: string;
  system?: QwenSystemPrompt;
  messages: QwenMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type QwenSystemTextBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

export type QwenSystemPrompt = string | QwenSystemTextBlock[];

export type QwenTool = {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
};

export type QwenToolChoice = "auto" | "none" | { type: "tool"; name: string };

type CreateQwenMessageWithToolsParams = CreateQwenMessageParams & {
  tools: QwenTool[];
  toolChoice?: QwenToolChoice;
};

export type QwenToolUse = {
  id?: string;
  name: string;
  input: unknown;
};

export type QwenMessageWithToolsResult = {
  textBlocks: string[];
  toolUses: QwenToolUse[];
  stopReason?: string;
};

type OpenAiCompatibleToolCall = {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
  name?: string;
  arguments?: unknown;
  input?: unknown;
};

type OpenAiCompatibleMessageContent =
  | string
  | Array<{ type?: string; text?: string } | { [key: string]: unknown }>
  | undefined;

type OpenAiCompatibleResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: OpenAiCompatibleMessageContent;
      tool_calls?: OpenAiCompatibleToolCall[];
    };
  }>;
};

type QwenErrorPayload = {
  error?: {
    type?: string;
    message?: string;
  };
  message?: string;
};

export class QwenApiError extends Error {
  status?: number;
  type?: string;
  body?: unknown;
  requestId?: string | null;

  constructor(
    message: string,
    options?: { status?: number; type?: string; body?: unknown; requestId?: string | null }
  ) {
    super(message);
    this.name = "QwenApiError";
    this.status = options?.status;
    this.type = options?.type;
    this.body = options?.body;
    this.requestId = options?.requestId;
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function openAiCompatibleUrl(path: string): string {
  return `${OPENAI_COMPATIBLE_BASE_URL.replace(/\/$/, "")}${path}`;
}

/**
 * DashScope Qwen hybrid-thinking models reject forced `tool_choice` unless
 * `enable_thinking` is explicitly false on non-stream calls.
 */
function mergeOpenAiCompatibleChatBody(base: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...base };
  const baseUrl = OPENAI_COMPATIBLE_BASE_URL.toLowerCase();
  const isDashScope =
    baseUrl.includes("dashscope.aliyuncs.com") || baseUrl.includes("dashscope-intl.aliyuncs.com");
  if (isDashScope && process.env.OPENAI_COMPATIBLE_ENABLE_THINKING?.trim() !== "1") {
    body.enable_thinking = false;
  }
  const extraJson = process.env.OPENAI_COMPATIBLE_EXTRA_JSON?.trim();
  if (!extraJson) return body;
  const parsed = safeJsonParse(extraJson);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[qwen] OPENAI_COMPATIBLE_EXTRA_JSON must be a JSON object; ignoring.");
    }
    return body;
  }
  return { ...body, ...(parsed as Record<string, unknown>) };
}

function getOpenAiCompatibleApiKey(): string {
  return process.env.OPENAI_COMPATIBLE_API_KEY?.trim() || "";
}

function normalizeQwenMessages(messages: QwenMessage[]): QwenMessage[] {
  const normalized: QwenMessage[] = [];
  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;
    const last = normalized[normalized.length - 1];
    if (last?.role === message.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      normalized.push({ role: message.role, content });
    }
  }
  return normalized.length > 0 ? normalized : [{ role: "user", content: "请继续。" }];
}

export function cacheSystemPrompt(text: string): QwenSystemPrompt {
  return ENABLE_PROMPT_CACHE
    ? [{ type: "text", text, cache_control: { type: "ephemeral" } }]
    : text;
}

export function appendSystemPromptBlock(
  system: QwenSystemPrompt | undefined,
  text: string,
  options?: { cache?: boolean }
): QwenSystemPrompt {
  const clean = text.trim();
  if (!clean) return system ?? "";
  const block: QwenSystemTextBlock = {
    type: "text",
    text: clean,
    ...(ENABLE_PROMPT_CACHE && options?.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
  };
  if (Array.isArray(system)) return [...system, block];
  if (typeof system === "string" && system.trim()) {
    return [{ type: "text", text: system.trim() }, block];
  }
  return [block];
}

function systemPromptToOpenAiText(system: QwenSystemPrompt | undefined): string | undefined {
  if (!system) return undefined;
  if (typeof system === "string") return system.trim() || undefined;
  const text = system.map((block) => block.text.trim()).filter(Boolean).join("\n\n");
  return text || undefined;
}

export function assertQwenApiConfig(): string | null {
  if (!getOpenAiCompatibleApiKey()) {
    return "未配置 OPENAI_COMPATIBLE_API_KEY：Qwen OpenAI-compatible 网关需要 Bearer API key。";
  }
  if (!OPENAI_COMPATIBLE_BASE_URL.trim()) {
    return "未配置 OPENAI_COMPATIBLE_BASE_URL：Qwen OpenAI-compatible 网关需要 /v1 base URL。";
  }
  return null;
}

export function getUpstreamErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as Record<string, unknown>;
  const status = typeof e.status === "number" ? e.status : undefined;
  const type = typeof e.type === "string" ? e.type : undefined;
  const requestId = typeof e.requestId === "string" ? e.requestId : undefined;
  const cause = e.cause;
  if (cause && typeof cause === "object") {
    const c = cause as Record<string, unknown>;
    const code = typeof c.code === "string" ? c.code : undefined;
    const causeMessage = typeof c.message === "string" ? c.message : undefined;
    if (code || causeMessage) return [code, causeMessage].filter(Boolean).join(": ");
  }
  if (typeof e.message === "string" && e.message.length > 0) return e.message;
  const nested = e.error;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    if (typeof n.message === "string") return n.message;
  }
  if (e.body && typeof e.body === "object") {
    const body = e.body as QwenErrorPayload;
    if (typeof body.error?.message === "string") return body.error.message;
    if (typeof body.message === "string") return body.message;
  }
  if (status) {
    return describeQwenHttpError({ status, type, message: undefined, requestId });
  }
  return undefined;
}

function describeQwenHttpError({
  status,
  type,
  message,
  requestId,
}: {
  status?: number;
  type?: string;
  message?: string;
  requestId?: string | null;
}) {
  const suffix = [
    message ? `上游信息：${message}` : "",
    requestId ? `request-id：${requestId}` : "",
  ].filter(Boolean).join("；");
  const tail = suffix ? `（${suffix}）` : "";

  if (status === 401) {
    return `Qwen API 认证失败：请检查 API key 是否有效且没有复制错误${tail}`;
  }
  if (status === 403) {
    return `Qwen API 拒绝请求：当前 API key 没有权限访问该资源，常见原因是账号/组织权限、余额/计费、地域或网络访问限制，或 base URL 网关接口不兼容${tail}`;
  }
  if (status === 404) {
    return `Qwen API 找不到请求资源：请检查模型 ID、base URL 和 API 路径是否正确${tail}`;
  }
  if (status === 429) {
    return `Qwen API 触发限流：请稍后重试，或检查账号 rate limit${tail}`;
  }
  if (status && status >= 500) {
    return `Qwen API 服务端错误 ${status}：请稍后重试或查看上游服务状态${tail}`;
  }
  return message ?? type ?? undefined;
}

export async function createQwenMessage({
  model,
  system,
  messages,
  temperature,
  maxTokens,
}: CreateQwenMessageParams): Promise<string> {
  const normalizedMessages = normalizeQwenMessages(messages);
  const systemText = systemPromptToOpenAiText(system);
  const chatMessages = [
    ...(systemText ? [{ role: "system" as const, content: systemText }] : []),
    ...normalizedMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const response = await fetch(openAiCompatibleUrl("/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiCompatibleApiKey()}`,
    },
    body: JSON.stringify(
      mergeOpenAiCompatibleChatBody({
        model,
        max_tokens: maxTokens ?? RESEARCHER_MAX_TOKENS,
        temperature: OPENAI_COMPATIBLE_FORCE_TEMPERATURE ?? temperature,
        messages: chatMessages,
      })
    ),
    cache: "no-store",
  });

  const raw = await response.text();
  const parsed = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const errBody = parsed as QwenErrorPayload | null;
    const upstreamMessage = errBody?.error?.message || errBody?.message;
    const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id");
    const message = describeQwenHttpError({
      status: response.status,
      type: errBody?.error?.type,
      message: upstreamMessage,
      requestId,
    }) ?? `Qwen API request failed with status ${response.status}`;
    throw new QwenApiError(message, {
      status: response.status,
      type: errBody?.error?.type,
      body: parsed ?? raw,
      requestId,
    });
  }

  const data = parsed as OpenAiCompatibleResponse | null;
  const content = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content
        .map((block) => {
          if ("text" in block && typeof block.text === "string") return block.text;
          return "";
        })
        .join("")
        .trim()
    : content?.trim();

  if (!text) {
    throw new QwenApiError("Qwen API returned an empty text response", {
      status: response.status,
      body: parsed ?? raw,
    });
  }

  return text;
}

export async function createQwenMessageWithTools({
  model,
  system,
  messages,
  temperature,
  maxTokens,
  tools,
  toolChoice = "auto",
}: CreateQwenMessageWithToolsParams): Promise<QwenMessageWithToolsResult> {
  if (tools.length === 0 || toolChoice === "none") {
    const text = await createQwenMessage({ model, system, messages, temperature, maxTokens });
    return { textBlocks: text ? [text] : [], toolUses: [], stopReason: "end_turn" };
  }

  const normalizedMessages = normalizeQwenMessages(messages);
  const systemText = systemPromptToOpenAiText(system);
  const chatMessages = [
    ...(systemText ? [{ role: "system" as const, content: systemText }] : []),
    ...normalizedMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const response = await fetch(openAiCompatibleUrl("/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiCompatibleApiKey()}`,
    },
    body: JSON.stringify(
      mergeOpenAiCompatibleChatBody({
        model,
        max_tokens: maxTokens ?? RESEARCHER_MAX_TOKENS,
        temperature: OPENAI_COMPATIBLE_FORCE_TEMPERATURE ?? temperature,
        messages: chatMessages,
        tools: tools.map(toOpenAiCompatibleTool),
        tool_choice: toOpenAiCompatibleToolChoice(toolChoice),
      })
    ),
    cache: "no-store",
  });

  const raw = await response.text();
  const parsed = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const errBody = parsed as QwenErrorPayload | null;
    const upstreamMessage = errBody?.error?.message || errBody?.message;
    const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id");
    const message = describeQwenHttpError({
      status: response.status,
      type: errBody?.error?.type,
      message: upstreamMessage,
      requestId,
    }) ?? `Qwen API tool request failed with status ${response.status}`;
    throw new QwenApiError(message, {
      status: response.status,
      type: errBody?.error?.type,
      body: parsed ?? raw,
      requestId,
    });
  }

  const data = parsed as OpenAiCompatibleResponse | null;
  const choice = data?.choices?.[0];
  const message = choice?.message;
  const textBlocks = extractOpenAiTextBlocks(message?.content);
  const toolUses = [
    ...extractOpenAiToolCalls(message?.tool_calls),
    ...extractOpenAiToolUsesFromContent(message?.content),
  ];

  if (textBlocks.length === 0 && toolUses.length === 0) {
    throw new QwenApiError("Qwen API returned no text or tool calls", {
      status: response.status,
      body: parsed ?? raw,
    });
  }

  return { textBlocks, toolUses, stopReason: choice?.finish_reason };
}

export async function* createQwenMessageStream({
  model,
  system,
  messages,
  temperature,
  maxTokens,
}: CreateQwenMessageParams): AsyncGenerator<string> {
  const normalizedMessages = normalizeQwenMessages(messages);
  const systemText = systemPromptToOpenAiText(system);
  const chatMessages = [
    ...(systemText ? [{ role: "system" as const, content: systemText }] : []),
    ...normalizedMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const response = await fetch(openAiCompatibleUrl("/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiCompatibleApiKey()}`,
    },
    body: JSON.stringify(
      mergeOpenAiCompatibleChatBody({
        model,
        max_tokens: maxTokens ?? RESEARCHER_MAX_TOKENS,
        temperature: OPENAI_COMPATIBLE_FORCE_TEMPERATURE ?? temperature,
        messages: chatMessages,
        stream: true,
      })
    ),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const raw = await response.text();
    const parsed = raw ? safeJsonParse(raw) : null;
    const body = parsed as QwenErrorPayload | null;
    const upstreamMessage = body?.error?.message || body?.message;
    const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id");
    const message = describeQwenHttpError({
      status: response.status,
      type: body?.error?.type,
      message: upstreamMessage,
      requestId,
    }) ?? `Qwen API stream request failed with status ${response.status}`;
    throw new QwenApiError(message, {
      status: response.status,
      type: body?.error?.type,
      body: parsed ?? raw,
      requestId,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const line of event.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          const parsed = safeJsonParse(payload) as
            | {
                choices?: Array<{
                  delta?: {
                    content?: string | Array<{ text?: string } | { [key: string]: unknown }>;
                  };
                }>;
              }
            | null;
          const content = parsed?.choices?.[0]?.delta?.content;
          if (typeof content === "string" && content) {
            yield content;
          } else if (Array.isArray(content)) {
            const text = content
              .map((block) => ("text" in block && typeof block.text === "string" ? block.text : ""))
              .join("");
            if (text) yield text;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function toOpenAiCompatibleTool(tool: QwenTool) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.input_schema,
    },
  };
}

function toOpenAiCompatibleToolChoice(toolChoice: QwenToolChoice | undefined) {
  if (!toolChoice || toolChoice === "auto") return "auto";
  if (toolChoice === "none") return "none";
  return { type: "function", function: { name: toolChoice.name } };
}

function extractOpenAiTextBlocks(content: OpenAiCompatibleMessageContent): string[] {
  if (typeof content === "string") {
    return extractOpenAiToolUsesFromContent(content).length > 0 ? [] : [content].filter((text) => text.trim());
  }
  if (!Array.isArray(content)) return [];
  return content
    .map((block) => {
      if ("text" in block && typeof block.text === "string") return block.text;
      const record = block as Record<string, unknown>;
      if (typeof record.content === "string") return record.content;
      return "";
    })
    .filter((text) => text.trim());
}

function extractOpenAiToolCalls(toolCalls: OpenAiCompatibleToolCall[] | undefined): QwenToolUse[] {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.flatMap((call) => {
    const name = call.function?.name ?? call.name;
    if (!name) return [];
    return [
      {
        id: call.id,
        name,
        input: parseToolInput(call.function?.arguments ?? call.arguments ?? call.input),
      },
    ];
  });
}

function extractOpenAiToolUsesFromContent(content: unknown): QwenToolUse[] {
  if (Array.isArray(content)) {
    return content.flatMap((block) => extractOpenAiToolUsesFromContent(block));
  }
  if (!content || typeof content !== "object") {
    if (typeof content !== "string") return [];
    const parsed = safeJsonParse(content.trim());
    return parsed ? extractOpenAiToolUsesFromContent(parsed) : [];
  }

  const record = content as Record<string, unknown>;
  if (Array.isArray(record.tool_calls)) {
    return extractOpenAiToolCalls(record.tool_calls as OpenAiCompatibleToolCall[]);
  }
  const type = typeof record.type === "string" ? record.type : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;
  if ((type === "tool_use" || type === "function" || type === "function_call") && name) {
    return [
      {
        id: typeof record.id === "string" ? record.id : undefined,
        name,
        input: parseToolInput(record.input ?? record.arguments),
      },
    ];
  }
  return [];
}

function parseToolInput(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  const parsed = safeJsonParse(raw);
  return parsed ?? raw;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
