import type { GoalStatus, GoalType, Message, TargetContext } from "@/lib/types";

export const DEFAULT_TARGET_CONTEXT: TargetContext = {
  role: "用户",
  recentUse: "使用 AI 完成日常任务",
  goal: "更有效地使用 AI",
  goalStatus: "missing",
  goalType: "other",
};

const GOAL_TYPE_KEYWORDS: Array<{ type: GoalType; keywords: string[] }> = [
  { type: "product_building", keywords: ["产品", "用户", "需求", "原型", "prd", "商业化"] },
  { type: "research_writing", keywords: ["科研", "论文", "文献", "报告", "课题", "基金", "研究"] },
  { type: "learning", keywords: ["学习", "课程", "考试", "理解", "知识", "教学"] },
  { type: "coding_system", keywords: ["代码", "coding", "系统", "开发", "工程", "架构", "cursor"] },
  { type: "business_decision", keywords: ["决策", "战略", "业务", "市场", "运营", "管理"] },
  { type: "daily_efficiency", keywords: ["效率", "整理", "总结", "邮件", "重复", "日常"] },
  { type: "creative_work", keywords: ["创意", "设计", "内容", "写作", "视频", "海报"] },
];

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function inferGoalType(text: string): GoalType {
  const lower = text.toLowerCase();
  return GOAL_TYPE_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
  )?.type ?? "other";
}

function inferGoalStatus(goal: string): GoalStatus {
  const clean = compact(goal);
  if (!clean || clean === DEFAULT_TARGET_CONTEXT.goal) return "missing";
  if (clean.length <= 6 || /效率|更好|提升|帮助|改进/.test(clean)) return "generic";
  return "specific";
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
    recentUse,
    goal,
    goalStatus: inferGoalStatus(goal),
    goalType: inferGoalType(`${role} ${recentUse} ${goal}`),
  };
}

export function normalizeTargetContext(value: unknown, fallback?: TargetContext): TargetContext {
  const base = fallback ?? DEFAULT_TARGET_CONTEXT;
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Record<keyof TargetContext, unknown>>;
  const role = typeof raw.role === "string" && raw.role.trim() ? raw.role.trim() : base.role;
  const recentUse =
    typeof raw.recentUse === "string" && raw.recentUse.trim()
      ? raw.recentUse.trim()
      : base.recentUse;
  const goal = typeof raw.goal === "string" && raw.goal.trim() ? raw.goal.trim() : base.goal;
  const goalStatus: GoalStatus =
    raw.goalStatus === "specific" || raw.goalStatus === "generic" || raw.goalStatus === "missing"
      ? raw.goalStatus
      : inferGoalStatus(goal);
  const inferredType = inferGoalType(`${role} ${recentUse} ${goal}`);
  const goalType: GoalType =
    raw.goalType === "product_building" ||
    raw.goalType === "research_writing" ||
    raw.goalType === "learning" ||
    raw.goalType === "coding_system" ||
    raw.goalType === "business_decision" ||
    raw.goalType === "daily_efficiency" ||
    raw.goalType === "creative_work" ||
    raw.goalType === "other"
      ? raw.goalType
      : inferredType;

  return { role, recentUse, goal, goalStatus, goalType };
}
