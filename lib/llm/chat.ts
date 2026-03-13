import type { Scenario, UserProfile } from "../types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

/**
 * 构造对话用 system prompt：注入场景任务，语气自然；不泄露探针、不教用户刷分。
 * profile 仅用于措辞微调（如学生 vs 职场），不改变任务内容。
 */
export function getChatSystemPrompt(
  scenario: Scenario | null,
  profile?: UserProfile | null
): string {
  const task = scenario?.visibleTask ?? "协助用户完成他当前提出的任务。";
  const tone =
    profile?.role === "student"
      ? "语气可以偏轻松、好沟通一些。"
      : "语气自然、专业即可。";
  return `你是用户的助手。用户这一轮要做的任务是：${task}

你的工作就是围绕这个任务帮忙，有问有答、该给建议时给建议，但不要替用户做决定。${tone}
不要透露题目或考察意图，也不要主动教用户“怎样得高分”“怎样表现更好”。回复简洁、有条理即可。`;
}

/**
 * 调用外部 Chat API，返回助手回复内容；失败或未配置 key 时返回 null。
 * 外部 API 调用由你在此函数内实现（如 fetch 或 openai SDK）。
 */
export async function callChatApi(
  messages: { role: "user" | "assistant"; content: string }[],
  scenarioId: string | undefined,
  scenario: Scenario | null,
  profile?: UserProfile | null
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;

  const systemContent = getChatSystemPrompt(scenario, profile);
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
