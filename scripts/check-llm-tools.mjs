#!/usr/bin/env node
/**
 * OpenAI-compatible LLM tool-call validation script.
 *
 * Usage: node scripts/check-llm-tools.mjs
 * Requires: .env.local with LLM_BASE_URL / LLM_API_KEY or OPENAI_COMPATIBLE_*.
 */

import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const override = process.env.OVERRIDE_ENV_FILE === "1";
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
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
  return true;
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

function validateToolInput(input) {
  const categories = new Set(["speed", "quality", "ui"]);
  return (
    input &&
    typeof input === "object" &&
    categories.has(input.category) &&
    typeof input.summary === "string" &&
    input.summary.trim().length > 0
  );
}

function mergeOpenAiCompatibleChatBody(openAiBaseUrl, base) {
  const body = { ...base };
  const u = (openAiBaseUrl || "").toLowerCase();
  if (
    (u.includes("dashscope.aliyuncs.com") || u.includes("dashscope-intl.aliyuncs.com")) &&
    process.env.OPENAI_COMPATIBLE_ENABLE_THINKING?.trim() !== "1"
  ) {
    body.enable_thinking = false;
  }
  const extra = process.env.OPENAI_COMPATIBLE_EXTRA_JSON?.trim();
  if (!extra) return body;
  try {
    const parsed = JSON.parse(extra);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...body, ...parsed };
    }
  } catch {
    /* ignore invalid optional JSON */
  }
  return body;
}

loadEnvFile(".env.local");

const baseUrl = (
  process.env.LLM_BASE_URL ||
  process.env.DEEPSEEK_BASE_URL ||
  process.env.OPENAI_COMPATIBLE_BASE_URL ||
  "https://api.openai.com/v1"
).replace(/\/$/, "");
const apiKey = (
  process.env.LLM_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  process.env.OPENAI_COMPATIBLE_API_KEY ||
  ""
).trim();
const model =
  process.env.LLM_RESEARCHER_MODEL?.trim() ||
  process.env.DEEPSEEK_MODEL?.trim() ||
  process.env.QWEN_MODEL?.trim() ||
  "qwen3.6-plus";
const forcedTemperature = parseOptionalNumber(process.env.OPENAI_COMPATIBLE_FORCE_TEMPERATURE);

console.log("OpenAI-compatible LLM tool-call check");
console.log({
  envFile: existsSync(".env.local") ? ".env.local" : "missing",
  baseUrl,
  keyPresent: Boolean(apiKey),
  keyLength: apiKey.length,
  model,
  forcedTemperature,
});

if (!apiKey) {
  console.error("Missing LLM_API_KEY / DEEPSEEK_API_KEY / OPENAI_COMPATIBLE_API_KEY.");
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

const response = await requestJson(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(
    mergeOpenAiCompatibleChatBody(baseUrl, {
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
    })
  ),
});

if (!response.ok) {
  console.error("Tool-call request: FAIL", summarizeError(response.status, response.body, response.requestId));
  process.exit(1);
}

const toolUses = parseOpenAiToolCalls(response.body?.choices?.[0]?.message);

console.log("Tool-call response: OK", {
  status: response.status,
  finishReason: response.body?.choices?.[0]?.finish_reason,
  toolUseCount: toolUses.length,
  toolUses: toolUses.map((toolUse) => ({
    name: toolUse.name,
    inputKeys: toolUse.input && typeof toolUse.input === "object" ? Object.keys(toolUse.input) : [],
  })),
});

const matchingToolUse = toolUses.find((toolUse) => toolUse.name === toolName);
if (!matchingToolUse) {
  console.error(`Tool-call check failed: expected ${toolName} tool use.`);
  process.exit(1);
}

if (!validateToolInput(matchingToolUse.input)) {
  console.error(`Tool-call check failed: ${toolName} input did not match the expected schema.`, matchingToolUse.input);
  process.exit(1);
}

console.log("OpenAI-compatible LLM tool-call check passed.");
