import {
  cacheLlmSystemPrompt,
  type LlmSystemPrompt,
  type LlmTool,
  type LlmToolChoice,
  type LlmToolUse,
} from "@/lib/llm";
import { appendSystemPromptBlock } from "@/lib/qwen";
import { summarizeSessionStateForPrompt } from "@/lib/sessionState";
import type {
  AgentBOutput,
  Dimension,
  DirectiveAction,
  Message,
  MidDialogueKey,
  MidDialogueStatus,
  QuestionnaireAnswer,
  QuestionnaireBatchMode,
  QuestionnaireQuestion,
  ScenarioGuidance,
  SessionEvidence,
  SessionState,
  TargetContext,
} from "@/lib/types";

export const QUESTIONNAIRE_ENTRY_ROUND = 2;

export const INTERVIEW_OPENING_MESSAGE =
  "嗨，欢迎！先聊聊你是做什么的吧？";

export function normalizeInitialInterviewOpening(value: string): string {
  const clean = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
  if (!clean) return "";
  if (/AI|ai|ChatGPT|Qwen|Cursor|工具|目标|提升|改善|协作体验|怎么使用/.test(clean)) {
    return "";
  }
  return clean.slice(0, 60);
}

const DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];
const DIRECTIVE_ACTIONS: DirectiveAction[] = [
  "probe_new",
  "probe_deep",
  "clarify",
  "conclude",
  "start_questionnaire",
  "finish_mid_dialog",
  "exit_requested",
];
const QUESTIONNAIRE_BATCH_MODES: QuestionnaireBatchMode[] = ["hybrid_batch1", "hybrid_batch2"];
const MID_DIALOGUE_STATUSES: MidDialogueStatus[] = [
  "confirmed",
  "refined",
  "abstract_scenarios",
  "needs_more_context",
  "exit_requested",
];
const SCENARIO_GRANULARITIES: ScenarioGuidance["granularity"][] = ["specific", "balanced", "abstract"];
export type MidDialogueOpeningSkippedQuestion = Pick<QuestionnaireAnswer, "dimension" | "scenario" | "question">;

export const RESEARCHER_TOOL_SYSTEM = `<role>
你是一位 AI-MBTI 研究员，负责把轻量访谈沉淀成结构化状态，并在合适轮次生成专属问卷。
</role>

<dual_responsibility>
## 双重职责

1. 对话者：用户可见回复要像真人访谈官，短、自然、直接对用户说话。前两轮只轻量了解职业或身份、AI 使用方式和必要目标。
2. 分析者：结构化工具调用负责记录 role、recentUse、goal、scenarioGuidance、newEvidence 和问卷题目。工具字段可以使用内部术语，用户可见回复不解释这些术语。
</dual_responsibility>

<phase_boundaries>
## 阶段边界

- 聊天背景阶段：先输出一句用户可见回复，再调用 update_session_state；只收集背景，不判断四维倾向，不生成问卷。
- Active 主动问卷阶段：按两部分生成共 16 题；hybrid_batch1 是第一轮 8 题，hybrid_batch2 是第二轮 8 题。
- Phase 6 批次生成阶段：只调用 generate_questionnaire_batch 工具；用户提示写入 userFacingMessage，正文可以为空。
- generate_questionnaire 是旧版单次问卷兼容工具，不属于当前主动两段式流程。
- 每轮如果用户说了任何能体现 Relation / Workflow / Epistemic / RepairScope 倾向的具体行为，把用户原话片段写入 newEvidence.quote；如果只是背景信息，也至少写 1 条背景 quote。
</phase_boundaries>

<conversation_rhythm>
## Phase 6 初始访谈节奏

- 开场只问职业或身份，例如“先聊聊你是做什么的吧？”。
- 用户回答职业或身份后，自然承接，再问平时用 AI 主要做什么。
- 用户回答 AI 使用方式后，简短承接并进入问卷生成；如果用户顺带说了目标，也写入 goal。
- 前两轮保持轻量，不深挖四维度、协作类型或测评倾向。
</conversation_rhythm>

<scoring_model_for_internal_use>
## AI-MBTI 四维度（供结构化分析和出题使用，不向用户解释）

Relation: Instrumental 工具型 ↔ Collaborative 伙伴型
Workflow: Framed 框架型 ↔ Exploratory 探索型
Epistemic: Auditing 审计型 ↔ Trusting 信任型
RepairScope: Global 全局重评 ↔ Local 局部调整

active 流程双向锚定：每个维度各 1 题 reverse=false（高分=高端）+ 1 题 reverse=true（高分=低端）。
reverse=false：认同度高 -> Collaborative / Framed / Auditing / Global。
reverse=true：认同度高 -> Instrumental / Exploratory / Trusting / Local（计分层自动翻转）。
</scoring_model_for_internal_use>`;

const targetContextSchema = {
  type: "object",
  properties: {
    role: { type: "string" },
    tools: { type: "array", items: { type: "string" } },
    recentUse: { type: "string" },
    goal: { type: "string" },
  },
  required: ["role", "recentUse", "goal"],
  additionalProperties: false,
};

const analysisSchema = {
  type: "object",
  properties: {
    reasoning: { type: "string" },
    background_summary: { type: "string" },
  },
  required: ["reasoning", "background_summary"],
  additionalProperties: false,
};

const directiveSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: DIRECTIVE_ACTIONS },
    target_dimension: { type: "string", enum: DIMENSIONS },
    hint: { type: "string" },
  },
  required: ["action"],
  additionalProperties: false,
};

const questionnaireQuestionSchema = {
  type: "object",
  properties: {
    dimension: { type: "string", enum: DIMENSIONS },
    scenario: { type: "string" },
    question: { type: "string" },
    questionType: { type: "string", enum: ["universal", "semi_specific", "specific"] },
    reverse: { type: "boolean" },
  },
  required: ["dimension", "scenario", "question"],
  additionalProperties: false,
};

const existingQuestionSchema = {
  type: "object",
  properties: {
    dimension: { type: "string", enum: DIMENSIONS },
    scenario: { type: "string" },
    question: { type: "string" },
    questionType: { type: "string", enum: ["universal", "semi_specific", "specific"] },
    reverse: { type: "boolean" },
  },
  required: ["dimension", "scenario", "question"],
  additionalProperties: false,
};

const scenarioGuidanceSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: MID_DIALOGUE_STATUSES },
    scenarioSummary: { type: "string" },
    granularity: { type: "string", enum: SCENARIO_GRANULARITIES },
    avoidTopics: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    includeTopics: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    userCorrectionQuote: { type: "string" },
  },
  required: ["status", "scenarioSummary", "granularity", "avoidTopics", "includeTopics"],
  additionalProperties: false,
};

const evidenceSchema = {
  type: "object",
  properties: {
    dimension: { type: "string", enum: DIMENSIONS },
    quote: {
      type: "string",
      description: "用户原话片段，必须来自本轮或历史对话，≤120字；纯背景信息也可以不填 dimension。",
    },
    signal: { type: "string", enum: ["strong", "weak"] },
    evidence_kind: { type: "string", enum: ["quote", "summary"] },
  },
  required: ["quote", "signal", "evidence_kind"],
  additionalProperties: false,
};

export const UPDATE_SESSION_STATE_TOOL: LlmTool = {
  name: "update_session_state",
  description: "分析 AI-MBTI 访谈上下文，更新用户背景、目标上下文，并给访谈官下一步提示。聊天阶段不要生成问卷。",
  input_schema: {
    type: "object",
    properties: {
      analysis: analysisSchema,
      directive: directiveSchema,
      targetContext: targetContextSchema,
      nextQuestions: {
        type: "array",
        items: questionnaireQuestionSchema,
        maxItems: 0,
      },
      newEvidence: {
        type: "array",
        items: evidenceSchema,
        minItems: 1,
        maxItems: 4,
        description: "优先 quote。若本轮没有任何维度行为证据，至少给 1 条背景 quote。",
      },
    },
    required: ["analysis", "directive", "targetContext", "nextQuestions", "newEvidence"],
    additionalProperties: false,
  },
};

export const GENERATE_QUESTIONNAIRE_TOOL: LlmTool = {
  name: "generate_questionnaire",
  description: "【旧版兼容】旧单次问卷工具，仅保留给遗留调用和历史解析；当前 Phase 6 主动流程必须使用 generate_questionnaire_batch。",
  input_schema: {
    type: "object",
    properties: {
      analysis: analysisSchema,
      targetContext: targetContextSchema,
      nextQuestions: {
        type: "array",
        items: questionnaireQuestionSchema,
        minItems: 16,
        maxItems: 20,
      },
      newEvidence: {
        type: "array",
        items: evidenceSchema,
        maxItems: 4,
      },
    },
    required: ["analysis", "targetContext", "nextQuestions"],
    additionalProperties: false,
  },
};

export const GENERATE_QUESTIONNAIRE_BATCH_TOOL: LlmTool = {
  name: "generate_questionnaire_batch",
  description: "基于当前 AI-MBTI 状态输出 Phase 6 的问卷部分，并避免和已有题目相似。",
  input_schema: {
    type: "object",
    properties: {
      analysis: analysisSchema,
      targetContext: targetContextSchema,
      batchMode: { type: "string", enum: QUESTIONNAIRE_BATCH_MODES },
      existingQuestions: {
        type: "array",
        items: existingQuestionSchema,
        maxItems: 24,
        description: "可选回显。生成 nextQuestions 时必须避开这些题目的题干和语义。",
      },
      scenarioGuidance: scenarioGuidanceSchema,
      userFacingMessage: {
        type: "string",
        description: "给用户看的问卷生成完成提示，1-2句，≤80字；不要解释维度和计分。",
      },
      nextQuestions: {
        type: "array",
        items: questionnaireQuestionSchema,
        minItems: 8,
        maxItems: 16,
      },
      newEvidence: {
        type: "array",
        items: evidenceSchema,
        maxItems: 4,
      },
    },
    required: ["analysis", "targetContext", "batchMode", "userFacingMessage", "nextQuestions"],
    additionalProperties: false,
  },
};

export const UPDATE_MID_DIALOGUE_TOOL: LlmTool = {
  name: "update_mid_dialogue",
  description: "解析 Phase 6 中途对话，把用户对场景适配度的反馈写入结构化 ScenarioGuidance。",
  input_schema: {
    type: "object",
    properties: {
      analysis: analysisSchema,
      directive: directiveSchema,
      targetContext: targetContextSchema,
      scenarioGuidance: scenarioGuidanceSchema,
      shouldGenerateNextBatch: { type: "boolean" },
      newEvidence: {
        type: "array",
        items: evidenceSchema,
        maxItems: 4,
      },
    },
    required: ["analysis", "directive", "targetContext", "scenarioGuidance", "shouldGenerateNextBatch"],
    additionalProperties: false,
  },
};

export function getResearcherTool(roundCount: number): LlmTool {
  return roundCount >= QUESTIONNAIRE_ENTRY_ROUND ? GENERATE_QUESTIONNAIRE_TOOL : UPDATE_SESSION_STATE_TOOL;
}

export function getResearcherToolChoice(roundCount: number): LlmToolChoice {
  if (roundCount < QUESTIONNAIRE_ENTRY_ROUND) return "auto";
  return {
    type: "tool",
    name: GENERATE_QUESTIONNAIRE_TOOL.name,
  };
}

export function getResearcherMaxTokens(roundCount: number, configuredMaxTokens: number): number {
  return Math.min(configuredMaxTokens, roundCount >= QUESTIONNAIRE_ENTRY_ROUND ? 4096 : 1024);
}

export function getQuestionnaireBatchToolChoice(): LlmToolChoice {
  return {
    type: "tool",
    name: GENERATE_QUESTIONNAIRE_BATCH_TOOL.name,
  };
}

export function getMidDialogueToolChoice(): LlmToolChoice {
  return {
    type: "tool",
    name: UPDATE_MID_DIALOGUE_TOOL.name,
  };
}

export function buildResearcherSystemPrompt(sessionState?: SessionState): LlmSystemPrompt {
  const base = cacheLlmSystemPrompt(RESEARCHER_TOOL_SYSTEM);
  return sessionState
    ? appendSystemPromptBlock(base, summarizeSessionStateForPrompt(sessionState), { cache: true })
    : base;
}

export function buildQuestionnaireBatchPrompt({
  sessionState,
  batchMode,
  existingQuestions,
  scenarioGuidance,
  retryReason,
}: {
  sessionState: SessionState;
  batchMode: QuestionnaireBatchMode;
  existingQuestions: QuestionnaireQuestion[];
  scenarioGuidance?: ScenarioGuidance;
  retryReason?: string;
}): string {
  const existingText = existingQuestions.length > 0
    ? existingQuestions
        .map((item, index) => `${index + 1}. [${item.dimension}/${item.reverse ? "反向" : "正向"}] ${item.scenario}｜${item.question}`)
        .join("\n")
    : "（暂无）";
  const guidance = formatScenarioGuidanceForPrompt(scenarioGuidance ?? sessionState.scenarioGuidance);
  const retry = retryReason ? `\n\n【上一次输出问题】\n${retryReason}\n请重新生成，必须修正这些问题。` : "";
  const isFirstBatch = batchMode === "hybrid_batch1";
  const batchLabel = isFirstBatch ? "第一轮问卷（8题）" : "第二轮问卷（8题）";
  const questionTypes = isFirstBatch
    ? "通用题 4 道 + 半具体题 4 道；每个维度 1 道 universal + 1 道 semi_specific"
    : "半具体题 4 道 + 具体题 4 道；每个维度 1 道 semi_specific + 1 道 specific";

  return `<task>
你现在要生成${batchLabel}。必须调用 generate_questionnaire_batch 工具，把题目写入 nextQuestions，把给用户看的过渡语写入 userFacingMessage。
</task>

<batch_contract>
batchMode: ${batchMode}
总题数：8 题
维度分布：Relation / Workflow / Epistemic / RepairScope 各 2 题
题目类型分布：${questionTypes}
正反向分布：每个维度 1 题 reverse=false，1 题 reverse=true；每批共 4 题 reverse=false + 4 题 reverse=true
计分方式：用户选择 0-5 分，跳过按 2.5 分计算
</batch_contract>

<direction_contract>
双向锚定：
- reverse=false 题：认同度高 -> Relation=Collaborative、Workflow=Framed、Epistemic=Auditing、RepairScope=Global。
- reverse=true 题：认同度高 -> Relation=Instrumental、Workflow=Exploratory、Epistemic=Trusting、RepairScope=Local，计分时会自动翻转。
每个维度必须各出 1 题 reverse=false 和 1 题 reverse=true；两类题都要写成自然的一阶陈述，不要写成“我不会……”这类否定题。
</direction_contract>

<user_context>
${summarizeSessionStateForPrompt(sessionState)}
</user_context>

<existing_questions>
这些题目不能重复，也不能做近似改写：
${existingText}
</existing_questions>

<scenario_guidance>
${guidance}
</scenario_guidance>

<question_design>
- 通用题 scenario 必须精确写成 “通用”，questionType=”universal”。
- 半具体题 scenario 写 2-6 字职业或任务类型短语，例如”写代码””开会””课程学习”，questionType=”semi_specific”。
- 具体题 scenario 写 4-12 字 recentUse 或 scenarioGuidance 里的真实场景短语，例如”写产品需求文档””优化 React 性能”，questionType=”specific”。
- scenario 只写场景名称，不要写”...时””...的时候”等后缀，不要写完整句子。
- 题干（question）必须是自包含的完整陈述，包含场景描述和行为倾向两部分：
  * 通用题：直接从”我...”开头，不需要场景前缀
  * 半具体题和具体题：必须包含场景描述，格式为”[场景]时/中/过程中，我...”
- 题干避免和已有题目语义重复，第二部分尤其要和第一部分互补。
- userFacingMessage 用 1 句自然中文告诉用户这一部分题已经准备好，并提示点击按钮进入作答；不要解释维度、计分或内部分析。
</question_design>

<question_examples>
【通用题】
✓ scenario=”通用”，question=”我倾向于把 AI 当成讨论伙伴，而不只是执行工具。”

【半具体题】
✓ scenario=”写代码”，question=”写代码时，我会先明确需求，再开始编写。”
✓ scenario=”团队协作”，question=”在团队项目中，我会邀请 AI 参与头脑风暴。”
✗ scenario=”写代码”，question=”我会先明确需求，再开始编写。”（缺少场景描述）

【具体题】
✓ scenario=”写产品需求文档”，question=”写产品需求文档时，我习惯先列大纲，再让 AI 帮我细化。”
✓ scenario=”优化 React 性能”，question=”在优化 React 性能过程中，我会先验证 AI 给的方案。”
✗ scenario=”写产品需求文档”，question=”我习惯先列大纲，再让 AI 帮我细化。”（缺少场景描述）

【反向题（reverse=true，描述低端行为，仍然要自然正向表达）】
✓ dimension=”Relation”，reverse=true，question=”做事时，我更习惯直接给 AI 明确指令，让它按要求快速产出结果。”
✓ dimension=”Epistemic”，reverse=true，question=”做判断时，AI 给出的结论只要读起来合理，我通常会先采用再说。”
✗ reverse=true，question=”我不会先验证 AI 的答案。”（否定句，不符合要求）
</question_examples>${retry}`;
}

export function buildMidDialoguePrompt({
  messages,
  sessionState,
  dialogKey,
}: {
  messages: Message[];
  sessionState: SessionState;
  dialogKey: MidDialogueKey;
}): string {
  const history = messages
    .map((m) => `${m.role === "assistant" ? "访谈官" : "用户"}：${m.content}`)
    .join("\n");

  return `<task>
Phase 6 中途对话解析。先给用户一句话自然承接，再调用 update_mid_dialogue 工具记录反馈。
</task>

<dialog_state>
dialogKey: ${dialogKey}
${summarizeSessionStateForPrompt(sessionState)}
</dialog_state>

<dialog_history>
${history || "（暂无）"}
</dialog_history>

<user_visible_reply>
一句话自然承接用户的反馈，直接对用户说话。可以参考：
- 用户认可或说继续：好的，那我们继续第二部分。
- 用户给出新场景：明白了，我会按你说的代码评审场景调整第二部分题目。
- 用户说太具体或没经历：了解，我会把第二部分题目调得更通用一些。
- 用户说都行或随便：好，那我按当前场景继续。
</user_visible_reply>

<structured_feedback_rules>
- 用户认可或说继续：scenarioGuidance.status="confirmed"，directive.action="finish_mid_dialog"，shouldGenerateNextBatch=true。
- 用户说场景不适合，并给出真实方向：status="refined"，directive.action="finish_mid_dialog"，更新 targetContext 和 includeTopics / avoidTopics，shouldGenerateNextBatch=true。
- 用户说场景太具体：status="abstract_scenarios"，directive.action="finish_mid_dialog"，granularity="abstract"，shouldGenerateNextBatch=true。
- 用户说题目不懂、没经历过、没想好或对这个方向不感兴趣：根据原话设置 includeTopics / avoidTopics，directive.action="finish_mid_dialog"，shouldGenerateNextBatch=true。
- 用户回复低信息、都行、随便、不清楚：按当前场景继续，directive.action="finish_mid_dialog"，status="confirmed"，shouldGenerateNextBatch=true。
- shouldGenerateNextBatch 几乎总是 true；只有用户明确不想继续时才写 false，并设置 directive.action="exit_requested"、status="exit_requested"。
</structured_feedback_rules>

<flow_rule>
这轮中途对话只处理一次用户反馈。除非用户明确退出，结构化记录后直接进入第二部分问卷。
</flow_rule>`;
}

export function buildMidDialogueTransitionRepairPrompt({
  messages,
  sessionState,
  dialogKey,
  agentBOutput,
}: {
  messages: Message[];
  sessionState: SessionState;
  dialogKey: MidDialogueKey;
  agentBOutput: AgentBOutput;
}): string {
  const recentHistory = messages
    .slice(-4)
    .map((message) => `${message.role === "assistant" ? "访谈官" : "用户"}：${message.content}`)
    .join("\n");
  const target = agentBOutput.targetContext ?? sessionState.refinedTargetContext ?? {
    role: sessionState.background.role,
    tools: sessionState.background.tools,
    recentUse: sessionState.background.recentUse,
    goal: sessionState.background.goal,
  };
  const guidance = agentBOutput.scenarioGuidance ?? sessionState.scenarioGuidance;

  return `【Phase 6 中途对话过渡修复】
dialogKey: ${dialogKey}

	上一轮模型已经成功调用 update_mid_dialogue 工具，并决定进入第二部分问卷，但没有输出用户可见正文。现在只补写一句给用户看的过渡话。

【最近对话】
${recentHistory || "（暂无）"}

【当前目标上下文】
role: ${target.role}
tools: ${(target.tools ?? []).join("、") || "未明确"}
recentUse: ${target.recentUse}
goal: ${target.goal}

【工具结果摘要】
directive.action: ${agentBOutput.directive.action}
shouldGenerateNextBatch: ${agentBOutput.shouldGenerateNextBatch ? "true" : "false"}
scenarioStatus: ${guidance?.status ?? "unknown"}
scenarioSummary: ${guidance?.scenarioSummary ?? target.goal ?? target.recentUse}
granularity: ${guidance?.granularity ?? "balanced"}
includeTopics: ${(guidance?.includeTopics ?? []).join("、") || "（无）"}
avoidTopics: ${(guidance?.avoidTopics ?? []).join("、") || "（无）"}

【输出要求】
只输出一句自然中文，不要 JSON，不要 Markdown。
这句话会直接显示给用户，必须像访谈官直接对用户说话。
	表达“已收到，会按当前场景/调整方向生成第二部分题目”的意思。
不要追问，不要问句，不要出现“工具 / directive / hint / shouldGenerateNextBatch / 内部提示 / 维度 / 计分”等内部词。
不要复述 directive.hint；directive.hint 不是用户可见文案。
总长不超过 70 字。`;
}

export function buildMidDialogueOpeningPrompt({
  dialogKey,
  sessionState,
  skipRate,
  skippedQuestionSamples = [],
}: {
  dialogKey: MidDialogueKey;
  sessionState: SessionState;
  skipRate: number;
  skippedQuestionSamples?: MidDialogueOpeningSkippedQuestion[];
}): string {
  const target = sessionState.refinedTargetContext ?? {
    role: sessionState.background.role,
    tools: sessionState.background.tools,
    recentUse: sessionState.background.recentUse,
    goal: sessionState.background.goal,
  };
  const skipSummary =
    skippedQuestionSamples.length > 0
      ? "第一部分存在跳过题，需要引用 1-2 道代表题询问题意、经历或兴趣问题。"
      : "第一部分没有明确跳过题，需要简短询问整体贴合度和第二部分希望聚焦的 AI 使用场景。";
  const skippedQuestionText = skippedQuestionSamples.length > 0
    ? skippedQuestionSamples
        .slice(0, 2)
        .map((item, index) => {
          const scenario = item.scenario && item.scenario !== "习惯" ? `｜${item.scenario}` : "";
          return `${index + 1}. [${item.dimension}${scenario}] ${item.question}`;
        })
        .join("\n")
    : "（无明确跳过题样本）";

  return `【Phase 6 中途对话开场生成】
dialogKey: ${dialogKey}
skipRate: ${Math.round(skipRate * 100)}%
${skipSummary}

${summarizeSessionStateForPrompt(sessionState)}

【用户跳过的代表题】
${skippedQuestionText}

	【本轮唯一任务】
	只输出一段自然中文开场，不要 JSON，不要 Markdown，不要列表，不要第三人称总结，不要说“用户已确认”。

	要求：
	1. 你正在直接和用户说话，语气短、自然、像访谈中的承上启下。
	2. 必须用开放式提问，不要用“是不是”“对吗”“适合吗”“贴合吗”“不贴合吗”“是否”这类封闭式问题。
	3. 如果有跳过题样本，自然引用其中 1-2 道，询问“题意哪里不清楚、是不是没有类似经历，或这个方向本身不太感兴趣”；不要要求用户逐题解释。
	4. 如果没有跳过题样本，问“第一部分答下来你觉得整体感觉怎么样？第二部分你更希望围绕哪些真实 AI 使用场景来问？”这类问题。
	5. 如果 target.recentUse 或 target.goal 只是“使用 AI 完成日常任务 / 更有效地使用 AI”这类泛目标，不要把它当场景；请直接请用户说最近最常用 AI 做哪类任务。
	6. 如果已有较具体场景，可以自然提到它，例如“你前面提到的科研写作 / 产品方案 / 代码调试”。
	7. 输出 1-2 句，总长不超过 150 字。`;
}

export function buildResearcherToolPrompt(messages: Message[], roundCount: number, sessionState?: SessionState): string {
  const history = messages
    .map((m) => `${m.role === "assistant" ? "访谈官" : "用户"}：${m.content}`)
    .join("\n");
  const userReplyCount = messages.filter((m) => m.role === "user").length;

  if (roundCount >= QUESTIONNAIRE_ENTRY_ROUND) {
    return `【旧版单次问卷兼容路径】
当前对话轮数：${roundCount}（旧逻辑中已达问卷生成轮次，≥${QUESTIONNAIRE_ENTRY_ROUND}）

	注意：当前 active 主动问卷流程不是本路径；主动流程必须使用 generate_questionnaire_batch，两轮各 8 题，共 16 题。
以下要求仅用于遗留调用或历史导出兼容，不应作为 Phase 6 主动批次生成说明。

【对话记录】
${history || "（尚无用户发言，请仍基于可得的访谈官开场等信息生成问卷）"}

【本轮唯一任务】
必须调用旧版兼容工具 generate_questionnaire，不要输出 JSON 文本。
如果输出用户可见正文，只能是一句陈述式过渡，例如“好的，我会根据你刚才说的写代码场景生成第一批问卷。”不要再追问用户，不要问目标、用途、课程作业、个人项目、学习新技术等问题；系统此时已经会进入问卷生成。

旧版兼容问卷硬性要求：
1. nextQuestions 长度只能是 16。
2. Relation / Workflow / Epistemic / RepairScope 各 4 题。
3. 旧版兼容路径优先沿用 active 流程的双向锚定：每维 2 题 reverse=false + 2 题 reverse=true。
4. reverse=false 代表认同该题时更靠近：Collaborative / Framed / Auditing / Global；reverse=true 代表认同该题时更靠近：Instrumental / Exploratory / Trusting / Local。
6. 每题尽量绑定 targetContext；每个维度至少 2 题绑定用户目标或近期使用场景。
7. scenario 是 8～24 字短场景短语，不要写完整段落；question 是第一人称倾向陈述，不重复 scenario。
8. 不要编造用户明显没有经历过的场景；目标缺失时，围绕 recentUse 出题。`;
  }

  return `<task>
聊天背景阶段。先用一句自然中文回复用户，再调用 update_session_state 工具更新结构化状态；此阶段不生成问卷。
</task>

<turn_state>
当前对话轮数：${roundCount}（聊天背景阶段，轮数 < ${QUESTIONNAIRE_ENTRY_ROUND}）
用户已回答轮数：${userReplyCount}
</turn_state>

<dialog_history>
${history || "（尚无）"}
</dialog_history>

${sessionState ? `<session_state>\n${summarizeSessionStateForPrompt(sessionState)}\n</session_state>\n` : ""}

<conversation_step>
${buildInitialInterviewRoundInstruction(userReplyCount)}
</conversation_step>

<structured_output_rules>
- analysis.background_summary 概括用户职业、常用工具、典型场景和当前目标。
- targetContext 必须包含 role、recentUse、goal，可包含 tools。
- role 优先来自用户对职业或身份的回答；如果没说清楚，保留已有值或写“用户”。
- recentUse 优先来自用户对 AI 使用方式的回答；如果还没回答，recentUse 先保留已有值或写“使用 AI 完成日常任务”。
- 如果目标缺失，goal 写 "提高效率，并获得更多 idea/思路/选择/灵感"。
- directive.action 只能用 probe_new 或 probe_deep；hint 给访谈官一句中文提示，最多 40 字。
- nextQuestions 必须为空数组。
- newEvidence 至少 1 条，quote 使用用户原话片段；即使只是背景信息，evidence_kind 也写 "quote"。
</structured_output_rules>`;
}

function buildInitialInterviewRoundInstruction(userReplyCount: number): string {
  if (userReplyCount <= 1) {
    return `用户刚回答职业或身份。
- 自然承接用户的职业或身份，再问他平时用 AI 主要做什么。
- 把用户说的职业、身份、年级、岗位或当前状态写入 targetContext.role。
- 如果用户还没说 AI 使用方式，recentUse 先保留已有值或写“使用 AI 完成日常任务”，不要把职业内容写成 recentUse。
- 用户可见回复可以类似：“明白了。那你平时用 AI 主要做什么？可以说说最常用的场景。”
- 这一轮只问 AI 使用方式，不追加测评维度、协作类型或多个问题。`;
  }
  return `用户已经回答过职业或身份，现在刚回答 AI 使用方式。
- 把用户平时用 AI 做的任务、工具或最近场景写入 targetContext.recentUse。
- 如果用户顺带说了目标，把它写入 targetContext.goal；否则目标保持 missing。
- 用户可见回复只需简短承接，例如：“明白了，那我们进入几道选择题，会更准确地了解你的协作风格。”
- 不再追问职业、AI 使用方式或额外目标；接下来系统会进入个性化问卷生成。
- “更有效地使用 AI”只是兜底目标，不是具体 recentUse。`;
}

export function agentBOutputFromToolUses(toolUses: LlmToolUse[], roundCount: number): AgentBOutput | null {
  const expectedName = roundCount >= QUESTIONNAIRE_ENTRY_ROUND ? GENERATE_QUESTIONNAIRE_TOOL.name : UPDATE_SESSION_STATE_TOOL.name;
  const toolUse = toolUses.find((item) => item.name === expectedName);
  const input = parseToolInputRecord(toolUse?.input);
  if (!input) return null;

  const analysis = parseAnalysis(input.analysis);
  const targetContext = parseTargetContext(input.targetContext);
  const nextQuestions = parseQuestions(input.nextQuestions);
  const newEvidence = parseEvidence(input.newEvidence, roundCount);
  const scenarioGuidance = parseScenarioGuidance(input.scenarioGuidance);
  const shouldGenerateNextBatch = typeof input.shouldGenerateNextBatch === "boolean"
    ? input.shouldGenerateNextBatch
    : undefined;

  if (roundCount >= QUESTIONNAIRE_ENTRY_ROUND) {
    return {
      analysis,
      directive: { action: "start_questionnaire" },
      targetContext,
      nextQuestions,
      newEvidence,
      scenarioGuidance,
      shouldGenerateNextBatch,
    };
  }

  const directive = parseDirective(input.directive);
  return {
    analysis,
    directive,
    targetContext,
    nextQuestions: [],
    newEvidence,
    scenarioGuidance,
    shouldGenerateNextBatch,
  };
}

export function questionnaireBatchOutputFromToolUses(
  toolUses: LlmToolUse[],
  textBlocks: string[] = []
): AgentBOutput | null {
  const toolUse = toolUses.find((item) => item.name === GENERATE_QUESTIONNAIRE_BATCH_TOOL.name);
  const parsedToolInput = parseToolInputRecord(toolUse?.input);
  const textInput = parsedToolInput
    ? undefined
    : parseQuestionnaireBatchTextInput(textBlocks);
  const input = parsedToolInput ?? textInput;
  if (!input) return null;
  return {
    analysis: parseAnalysis(input.analysis),
    directive: { action: "start_questionnaire" },
    targetContext: parseTargetContext(input.targetContext ?? input.target_context),
    nextQuestions: parseQuestions(input.nextQuestions ?? input.questions ?? input.next_questions),
    newEvidence: parseEvidence(input.newEvidence ?? input.new_evidence, 0),
    scenarioGuidance: parseScenarioGuidance(input.scenarioGuidance ?? input.scenario_guidance),
    userFacingMessage: parseOptionalString(input.userFacingMessage ?? input.user_facing_message, 120),
  };
}

function parseQuestionnaireBatchTextInput(textBlocks: string[]): Record<string, unknown> | null {
  const text = textBlocks.join("\n").trim();
  if (!text) return null;
  const parsed = parseJsonLikeText(text);
  if (Array.isArray(parsed)) return { nextQuestions: parsed };
  return asToolInputRecord(parsed);
}

function parseToolInputRecord(input: unknown): Record<string, unknown> | null {
  const direct = asToolInputRecord(input);
  if (direct) return direct;
  if (typeof input !== "string") return null;
  return asToolInputRecord(parseJsonLikeText(input));
}

function asToolInputRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (record.input && typeof record.input === "object" && !Array.isArray(record.input)) {
    return record.input as Record<string, unknown>;
  }
  if (record.arguments && typeof record.arguments === "object" && !Array.isArray(record.arguments)) {
    return record.arguments as Record<string, unknown>;
  }
  return record;
}

function parseJsonLikeText(text: string): unknown {
  const candidates = [
    text,
    ...Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)).map((match) => match[1]?.trim() ?? ""),
  ].filter(Boolean);
  const firstObjectStart = text.indexOf("{");
  const lastObjectEnd = text.lastIndexOf("}");
  if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
    candidates.push(text.slice(firstObjectStart, lastObjectEnd + 1));
  }
  const firstArrayStart = text.indexOf("[");
  const lastArrayEnd = text.lastIndexOf("]");
  if (firstArrayStart >= 0 && lastArrayEnd > firstArrayStart) {
    candidates.push(text.slice(firstArrayStart, lastArrayEnd + 1));
  }
  candidates.push(...qwenToolInputRepairCandidates(text));

  for (const candidate of Array.from(new Set(candidates))) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next plausible JSON span.
    }
  }
  return null;
}

function qwenToolInputRepairCandidates(text: string): string[] {
  const repaired = text.replace(
    /}\s*\n\s*\{(?=\s*"(?:directive|batchMode|batch_mode|existingQuestions|existing_questions|targetContext|target_context|nextQuestions|next_questions|newEvidence|new_evidence|scenarioGuidance|scenario_guidance|shouldGenerateNextBatch|userFacingMessage|questions)"\s*:)/g,
    "},"
  );
  if (repaired === text) return [];
  const candidates = [repaired];
  let trimmed = repaired;
  for (let i = 0; i < 2 && trimmed.endsWith("}"); i++) {
    trimmed = trimmed.slice(0, -1).trimEnd();
    candidates.push(trimmed);
  }
  return candidates;
}

export function midDialogueOutputFromToolUses(toolUses: LlmToolUse[], turn: number): AgentBOutput | null {
  const toolUse = toolUses.find((item) => item.name === UPDATE_MID_DIALOGUE_TOOL.name);
  const input = parseToolInputRecord(toolUse?.input);
  if (!input) return null;
  return {
    analysis: parseAnalysis(input.analysis),
    directive: parseDirective(input.directive),
    targetContext: parseTargetContext(input.targetContext),
    nextQuestions: [],
    newEvidence: parseEvidence(input.newEvidence, turn),
    scenarioGuidance: parseScenarioGuidance(input.scenarioGuidance),
    shouldGenerateNextBatch: typeof input.shouldGenerateNextBatch === "boolean"
      ? input.shouldGenerateNextBatch
      : undefined,
  };
}

export function researcherTextFromResult(textBlocks: string[], _agentBOutput: AgentBOutput, _roundCount: number): string {
  const text = textBlocks.join("").trim();
  if (text) return text;
  return "";
}

export function normalizeMidDialogueOutput({
  agentBOutput,
  messages,
  sessionState,
  dialogKey,
}: {
  agentBOutput: AgentBOutput;
  messages: Message[];
  sessionState: SessionState;
  dialogKey: MidDialogueKey;
}): AgentBOutput {
  if (agentBOutput.directive.action === "exit_requested") {
    return agentBOutput;
  }

  const segment = getCurrentMidDialogueMessages(messages, sessionState, dialogKey);
  const userMessages = segment.filter((message) => message.role === "user");
  const latestUser = userMessages[userMessages.length - 1]?.content.trim() ?? "";
  const targetContext = agentBOutput.targetContext ?? {
    role: sessionState.background.role,
    tools: sessionState.background.tools,
    recentUse: sessionState.refinedTargetContext?.recentUse ?? sessionState.background.recentUse,
    goal: sessionState.refinedTargetContext?.goal ?? sessionState.background.goal,
  };
  const existingGuidance = agentBOutput.scenarioGuidance ?? sessionState.scenarioGuidance;
  const status =
    existingGuidance?.status &&
    existingGuidance.status !== "needs_more_context" &&
    existingGuidance.status !== "exit_requested"
      ? existingGuidance.status
      : "confirmed";
  return {
    ...agentBOutput,
    directive: {
      ...agentBOutput.directive,
      action: "finish_mid_dialog",
      hint: buildMidDialogueCompletionText(dialogKey),
    },
    targetContext,
    scenarioGuidance: {
      status,
      scenarioSummary:
        existingGuidance?.scenarioSummary ||
        targetContext.recentUse ||
        targetContext.goal ||
        "用户当前 AI 使用场景",
      granularity: existingGuidance?.granularity ?? "balanced",
      avoidTopics: existingGuidance?.avoidTopics ?? [],
      includeTopics:
        existingGuidance?.includeTopics?.length
          ? existingGuidance.includeTopics
          : [targetContext.recentUse, targetContext.goal].filter(Boolean),
      userCorrectionQuote: existingGuidance?.userCorrectionQuote || latestUser || undefined,
    },
    shouldGenerateNextBatch: true,
  };
}

export function midDialogueTextFromResult({
  textBlocks,
  agentBOutput,
}: {
  textBlocks: string[];
  agentBOutput: AgentBOutput;
  messages: Message[];
  sessionState: SessionState;
  dialogKey: MidDialogueKey;
}): string {
  const text = textBlocks.join("").trim();
  if (!text) return "";
  if (
    agentBOutput.shouldGenerateNextBatch ||
    agentBOutput.directive.action === "finish_mid_dialog"
  ) {
    return normalizeMidDialogueTransitionRepairText(text);
  }
  return normalizeMidDialogueVisibleText(text);
}

export function normalizeMidDialogueVisibleText(value: string): string {
  const clean = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["“]|["”]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (
    /directive|shouldGenerateNextBatch|\bhint\b|tool[-_ ]?call|工具调用|内部提示|JSON|Markdown|维度|计分|引导用户|用户可见|正文才是|追问一次|开放式问题|第三人称总结/i.test(clean)
  ) {
    return "";
  }
  return clean.slice(0, 180);
}

export function normalizeMidDialogueTransitionRepairText(value: string): string {
  const clean = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["“]|["”]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (
    /[?？]/.test(clean) ||
    /directive|hint|shouldGenerateNextBatch|工具|内部提示|JSON|Markdown|维度|计分/i.test(clean)
  ) {
    return "";
  }
  return clean.slice(0, 90);
}

export function normalizeQuestionnaireTransitionText(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (
    /[?？]/.test(clean) ||
    /什么样的目标|完成课程作业|个人项目|学习新技术|为了什么|希望达成|主要是为了|能具体说说|可以说说/.test(clean)
  ) {
    return "";
  }
  return clean.slice(0, 120);
}

export function buildMidDialogueCompletionText(dialogKey: MidDialogueKey): string {
  if (dialogKey === "dialog1") {
    return "好，我会按你刚才的反馈生成第二部分问卷。";
  }
  return "好，我会按当前场景继续生成后续题目。";
}

function getCurrentMidDialogueMessages(
  messages: Message[],
  sessionState: SessionState,
  dialogKey: MidDialogueKey
): Message[] {
  const opening = sessionState.midDialogues?.[dialogKey]?.[0]?.content.trim();
  if (opening) {
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index]?.role === "assistant" && messages[index]?.content.trim() === opening) {
        return messages.slice(index);
      }
    }
  }
  return messages.slice(-4);
}

function isLowInformationMidDialogueReply(value: string): boolean {
  const clean = value.replace(/\s+/g, "");
  if (!clean) return true;
  if (clean.length <= 2 && /^(嗯|好|行|可|是|对|啊|额|呃)+$/.test(clean)) return true;
  return /说不清|不清楚|不知道|没想好|都行|随便|无所谓|不好说|不确定/.test(clean);
}

export function createOpeningAgentBOutput(): AgentBOutput {
  return {
    analysis: {
      reasoning: "首轮固定开场，不调用模型做背景分析。",
      background_summary: "尚未收集用户背景。",
    },
    directive: {
      action: "probe_new",
      hint: "先询问职业或身份。",
    },
    nextQuestions: [],
  };
}

function parseAnalysis(value: unknown): AgentBOutput["analysis"] {
  if (!value || typeof value !== "object") {
    return { reasoning: "模型通过工具调用更新访谈状态。", background_summary: "用户背景收集中" };
  }
  const record = value as Record<string, unknown>;
  return {
    reasoning: typeof record.reasoning === "string" ? record.reasoning : "模型通过工具调用更新访谈状态。",
    background_summary: typeof record.background_summary === "string" ? record.background_summary : "用户背景收集中",
  };
}

function parseTargetContext(value: unknown): TargetContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.role !== "string" ||
    isPlaceholder(record.role) ||
    typeof record.recentUse !== "string" ||
    isPlaceholder(record.recentUse) ||
    typeof record.goal !== "string"
  ) {
    return undefined;
  }
  return {
    role: record.role,
    tools: Array.isArray(record.tools) ? record.tools.filter((item): item is string => typeof item === "string") : [],
    recentUse: record.recentUse,
    goal: record.goal,
  };
}

function parseScenarioGuidance(value: unknown): ScenarioGuidance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const status = record.status;
  const granularity = record.granularity;
  if (
    !MID_DIALOGUE_STATUSES.includes(status as MidDialogueStatus) ||
    !SCENARIO_GRANULARITIES.includes(granularity as ScenarioGuidance["granularity"]) ||
    typeof record.scenarioSummary !== "string"
  ) {
    return undefined;
  }
  return {
    status: status as MidDialogueStatus,
    scenarioSummary: record.scenarioSummary.trim(),
    granularity: granularity as ScenarioGuidance["granularity"],
    avoidTopics: parseStringList(record.avoidTopics),
    includeTopics: parseStringList(record.includeTopics),
    userCorrectionQuote:
      typeof record.userCorrectionQuote === "string" && record.userCorrectionQuote.trim()
        ? record.userCorrectionQuote.trim().slice(0, 120)
        : undefined,
  };
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    items.push(clean.slice(0, 40));
  }
  return items.slice(0, 8);
}

function parseOptionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function formatScenarioGuidanceForPrompt(guidance: ScenarioGuidance | undefined): string {
  if (!guidance) return "（暂无明确场景反馈；优先使用当前目标上下文生成。）";
  return [
    `状态：${guidance.status}`,
    `粒度：${guidance.granularity}`,
    `场景摘要：${guidance.scenarioSummary || "（暂无）"}`,
    `包含：${guidance.includeTopics.join("、") || "（暂无）"}`,
    `避免：${guidance.avoidTopics.join("、") || "（暂无）"}`,
    guidance.userCorrectionQuote ? `用户修正：${guidance.userCorrectionQuote}` : "",
  ].filter(Boolean).join("；");
}

function isPlaceholder(value: string): boolean {
  return /unknown|n\/a|未(知|提供)|不详|待用户/i.test(value.trim());
}

function parseDirective(value: unknown): AgentBOutput["directive"] {
  if (!value || typeof value !== "object") return { action: "probe_new", hint: "继续了解用户的 AI 使用背景。" };
  const record = value as Record<string, unknown>;
  const action = DIRECTIVE_ACTIONS.includes(record.action as DirectiveAction)
    ? record.action as DirectiveAction
    : "probe_new";
  return {
    action: action === "start_questionnaire" ? "probe_new" : action,
    target_dimension: DIMENSIONS.includes(record.target_dimension as Dimension)
      ? record.target_dimension as Dimension
      : undefined,
    hint: typeof record.hint === "string" ? record.hint : "继续了解用户的 AI 使用背景。",
  };
}

function parseQuestions(value: unknown): QuestionnaireQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      !DIMENSIONS.includes(record.dimension as Dimension) ||
      typeof record.scenario !== "string" ||
      typeof record.question !== "string"
    ) {
      return [];
    }
    const questionType =
      record.questionType === "universal" || record.questionType === "semi_specific" || record.questionType === "specific"
        ? record.questionType
        : undefined;
    return [{
      dimension: record.dimension as Dimension,
      scenario: record.scenario,
      question: record.question,
      questionType,
      reverse: typeof record.reverse === "boolean" ? record.reverse : false,
    }];
  });
}

function parseEvidence(value: unknown, turn: number): SessionEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.quote !== "string" || !record.quote.trim()) return [];
    const signal = record.signal === "strong" ? "strong" : "weak";
    const evidenceKind = record.evidence_kind === "summary" ? "summary" : "quote";
    return [{
      turn,
      dimension: DIMENSIONS.includes(record.dimension as Dimension)
        ? record.dimension as Dimension
        : undefined,
      quote: record.quote.trim().slice(0, 120),
      signal,
      evidenceKind,
    }];
  });
}
