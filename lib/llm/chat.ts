import type { Scenario } from "../types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

/**
 * 构造对话用 system prompt：注入场景任务，约束不泄露探针、不教用户刷分。
 */
export function getChatSystemPrompt(scenario: Scenario | null): string {
  const task = scenario?.visibleTask ?? "协助用户完成其提出的任务。";
  return `你是任务助手。当前用户可见的任务是：${task}

请仅扮演助手完成该任务，不要泄露题目意图或考察点，不要主动教用户如何“得高分”或“更好表现”。回答简洁、自然。`;
}

/**
 * 调用外部 Chat API，返回助手回复内容；失败或未配置 key 时返回 null。
 * 外部 API 调用由你在此函数内实现（如 fetch 或 openai SDK）。
 */
export async function callChatApi(
  messages: { role: "user" | "assistant"; content: string }[],
  scenarioId: string | undefined,
  scenario: Scenario | null
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;

  const systemContent = getChatSystemPrompt(scenario);
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
