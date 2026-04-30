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

function summarizeError(status, body, requestId) {
  const type = body?.error?.type ?? body?.type;
  const message = body?.error?.message ?? body?.message ?? String(body ?? "");
  const hint = (() => {
    if (status === 401) return "检查 ANTHROPIC_API_KEY 是否有效、是否完整复制。";
    if (status === 403) {
      return "这不是单个模型的问题。请检查 Anthropic 账号/组织权限、计费/余额、地域或网络访问限制；如果使用代理网关，确认它兼容 Anthropic Messages API。";
    }
    if (status === 404) return "检查模型 ID、base URL 和 API 路径。";
    if (status === 429) return "触发限流，稍后重试或检查账号 rate limit。";
    if (status === 529) return "Anthropic 侧过载，稍后重试。";
    if (status >= 500) return "Anthropic 服务端错误或网络网关错误，稍后重试。";
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
    requestId: response.headers.get("request-id"),
    body,
  };
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
const models = [
  ["Researcher", process.env.CLAUDE_RESEARCHER_MODEL?.trim() || process.env.CLAUDE_AGENT_B_MODEL?.trim() || "claude-opus-4-6"],
  ["Researcher fallback", process.env.CLAUDE_RESEARCHER_FALLBACK_MODEL?.trim() || process.env.CLAUDE_AGENT_B_MODEL?.trim() || process.env.CLAUDE_RESEARCHER_MODEL?.trim() || "claude-opus-4-6"],
];
const forcedTemperature = parseOptionalNumber(process.env.OPENAI_COMPATIBLE_FORCE_TEMPERATURE);

console.log("LLM API check");
console.log({
  envFile: existsSync(".env.local") ? ".env.local" : "missing",
  provider,
  baseUrl,
  version: provider === "anthropic" ? version : undefined,
  keyPresent: Boolean(apiKey),
  keyLength: apiKey.length,
  models: Object.fromEntries(models),
  forcedTemperature: provider === "openai-compatible" ? forcedTemperature : undefined,
});

if (!apiKey) {
  console.error(provider === "openai-compatible" ? "Missing OPENAI_COMPATIBLE_API_KEY." : "Missing ANTHROPIC_API_KEY.");
  process.exit(1);
}

const headers = provider === "openai-compatible"
  ? {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    }
  : {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": version,
    };

let failures = 0;

const modelsResponse = await requestJson(`${baseUrl}/models?limit=20`, { headers });
if (modelsResponse.ok) {
  const ids = Array.isArray(modelsResponse.body?.data)
    ? modelsResponse.body.data.map((model) => model.id).slice(0, 20)
    : [];
  console.log("Models API: OK", ids);
} else {
  failures += 1;
  console.error("Models API: FAIL", summarizeError(modelsResponse.status, modelsResponse.body, modelsResponse.requestId));
}

for (const [label, model] of models) {
  const response = await requestJson(
    provider === "openai-compatible" ? `${baseUrl}/chat/completions` : `${baseUrl}/messages`,
    {
    method: "POST",
    headers,
      body: JSON.stringify(
        provider === "openai-compatible"
          ? {
              model,
              max_tokens: 16,
              temperature: forcedTemperature ?? 0,
              messages: [{ role: "user", content: "Reply with OK only." }],
            }
          : {
              model,
              max_tokens: 16,
              messages: [{ role: "user", content: "Reply with OK only." }],
            }
      ),
    }
  );

  if (response.ok) {
    const text = provider === "openai-compatible"
      ? response.body?.choices?.[0]?.message?.content
      : response.body?.content
          ?.filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();
    console.log(`${label} (${model}): OK`, text);
  } else {
    failures += 1;
    console.error(`${label} (${model}): FAIL`, summarizeError(response.status, response.body, response.requestId));
  }
}

if (failures > 0) {
  console.error(`Claude API check failed: ${failures} failed request(s).`);
  process.exit(1);
}

console.log("LLM API check passed.");

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
