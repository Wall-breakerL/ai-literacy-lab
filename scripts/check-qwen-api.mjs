#!/usr/bin/env node
/**
 * Qwen API connectivity and model validation script.
 *
 * Usage: node scripts/check-qwen-api.mjs
 * Requires: .env.local with OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY.
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

function summarizeError(status, body, requestId) {
  const type = body?.error?.type ?? body?.type;
  const message = body?.error?.message ?? body?.message ?? String(body ?? "");
  const hint = (() => {
    if (status === 401) return "检查 OPENAI_COMPATIBLE_API_KEY 是否有效、是否完整复制。";
    if (status === 403) return "检查账号权限、计费/余额、地域限制或网关访问策略。";
    if (status === 404) return "检查模型 ID、base URL 和 API 路径。";
    if (status === 429) return "触发限流，稍后重试或检查账号 rate limit。";
    if (status >= 500) return "Qwen 网关或上游服务端错误，稍后重试。";
    return "查看上游错误信息。";
  })();
  return { status, type, message, requestId, hint };
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    ok: response.ok,
    status: response.status,
    requestId: response.headers.get("x-request-id") ?? response.headers.get("request-id"),
    body,
  };
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

function parseOptionalNumber(raw) {
  if (raw == null || raw.trim() === "") return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

loadEnvFile(".env.local");

const baseUrl = (process.env.OPENAI_COMPATIBLE_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const apiKey = (process.env.OPENAI_COMPATIBLE_API_KEY || "").trim();
const models = [
  ["Qwen model", process.env.QWEN_MODEL?.trim() || "qwen3.6-plus"],
  ["Qwen fallback", process.env.QWEN_FALLBACK_MODEL?.trim() || process.env.QWEN_MODEL?.trim() || "qwen3.6-plus"],
];
const forcedTemperature = parseOptionalNumber(process.env.OPENAI_COMPATIBLE_FORCE_TEMPERATURE);
const strictModelsCheck = process.env.STRICT_MODELS_CHECK === "1";

console.log("Qwen API check");
console.log({
  envFile: existsSync(".env.local") ? ".env.local" : "missing",
  baseUrl,
  keyPresent: Boolean(apiKey),
  keyLength: apiKey.length,
  models: Object.fromEntries(models),
  forcedTemperature,
});

if (!apiKey) {
  console.error("Missing OPENAI_COMPATIBLE_API_KEY.");
  process.exit(1);
}

const headers = {
  "content-type": "application/json",
  authorization: `Bearer ${apiKey}`,
};

let failures = 0;

const modelsResponse = await requestJson(`${baseUrl}/models?limit=20`, { headers });
if (modelsResponse.ok) {
  const ids = Array.isArray(modelsResponse.body?.data)
    ? modelsResponse.body.data.map((model) => model.id).slice(0, 20)
    : [];
  console.log("Models API: OK", ids);
} else if (!strictModelsCheck) {
  console.warn("Models API: SKIP", summarizeError(modelsResponse.status, modelsResponse.body, modelsResponse.requestId));
} else {
  failures += 1;
  console.error("Models API: FAIL", summarizeError(modelsResponse.status, modelsResponse.body, modelsResponse.requestId));
}

for (const [label, model] of models) {
  const response = await requestJson(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      mergeOpenAiCompatibleChatBody(baseUrl, {
        model,
        max_tokens: 16,
        temperature: forcedTemperature ?? 0,
        messages: [{ role: "user", content: "Reply with OK only." }],
      })
    ),
  });

  if (response.ok) {
    const text = response.body?.choices?.[0]?.message?.content;
    console.log(`${label} (${model}): OK`, text);
  } else {
    failures += 1;
    console.error(`${label} (${model}): FAIL`, summarizeError(response.status, response.body, response.requestId));
  }
}

if (failures > 0) {
  console.error(`Qwen API check failed: ${failures} failed request(s).`);
  process.exit(1);
}

console.log("Qwen API check passed.");
