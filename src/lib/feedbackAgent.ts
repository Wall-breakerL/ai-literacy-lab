import { cacheSystemPrompt, type ClaudeTool, type ClaudeToolUse } from "@/lib/claude";
import type {
  FeedbackChatResponse,
  FeedbackContext,
  FeedbackDialogueAction,
  FeedbackDialogueMessage,
  FeedbackPriority,
  FeedbackSentiment,
  FeedbackType,
  StructuredFeedback,
} from "@/lib/types";

const FEEDBACK_TYPES: FeedbackType[] = [
  "question_issue",
  "report_issue",
  "prompt_template",
  "flow_issue",
  "positive_signal",
];
const SENTIMENTS: FeedbackSentiment[] = ["positive", "mixed", "negative"];
const PRIORITIES: FeedbackPriority[] = ["low", "medium", "high"];
const ACTIONS: FeedbackDialogueAction[] = ["ask_followup", "ready_to_save"];

export const FEEDBACK_AGENT_SYSTEM = cacheSystemPrompt(`你是 AI-MBTI 产品反馈研究员，负责和用户做 1-2 轮报告反馈访谈，并把反馈整理成可用于改进题目、prompt 和报告结构的产品信息。

## 目标

- 不做客服式安抚，不为报告辩解。
- 先理解用户真实感受，再整理成结构化反馈。
- 最多追问一次。用户已经回答两次后，无论信息是否完整，都必须整理。

## 对话规则

1. 如果还没有用户反馈，输出一条开放式问题，询问报告哪些部分有用、哪些不准或空泛、题目是否贴近真实场景。
2. 如果用户只说“还行 / 一般 / 不准 / 说不清楚”等低信息内容，且还没有追问过，可以追问一次具体例子。
3. 如果用户已经给出具体反馈，或用户已回答两轮，必须整理，不要继续追问。
4. 输出给用户的话要自然、短，不要出现 JSON、Markdown 或列表。

## 结构化整理要求

- summary 写成 1-2 句产品反馈摘要。
- usefulParts 记录报告中有价值的部分。
- inaccurateParts 记录用户认为不准、空泛、误解的部分。
- questionIssues 记录题目不贴、太抽象、太具体、难回答等问题。
- reportIssues 记录报告结构、语气、建议、prompt 模板、协作宣言的问题。
- improvementSuggestions 写成可以直接进入下一轮改版的建议。
- sentiment 反映整体态度：positive / mixed / negative。
- priority 反映改进优先级：high 表示影响核心可信度或可用性。
- feedbackTypes 从 question_issue / report_issue / prompt_template / flow_issue / positive_signal 中选择。`);

export const FEEDBACK_DIALOGUE_TOOL: ClaudeTool = {
  name: "analyze_ai_mbti_feedback",
  description: "Continue or finalize an AI-MBTI report feedback dialogue.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ACTIONS },
      assistantMessage: { type: "string" },
      summary: { type: "string" },
      usefulParts: { type: "array", items: { type: "string" } },
      inaccurateParts: { type: "array", items: { type: "string" } },
      questionIssues: { type: "array", items: { type: "string" } },
      reportIssues: { type: "array", items: { type: "string" } },
      improvementSuggestions: { type: "array", items: { type: "string" } },
      sentiment: { type: "string", enum: SENTIMENTS },
      priority: { type: "string", enum: PRIORITIES },
      feedbackTypes: { type: "array", items: { type: "string", enum: FEEDBACK_TYPES } },
    },
    required: [
      "action",
      "assistantMessage",
      "summary",
      "usefulParts",
      "inaccurateParts",
      "questionIssues",
      "reportIssues",
      "improvementSuggestions",
      "sentiment",
      "priority",
      "feedbackTypes",
    ],
    additionalProperties: false,
  },
};

export function buildFeedbackDialoguePrompt({
  context,
  messages,
}: {
  context: FeedbackContext;
  messages: FeedbackDialogueMessage[];
}): string {
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const history = messages
    .map((message) => `${message.role === "assistant" ? "反馈研究员" : "用户"}：${message.content}`)
    .join("\n");

  return `【AI-MBTI 报告反馈访谈】

【用户与报告上下文】
sessionId: ${context.sessionId}
identity: ${context.identity ?? "用户"}
personality: ${context.personalityCode ?? "unknown"} ${context.personalityName ?? ""}
role: ${context.role}
recentUse: ${context.recentUse}
goal: ${context.goal}
questions: ${context.answeredQuestions}/${context.totalQuestions}, skipRate=${Math.round(context.skipRate * 100)}%
reportSummary: ${context.reportSummary ?? "（暂无）"}
reportTags: ${(context.reportTags ?? []).join("、") || "（暂无）"}
manifesto: ${context.collaborationManifesto ?? "（暂无）"}
promptTemplates: ${(context.promptTemplateTitles ?? []).join("、") || "（暂无）"}

【反馈对话记录】
${history || "（尚未开始）"}

【本轮约束】
- 用户反馈轮数：${userMessageCount}
- 如果用户反馈轮数为 0：action 必须为 ask_followup，assistantMessage 只问一个开放式问题。
- 如果用户反馈轮数为 1：如果内容具体，可以 ready_to_save；如果内容很笼统，可以 ask_followup，但只能追问一次。
- 如果用户反馈轮数 >= 2：action 必须为 ready_to_save，不要继续追问。
- ready_to_save 时，assistantMessage 用一句话告诉用户“我已经整理好了，会记录下来帮助改进题目和报告”这类自然表达。
- ask_followup 时，summary 和各数组可以为空字符串/空数组，但 sentiment、priority、feedbackTypes 仍要给保守值。`;
}

export function feedbackChatResponseFromToolUses({
  toolUses,
  context,
  messages,
  model,
}: {
  toolUses: ClaudeToolUse[];
  context: FeedbackContext;
  messages: FeedbackDialogueMessage[];
  model: string;
}): FeedbackChatResponse | null {
  const toolUse = toolUses.find((item) => item.name === FEEDBACK_DIALOGUE_TOOL.name);
  if (!toolUse || !toolUse.input || typeof toolUse.input !== "object") return null;
  const input = toolUse.input as Record<string, unknown>;
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const hasAskedFollowup = messages.some((message) => message.role === "assistant");
  let action = parseEnum(input.action, ACTIONS, "ask_followup");
  let assistantMessage = cleanText(input.assistantMessage, 500);
  if (action === "ask_followup" && (hasAskedFollowup || userMessageCount >= 2)) {
    action = "ready_to_save";
    assistantMessage = "我已经整理好了，会记录下来帮助改进题目和报告。";
  }
  if (!assistantMessage) return null;

  const draft = action === "ready_to_save"
    ? buildStructuredFeedback(input, context, messages)
    : undefined;

  return {
    action,
    assistantMessage,
    draft,
    model,
  };
}

function buildStructuredFeedback(
  input: Record<string, unknown>,
  context: FeedbackContext,
  messages: FeedbackDialogueMessage[]
): StructuredFeedback {
  const summary = cleanText(input.summary, 1000) || "用户完成了报告反馈，但没有提供足够具体的文字。";
  const feedbackTypes = parseEnumArray(input.feedbackTypes, FEEDBACK_TYPES);
  return {
    sessionId: context.sessionId,
    personalityCode: context.personalityCode || "unknown",
    role: context.role || "用户",
    recentUse: context.recentUse || "使用 AI 完成日常任务",
    goal: context.goal || "更有效地使用 AI",
    totalQuestions: normalizeCount(context.totalQuestions),
    answeredQuestions: normalizeCount(context.answeredQuestions),
    skipRate: normalizeRate(context.skipRate),
    summary,
    usefulParts: parseStringArray(input.usefulParts),
    inaccurateParts: parseStringArray(input.inaccurateParts),
    questionIssues: parseStringArray(input.questionIssues),
    reportIssues: parseStringArray(input.reportIssues),
    improvementSuggestions: parseStringArray(input.improvementSuggestions),
    sentiment: parseEnum(input.sentiment, SENTIMENTS, "mixed"),
    priority: parseEnum(input.priority, PRIORITIES, "medium"),
    feedbackTypes: feedbackTypes.length ? feedbackTypes : ["report_issue"],
    rawDialogue: [
      ...messages,
      { role: "assistant" as const, content: cleanText(input.assistantMessage, 1000) },
    ].map((message) => ({
      role: message.role,
      content: cleanText(message.content, 2000),
    })).filter((message) => message.content),
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 500))
    .filter(Boolean)
    .slice(0, 8);
}

function parseEnumArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<T>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!allowed.includes(item as T)) continue;
    seen.add(item as T);
  }
  return Array.from(seen);
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeCount(value: unknown): number {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
}

function normalizeRate(value: unknown): number {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}
