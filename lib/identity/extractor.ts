import type { IdentityStructuredSummary } from "./types";

const EXTRACT_SYSTEM = `你是一个身份信息结构化提取器。根据用户提供的被测者身份描述，提取出以下 JSON 结构（可不填的字段传空字符串或空数组，不要编造信息）：

{
  "roleContext": "角色与情境——被测者的身份、当前处境、身份背景",
  "domain": "领域——被测者在哪个领域或场景下与 AI 协作",
  "goals": ["目标——被测者在当前任务中想达成的结果，可多行"],
  "constraints": ["约束——对 AI 输出风格、格式、语气的要求，可多行"],
  "communicationStyle": "沟通风格——被测者偏好的沟通方式（正式/随意/简洁/详细等）",
  "aiFamiliarity": "对 AI 的熟悉度——被测者对 AI 工具的使用经验（新手/一般/熟练）",
  "riskSensitivity": "风险敏感度——被测者对隐私、责任、风险边界问题的关注程度（低/中/高）
}

输出要求：
- 仅输出合法 JSON，不要有其他文字
- goals 和 constraints 必须是字符串数组，无则空数组 []
- 其余字段为字符串，空则 ""
- 不要编造原文未提到的信息，无法确定的字段填空或空数组`;

const EXTRACT_MODEL = "gpt-4o-mini";

function extractPartial(text: string): Partial<IdentityStructuredSummary> {
  const result: Partial<IdentityStructuredSummary> = {};
  let s = text.trim();

  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(s) as Record<string, unknown>;
    if (typeof parsed.roleContext === "string") result.roleContext = parsed.roleContext;
    if (typeof parsed.domain === "string") result.domain = parsed.domain;
    if (Array.isArray(parsed.goals)) result.goals = parsed.goals.map(String);
    if (Array.isArray(parsed.constraints)) result.constraints = parsed.constraints.map(String);
    if (typeof parsed.communicationStyle === "string") result.communicationStyle = parsed.communicationStyle;
    if (typeof parsed.aiFamiliarity === "string") result.aiFamiliarity = parsed.aiFamiliarity;
    if (typeof parsed.riskSensitivity === "string") result.riskSensitivity = parsed.riskSensitivity;
  } catch {
    // fallthrough — return empty result
  }
  return result;
}

/**
 * 将自由文本 Prompt 提取为 IdentityStructuredSummary。
 * 失败时返回空对象，不阻断流程。
 */
export async function extractIdentitySummary(
  prompt: string
): Promise<Partial<IdentityStructuredSummary>> {
  if (!prompt.trim()) return {};

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return {};

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_CHAT_MODEL ?? EXTRACT_MODEL;

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: prompt },
      ],
      max_tokens: 512,
    };
    if (!baseUrl.includes("minimax")) {
      body.response_format = { type: "json_object" };
    }
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return {};
    return extractPartial(content);
  } catch {
    return {};
  }
}
