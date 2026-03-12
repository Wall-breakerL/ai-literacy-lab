import type {
  UserProfile,
  ChatMessage,
  Scenario,
  EvalEventRecord,
  JudgeOutputRich,
  DimensionKey,
} from "../types";
import { DIMENSION_KEYS } from "../constants";
import { VERSION } from "../constants";

const DEFAULT_JUDGE_MODEL = "gpt-4o";

/** docs/07 §6：Judge prompt 必须写死的 5 条反偏差原则 */
const JUDGE_PRINCIPLES = `
你必须遵守以下原则（不可违反）：
1. 评分对象是**用户**，不是 assistant 的文采或表达。
2. 不要奖励单纯的长篇大论；证据与理由基于可观察行为。
3. 证据必须尽量来自**用户自己的话**或可观察行为。
4. 同一核心 rubric 适用于所有 profile；profile 只影响场景期待，不改变素养定义。
5. 若 assistant 输出很差，先判断用户是否有机会识别再决定是否扣用户分，不要直接扣用户分。
`;

/**
 * 构造 Judge 的 prompt 正文：包含 profile、scenarioId、hidden checks、transcript、event summary。
 */
export function buildJudgePrompt(
  profile: UserProfile,
  scenarioId: string,
  scenario: Scenario | null,
  messages: ChatMessage[],
  events: EvalEventRecord[]
): string {
  const hiddenChecks = scenario?.hiddenChecks?.length
    ? scenario.hiddenChecks.join("；")
    : "（无）";
  const transcript = messages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n");
  const eventSummary = events.length
    ? events.map((e) => e.event).join(", ")
    : "（无事件）";

  return `
## 用户画像
- role: ${profile.role}
- level: ${profile.level}

## 场景 ID
${scenarioId}

## 本场景隐性考察点 (hidden checks)
${hiddenChecks}

## 对话全文 (transcript)
${transcript}

## 事件摘要 (event summary，由规则从用户发言中识别)
${eventSummary}

## 五维定义与百分制（0-100）
- Clarity 说清任务：目标、约束、受众是否说清。权重 20%。
- Context 补足上下文：是否补充背景、前提、例子。权重 25%。
- Steering 推进对话：是否拉回、追问、引导。权重 20%。
- Judgment 判断结果：是否核实、比较、取舍，不照单全收。权重 20%。
- SafetyOwnership 守住边界并落地：敏感信息、权责、可执行落地。权重 15%。

每维 level 为 0-100 的整数（百分制）：0 完全缺失，20 很弱，40 较弱，60 基本可用，80 较强，100 非常成熟；可给中间值如 50、75 等。

${JUDGE_PRINCIPLES}

请仅根据**用户**行为，对五维各给出 0-100 的 level（整数），以及 evidence（用户原话或行为引用数组）、reason（一句话理由）；并给出 flags（异常标记数组，可为空）和 suggestions（面向用户的 1-3 条改进建议）。输出必须是且仅是符合下方 JSON schema 的合法 JSON，不要输出其他文字。
`;
}

/**
 * 返回 Judge 期望的 JSON schema 描述（用于 Structured Outputs 或 prompt 内说明）。
 */
export function getJudgeOutputSchemaHint(): string {
  return `
输出 JSON 结构（严格遵循）：
{
  "rubricVersion": "1.0",
  "scenarioId": "<string>",
  "profile": { "role": "student|general", "level": "novice|intermediate" },
  "dimensions": {
    "clarity": { "level": 0-100, "evidence": ["<用户原话或行为>"], "reason": "<一句话>" },
    "context": { "level": 0-100, "evidence": [], "reason": "" },
    "steering": { "level": 0-100, "evidence": [], "reason": "" },
    "judgment": { "level": 0-100, "evidence": [], "reason": "" },
    "safetyOwnership": { "level": 0-100, "evidence": [], "reason": "" }
  },
  "flags": [],
  "suggestions": ["<建议1>", "<建议2>"]
}
`;
}

/**
 * 从 LLM 返回的字符串中提取 JSON（可能被 markdown 或前后文包裹）。
 */
function extractJsonFromContent(content: string): unknown | null {
  const s = content.trim();
  try {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      return JSON.parse(s.slice(first, last + 1));
    }
    const codeBlock = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
    if (codeBlock) {
      return JSON.parse(codeBlock[1].trim());
    }
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * 校验并解析为 JudgeOutputRich；不合法返回 null。profile 可从响应缺失时用 fallbackProfile。
 */
export function parseJudgeOutputRich(
  raw: unknown,
  fallbackProfile?: UserProfile
): JudgeOutputRich | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const rubricVersion = typeof o.rubricVersion === "string" ? o.rubricVersion : VERSION.rubricVersion;
  const scenarioId = typeof o.scenarioId === "string" ? o.scenarioId : "";
  let profile = o.profile as UserProfile | undefined;
  if (!profile || typeof profile.role !== "string" || typeof profile.level !== "string") {
    profile = fallbackProfile;
  }
  if (!profile) return null;

  const dimensions = o.dimensions as Record<string, unknown> | undefined;
  if (!dimensions || typeof dimensions !== "object") return null;

  const result: Record<string, { level: number; evidence: string[]; reason: string }> = {};
  for (const k of DIMENSION_KEYS) {
    const d = dimensions[k] ?? dimensions[k === "safetyOwnership" ? "safety" : ""];
    if (!d || typeof d !== "object") return null;
    const dd = d as Record<string, unknown>;
    const level = Number(dd.level);
    if (Number.isNaN(level) || level < 0 || level > 100) return null;
    const levelClamped = Math.round(Math.min(100, Math.max(0, level)));
    const evidence = Array.isArray(dd.evidence)
      ? (dd.evidence as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];
    const reason = typeof dd.reason === "string" ? dd.reason : "";
    result[k] = { level: levelClamped, evidence, reason };
  }

  const flags = Array.isArray(o.flags) ? (o.flags as unknown[]).map((x) => String(x)) : [];
  const suggestions = Array.isArray(o.suggestions)
    ? (o.suggestions as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];

  return {
    rubricVersion,
    scenarioId,
    profile,
    dimensions: result as JudgeOutputRich["dimensions"],
    flags,
    suggestions,
  };
}

/**
 * 调用外部 Judge API，返回富结构；失败或未配置 key 时返回 null。
 * 外部 API 调用由你在此函数内实现。
 */
export async function callJudgeApi(
  sessionId: string,
  scenarioId: string,
  profile: UserProfile,
  scenario: Scenario | null,
  messages: ChatMessage[],
  events: EvalEventRecord[]
): Promise<JudgeOutputRich | null> {
  const apiKey = process.env.OPENAI_JUDGE_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;

  const userContent =
    buildJudgePrompt(profile, scenarioId, scenario, messages, events) +
    getJudgeOutputSchemaHint();

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: userContent }],
      max_tokens: 2048,
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
    const data = (await res.json()) as Record<string, unknown>;
    if (process.env.DEBUG_JUDGE === "1") {
      if (!res.ok) {
        console.error("[Judge] API not ok:", res.status, JSON.stringify(data).slice(0, 500));
      } else if (!data?.choices?.[0]) {
        console.error("[Judge] No choices in response:", Object.keys(data || {}));
      }
    }
    if (!res.ok) return null;
    const content = data?.choices?.[0] as Record<string, unknown> | undefined;
    const text = content?.message as Record<string, unknown> | undefined;
    const rawContent = text?.content;
    const contentStr = typeof rawContent === "string" ? rawContent : null;
    if (!contentStr) return null;
    let parsed: unknown = extractJsonFromContent(contentStr);
    if (parsed === null) {
      try {
        parsed = JSON.parse(contentStr);
      } catch {
        return null;
      }
    }
    return parseJudgeOutputRich(parsed, profile);
  } catch (e) {
    if (process.env.DEBUG_JUDGE === "1") {
      console.error("[Judge] Error:", e instanceof Error ? e.message : e);
    }
    return null;
  }
}
