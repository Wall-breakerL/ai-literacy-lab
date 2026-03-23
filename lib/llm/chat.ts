import type { ScenarioBlueprint } from "../scenario-v2/types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

const TONE = "语气自然、专业、好沟通即可。";

/**
 * 构造对话用 system prompt：v2 blueprint；不泄露探针、不教刷分。
 */
export function buildChatSystemPrompt(params: {
  blueprint: ScenarioBlueprint | null;
  identityCompiledPrompt?: string | null;
}): string {
  const identityBlock = params.identityCompiledPrompt?.trim()
    ? `${params.identityCompiledPrompt.trim()}\n\n`
    : "";

  if (params.blueprint) {
    const b = params.blueprint;
    return `${identityBlock}${b.assistantRolePrompt}

【情境与角色背景（仅供你把握语气与事实，不要逐字复述给用户）】
${b.worldState}

系统已用你的身份发送第一条开场消息；请从后续回合起在同一角色下自然延续。不要提及评估、探针、隐藏目的或「本题」。${TONE}
不要替用户单方面做决定；可给选项、利弊与需要对方确认的问题。回复简洁有条理。`;
  }

  return `${identityBlock}你是用户的助手。请根据用户消息自然协作。${TONE}
不要透露题目或考察意图，也不要主动教用户“怎样得高分”“怎样表现更好”。回复简洁、有条理即可。`;
}

/**
 * 调用外部 Chat API，返回助手回复内容；失败或未配置 key 时返回 null。
 */
export async function callChatApi(
  messages: { role: "user" | "assistant"; content: string }[],
  scenarioId: string | undefined,
  options?: {
    blueprint?: ScenarioBlueprint | null;
    identityCompiledPrompt?: string | null;
  }
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;

  const systemContent = buildChatSystemPrompt({
    blueprint: options?.blueprint ?? null,
    identityCompiledPrompt: options?.identityCompiledPrompt ?? null,
  });
  const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemContent },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages: apiMessages, max_tokens: 1024 }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    const content = data?.choices?.[0]?.message?.content?.trim?.();
    return content ?? null;
  } catch {
    return null;
  }
}
