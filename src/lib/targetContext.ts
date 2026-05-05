import type { Message, TargetContext } from "@/lib/types";

export const DEFAULT_TARGET_CONTEXT: TargetContext = {
  role: "用户",
  tools: [],
  recentUse: "使用 AI 完成日常任务",
  goal: "提高效率，并获得更多 idea/思路/选择/灵感",
};

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function inferTargetContextFromMessages(messages: Message[]): TargetContext {
  const userText = compact(
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("；")
  );
  if (!userText) return DEFAULT_TARGET_CONTEXT;

  const roleMatch = userText.match(/(?:我是|职业是|身份是)?([^，。；,;]{2,12})(?:，|,|。|；|;|$)/);
  const role = compact(roleMatch?.[1] ?? "") || DEFAULT_TARGET_CONTEXT.role;
  const recentUse =
    compact(userText.match(/(?:用|使用|拿).{0,12}(?:AI|ai|GPT|gpt|Qwen|Cursor).{0,28}/)?.[0] ?? "") ||
    DEFAULT_TARGET_CONTEXT.recentUse;
  const goal =
    compact(
      userText.match(/(?:希望|想让|想用|目标|提升|完成).{0,42}/)?.[0] ?? ""
    ) || DEFAULT_TARGET_CONTEXT.goal;

  return {
    role,
    tools: [],
    recentUse,
    goal,
  };
}

export function normalizeTargetContext(value: unknown, fallback?: TargetContext): TargetContext {
  const base = fallback ?? DEFAULT_TARGET_CONTEXT;
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Record<keyof TargetContext, unknown>>;
  const role = typeof raw.role === "string" && raw.role.trim() ? raw.role.trim() : base.role;
  const tools = Array.isArray(raw.tools)
    ? raw.tools.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : base.tools ?? [];
  const recentUse =
    typeof raw.recentUse === "string" && raw.recentUse.trim()
      ? raw.recentUse.trim()
      : base.recentUse;
  const goal = typeof raw.goal === "string" && raw.goal.trim() ? raw.goal.trim() : base.goal;

  return { role, tools, recentUse, goal };
}
