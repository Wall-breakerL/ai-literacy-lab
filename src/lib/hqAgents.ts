// [archived] AI-HQ v0.1 — pending rework as an AI-MBTI report sub-module.
import type { Message } from "./types";
import { HQ_PROBE_DEFINITIONS } from "./hqScoring";

export const HQ_ROUNDS = [
  {
    id: "route",
    label: "Route",
    dimension: "route",
    question:
      "你怎么理解 Agent 和普通大语言模型的区别？当你把任务交给 AI 时，会怎样判断它需要工具、资料、记忆，或需要你自己复核？",
    scenarioPrompt: null as string | null,
  },
  {
    id: "frame_1",
    label: "Frame",
    dimension: "frame",
    question:
      "平时你把一个任务交给 AI 时，会怎么描述目标、背景、角色、约束和验收标准？可以结合你最近一次使用 AI 的经历讲。",
    scenarioPrompt: null as string | null,
  },
  {
    id: "frame_2",
    label: "Frame 情境题",
    dimension: "frame",
    question: "你觉得这个 prompt 有什么问题？如果是你，会怎么改写，让 AI 更容易产出可用结果？",
    scenarioPrompt:
      "你明天要参加一个重要会议，需要 AI 帮你准备一份会前方案。你写下了这条 prompt：\n\n「帮我做一份面向明天会议的方案，要专业一点。」",
  },
  {
    id: "workflow",
    label: "Workflow",
    dimension: "workflow",
    question:
      "当任务比较复杂、不是一次就能完成时，你会怎样和 AI 分阶段推进？你通常在什么时候检查质量、补充上下文或调整方向？",
    scenarioPrompt: null as string | null,
  },
  {
    id: "repair",
    label: "Repair",
    dimension: "repair",
    question:
      "如果 AI 给出的结果看起来完整，但明显不符合你的预期，你会怎样定位问题、判断原因，并让它修到可用？",
    scenarioPrompt: null as string | null,
  },
] as const;

export type HQRoundId = (typeof HQ_ROUNDS)[number]["id"];

export interface HQRoundState {
  userAnswerCount: number;
  roundIndex: number;
  isComplete: boolean;
  round: (typeof HQ_ROUNDS)[number] | null;
}

export function getHQRoundState(messages: Message[]): HQRoundState {
  const userAnswerCount = messages.filter((message) => message.role === "user").length;
  const isComplete = userAnswerCount >= HQ_ROUNDS.length;
  const roundIndex = Math.min(userAnswerCount, HQ_ROUNDS.length - 1);
  return {
    userAnswerCount,
    roundIndex,
    isComplete,
    round: isComplete ? null : HQ_ROUNDS[roundIndex],
  };
}

export function formatHQTranscript(messages: Message[]): string {
  if (messages.length === 0) return "（尚无对话）";
  return messages
    .map((m) => `${m.role === "assistant" ? "访谈官" : "用户"}：${m.content}`)
    .join("\n\n");
}

export const HQ_INTERVIEW_AGENT_A_SYSTEM = `你是一位 AI-HQ 访谈员。AI-HQ 评估用户驾驭 AI / Agent 完成任务的成熟度。

## 职责

- 服务端会指定本轮唯一要问的问题，你只能围绕该问题自然表达。
- 你可以用一句话承接用户上一轮回答，但不要追问旧主题，不要自行跳到其他主题。
- 如果本轮有情境题，必须完整呈现情境，再提出问题。
- 语言自然、温和、简洁。不要输出 JSON、不要输出角色名前缀。`;

export function buildHQInterviewAgentAPrompt(params: {
  messages: Message[];
  roundState: HQRoundState;
}): string {
  const { messages, roundState } = params;
  const round = roundState.round;
  if (!round) {
    return "五段访谈已完成。请用一句简短、温暖的话感谢用户，并提醒用户点击按钮生成《AI-HQ 报告》。不要提出新问题。";
  }

  const scenarioBlock = round.scenarioPrompt
    ? `\n【本轮情境】\n${round.scenarioPrompt}\n`
    : "";

  return `【当前进度】第 ${roundState.roundIndex + 1} / ${HQ_ROUNDS.length} 段
【本轮主题】${round.label}
${scenarioBlock}
【本轮唯一问题】
${round.question}

【已有对话】
${formatHQTranscript(messages)}

请生成本轮访谈官对用户说的话。`;
}

export const HQ_AGENT_B_SYSTEM = `你是一位 AI-HQ 证据评估与报告撰写专家。你只输出严格 JSON，不要 Markdown、不要代码块、不要多余说明。

## 你的边界

- 你只判断用户访谈记录是否触发 probe，并撰写分析、建议、行动项和 prompt 模板。
- 你不要计算分数、不要判定等级，服务端会根据 probeResults 确定性计分。
- 若证据不足，hit=false，evidence=""。
- evidence 必须来自用户实际表达的简短转述，不要编造。

## Probe 定义

${HQ_PROBE_DEFINITIONS.map((dimension) => {
  const items = dimension.probes
    .map((probe, index) => `${index + 1}. ${probe.id}：${probe.description}`)
    .join("\n");
  return `### ${dimension.dimension}\n${items}`;
}).join("\n\n")}

## 输出格式（严格 JSON）

{
  "probeResults": {
    "route": [{ "hit": true, "evidence": "..." }],
    "frame": [{ "hit": true, "evidence": "..." }],
    "workflow": [{ "hit": true, "evidence": "..." }],
    "repair": [{ "hit": true, "evidence": "..." }]
  },
  "overall": "总体分析段落",
  "dimensions": [
    { "dimension": "route", "analysis": "...", "advice": "..." },
    { "dimension": "frame", "analysis": "...", "advice": "..." },
    { "dimension": "workflow", "analysis": "...", "advice": "..." },
    { "dimension": "repair", "analysis": "...", "advice": "..." }
  ],
  "recommendations": ["下一次使用 AI 可以怎么做"],
  "promptTemplates": [
    { "title": "任务契约模板", "prompt": "..." },
    { "title": "分阶段推进模板", "prompt": "..." }
  ]
}

probeResults 数组长度必须与 Probe 定义完全一致：route=3，frame=8，workflow=4，repair=3。`;

/** 根据完整访谈对话生成 HQ 报告证据判断（分数由服务端确定性计算） */
export function buildHQAgentBPromptFromMessages(messages: Message[]): string {
  return `以下是用户与访谈官在 AI-HQ 五段访谈中的完整记录。请通读对话，判断各 probe 是否有证据触发，并生成行动型报告文本。

【五段主题】
${HQ_ROUNDS.map((round, index) => `${index + 1}. ${round.label}：${round.question}`).join("\n")}

【完整对话记录】
${formatHQTranscript(messages)}

请严格按照 system prompt 输出 JSON。`;
}
