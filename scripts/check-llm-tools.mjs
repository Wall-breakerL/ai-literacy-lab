import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const lines = readFileSync(filePath, "utf8").split(/\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

function normalizeProvider(raw) {
  const value = raw?.trim().toLowerCase();
  if (value === "openai" || value === "openai-compatible" || value === "openai_compatible") {
    return "openai-compatible";
  }
  return "anthropic";
}

function parseOptionalNumber(raw) {
  if (raw == null || raw.trim() === "") return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function summarizeError(status, body, requestId) {
  return {
    status,
    type: body?.error?.type ?? body?.type,
    message: body?.error?.message ?? body?.message ?? String(body ?? ""),
    requestId,
  };
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? safeJsonParse(text) ?? text : null;
  return {
    ok: response.ok,
    status: response.status,
    requestId: response.headers.get("x-request-id") ?? response.headers.get("request-id"),
    body,
  };
}

function parseOpenAiToolCalls(message) {
  const direct = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const fromContent = (() => {
    if (typeof message?.content !== "string") return [];
    const parsed = safeJsonParse(message.content.trim());
    return Array.isArray(parsed?.tool_calls) ? parsed.tool_calls : [];
  })();
  return [...direct, ...fromContent].flatMap((call) => {
    const name = call?.function?.name ?? call?.name;
    const rawArgs = call?.function?.arguments ?? call?.arguments ?? call?.input;
    if (!name) return [];
    return [{ name, input: typeof rawArgs === "string" ? safeJsonParse(rawArgs) ?? rawArgs : rawArgs }];
  });
}

function parseAnthropicToolUses(body) {
  return Array.isArray(body?.content)
    ? body.content
        .filter((block) => block?.type === "tool_use" && typeof block.name === "string")
        .map((block) => ({ name: block.name, input: block.input }))
    : [];
}

loadEnvFile(".env.local");

const provider = normalizeProvider(process.env.LLM_PROVIDER);
const baseUrl =
  provider === "openai-compatible"
    ? (process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
    : (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1").replace(/\/$/, "");
const apiKey =
  provider === "openai-compatible"
    ? (process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY || "").trim()
    : process.env.ANTHROPIC_API_KEY?.trim() ?? "";
const version = process.env.ANTHROPIC_VERSION?.trim() || "2023-06-01";
const model = process.env.CLAUDE_RESEARCHER_MODEL?.trim() || process.env.CLAUDE_AGENT_B_MODEL?.trim() || "claude-opus-4-6";
const forcedTemperature = parseOptionalNumber(process.env.OPENAI_COMPATIBLE_FORCE_TEMPERATURE);

console.log("LLM tool-call check");
console.log({
  envFile: existsSync(".env.local") ? ".env.local" : "missing",
  provider,
  baseUrl,
  version: provider === "anthropic" ? version : undefined,
  keyPresent: Boolean(apiKey),
  keyLength: apiKey.length,
  model,
  forcedTemperature: provider === "openai-compatible" ? forcedTemperature : undefined,
});

if (!apiKey) {
  console.error(provider === "openai-compatible" ? "Missing OPENAI_COMPATIBLE_API_KEY." : "Missing ANTHROPIC_API_KEY.");
  process.exit(1);
}

const toolName = "capture_feedback";
const inputSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: ["speed", "quality", "ui"] },
    summary: { type: "string" },
  },
  required: ["category", "summary"],
  additionalProperties: false,
};

const response =
  provider === "openai-compatible"
    ? await requestJson(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 256,
          temperature: forcedTemperature ?? 0.2,
          messages: [
            {
              role: "user",
              content: "Use the tool to record this feedback: the report is useful but too generic.",
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: toolName,
                description: "Capture a short structured feedback object.",
                parameters: inputSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: toolName } },
        }),
      })
    : await requestJson(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": version,
        },
        body: JSON.stringify({
          model,
          max_tokens: 256,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: "Use the tool to record this feedback: the report is useful but too generic.",
            },
          ],
          tools: [
            {
              name: toolName,
              description: "Capture a short structured feedback object.",
              input_schema: inputSchema,
            },
          ],
          tool_choice: { type: "tool", name: toolName },
        }),
      });

if (!response.ok) {
  console.error("Tool-call request: FAIL", summarizeError(response.status, response.body, response.requestId));
  process.exit(1);
}

const toolUses =
  provider === "openai-compatible"
    ? parseOpenAiToolCalls(response.body?.choices?.[0]?.message)
    : parseAnthropicToolUses(response.body);

console.log("Tool-call response: OK", {
  status: response.status,
  finishReason:
    provider === "openai-compatible"
      ? response.body?.choices?.[0]?.finish_reason
      : response.body?.stop_reason,
  toolUseCount: toolUses.length,
  toolUses: toolUses.map((toolUse) => ({
    name: toolUse.name,
    inputKeys: toolUse.input && typeof toolUse.input === "object" ? Object.keys(toolUse.input) : [],
  })),
});

if (!toolUses.some((toolUse) => toolUse.name === toolName)) {
  console.error(`Tool-call check failed: expected ${toolName} tool use.`);
  process.exit(1);
}

console.log("LLM tool-call check passed.");
