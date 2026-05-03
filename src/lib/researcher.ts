import { appendSystemPromptBlock, cacheSystemPrompt, type ClaudeSystemPrompt, type ClaudeTool, type ClaudeToolChoice, type ClaudeToolUse } from "@/lib/claude";
import { summarizeSessionStateForPrompt } from "@/lib/sessionState";
import type {
  AgentBOutput,
  Dimension,
  DirectiveAction,
  GoalType,
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
  if (/AI|ai|ChatGPT|Claude|Cursor|工具|目标|提升|改善|协作体验|怎么使用/.test(clean)) {
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
const GOAL_TYPES: GoalType[] = [
  "product_building",
  "research_writing",
  "learning",
  "coding_system",
  "business_decision",
  "daily_efficiency",
  "creative_work",
  "other",
];

export type MidDialogueOpeningSkippedQuestion = Pick<QuestionnaireAnswer, "dimension" | "scenario" | "question">;

export const RESEARCHER_TOOL_SYSTEM = `你是一位 AI-MBTI 研究员，负责把访谈对话沉淀成结构化状态，并在合适轮次生成专属问卷。

## 工作边界

- 聊天背景阶段：只收集职业、AI 使用经历、当前目标，不判断用户四维倾向，不生成问卷。
- Phase 6 主动问卷生成阶段：按两部分生成专属问卷，共 24 题；hybrid_batch1 8 题、hybrid_batch2 16 题。
- 聊天背景阶段你必须先直接对用户输出一句自然中文回复，然后调用工具更新结构化状态。不要再交给第二个 Agent 代写。
- Phase 6 批次生成阶段必须只调用 generate_questionnaire_batch 工具生成问卷，正文可以为空。
- generate_questionnaire 是旧版单次问卷兼容工具，不属于当前 Phase 6 主动流程。
- 你必须通过提供的工具返回结构化结果，不要在正文里输出 JSON、Markdown 或额外说明。
- 每轮如果用户说了任何能体现 Relation/Workflow/Epistemic/RepairScope 倾向的具体行为，必须以用户原话 quote 形式落到 newEvidence，至少 1 条；不要只放 summary。

## Phase 6 初始访谈节奏

- 第 0 轮访谈官开场只问职业或身份，语气轻松开放，例如“先聊聊你是做什么的吧？”，不要同时问 AI 使用方式或目标。
- 用户回答职业/身份后的下一轮：必须从用户回答中提取 role，并自然追问“你平时用 AI 主要做什么？可以说说你最常用的场景。”或同义开放式问题。
- 用户回答 AI 使用方式后的下一轮：必须从用户回答中提取 recentUse；如果用户顺带说了目标，也写入 goal，否则 goalStatus="missing" 且 goal="更有效地使用 AI"。
- 不要把职业/身份回答误写成 recentUse；不要把“更有效地使用 AI”当作具体场景。
- 初始访谈保持轻量，不要在前两轮追问四维度、协作类型或测评倾向。

## AI-MBTI 四维度

Relation: Instrumental 工具型 ↔ Collaborative 伙伴型
Workflow: Framed 框架型 ↔ Exploratory 探索型
Epistemic: Auditing 审计型 ↔ Trusting 信任型
RepairScope: Global 全局重评 ↔ Local 局部调整

## 计分方向

- reverse=false 表示用户越认同，越靠近该维度高端倾向：Collaborative / Exploratory / Trusting / Local。
- reverse=true 表示用户越认同，越靠近该维度低端倾向：Instrumental / Framed / Auditing / Global。`;

const targetContextSchema = {
  type: "object",
  properties: {
    role: { type: "string" },
    recentUse: { type: "string" },
    goal: { type: "string" },
    goalStatus: { type: "string", enum: ["specific", "generic", "missing"] },
    goalType: { type: "string", enum: GOAL_TYPES },
  },
  required: ["role", "recentUse", "goal", "goalStatus", "goalType"],
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
    reverse: { type: "boolean" },
  },
  required: ["dimension", "scenario", "question", "reverse"],
  additionalProperties: false,
};

const existingQuestionSchema = {
  type: "object",
  properties: {
    dimension: { type: "string", enum: DIMENSIONS },
    scenario: { type: "string" },
    question: { type: "string" },
    reverse: { type: "boolean" },
  },
  required: ["dimension", "scenario", "question", "reverse"],
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

export const UPDATE_SESSION_STATE_TOOL: ClaudeTool = {
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

export const GENERATE_QUESTIONNAIRE_TOOL: ClaudeTool = {
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

export const GENERATE_QUESTIONNAIRE_BATCH_TOOL: ClaudeTool = {
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

export const UPDATE_MID_DIALOGUE_TOOL: ClaudeTool = {
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

export function getResearcherTool(roundCount: number): ClaudeTool {
  return roundCount >= QUESTIONNAIRE_ENTRY_ROUND ? GENERATE_QUESTIONNAIRE_TOOL : UPDATE_SESSION_STATE_TOOL;
}

export function getResearcherToolChoice(roundCount: number): ClaudeToolChoice {
  if (roundCount < QUESTIONNAIRE_ENTRY_ROUND) return "auto";
  return {
    type: "tool",
    name: GENERATE_QUESTIONNAIRE_TOOL.name,
  };
}

export function getResearcherMaxTokens(roundCount: number, configuredMaxTokens: number): number {
  return Math.min(configuredMaxTokens, roundCount >= QUESTIONNAIRE_ENTRY_ROUND ? 4096 : 1024);
}

export function getQuestionnaireBatchToolChoice(): ClaudeToolChoice {
  return {
    type: "tool",
    name: GENERATE_QUESTIONNAIRE_BATCH_TOOL.name,
  };
}

export function getMidDialogueToolChoice(): ClaudeToolChoice {
  return {
    type: "tool",
    name: UPDATE_MID_DIALOGUE_TOOL.name,
  };
}

export function buildResearcherSystemPrompt(sessionState?: SessionState): ClaudeSystemPrompt {
  const base = cacheSystemPrompt(RESEARCHER_TOOL_SYSTEM);
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

  return `【Phase 6 问卷批次生成】
batchMode: ${batchMode}

${summarizeSessionStateForPrompt(sessionState)}

【已有题目，必须避免重复或近似改写】
${existingText}

【场景反馈】
${guidance}

	【本轮唯一任务】
	必须调用 generate_questionnaire_batch 工具。不要输出 JSON 文本。
	当前 Phase 6 主动问卷由两部分组成：hybrid_batch1 (8题) / hybrid_batch2 (16题)；完成后共 24 题。

	硬性要求：
	1. hybrid_batch1 必须刚好 8 题；hybrid_batch2 必须刚好 16 题。
	2. hybrid_batch1 必须包含 4 道 scenario=「习惯」的习惯题、4 道具体或半具体场景题。
	3. hybrid_batch2 必须包含 8 道 scenario=「习惯」的习惯题、8 道具体或半具体场景题。
	4. hybrid_batch1: Relation / Workflow / Epistemic / RepairScope 各 2 题。
	5. hybrid_batch2: Relation / Workflow / Epistemic / RepairScope 各 4 题。
	6. hybrid_batch1 每个维度必须刚好 1 道 reverse=false、1 道 reverse=true。
	7. hybrid_batch2 每个维度必须刚好 2 道 reverse=false、2 道 reverse=true。
	8. hybrid_batch2 必须结合已有题目做互补；两部分合计后，每个维度必须 6 题，其中 3 道 reverse=false、3 道 reverse=true。
	9. 所有场景题必须绑定 targetContext、refinedTargetContext 或 scenarioGuidance；不能只有泛泛的「日常使用 AI」；若 granularity=abstract，降低具象职业细节，但仍要能让用户代入。
	10. 题干必须是第一人称倾向陈述，不要问句，不要重复已有题目的措辞或同义改写。
	11. reverse=false 代表认同该题时更靠近高端：Collaborative / Exploratory / Trusting / Local。
	12. reverse=true 代表认同时更靠近低端：Instrumental / Framed / Auditing / Global。
	13. userFacingMessage 是问卷生成完成后显示给用户的自然过渡话术，必须像直接对用户说话；说明这一部分题已经准备好，提示用户点击按钮进入作答；不要出现 JSON、维度解释、计分规则或内部分析。${retry}`;
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

  return `【Phase 6 中途对话解析】
dialogKey: ${dialogKey}

${summarizeSessionStateForPrompt(sessionState)}

【对话记录】
${history || "（暂无）"}

	【本轮唯一任务】
	先自然回应用户，再调用 update_mid_dialogue 工具。不要输出 JSON 文本。
	自然回应必须直接对用户说，例如“好的，我会按这个场景调整第二部分题目。”不要用“用户已确认”这类第三人称总结。
	自然回应应优先承接用户的具体场景或感受；避免“适合吗 / 对吗 / 是不是”这类封闭式问法。
	正文才是用户会看到的回复；directive.hint 是内部提示，不要把“用更具体的日常行为场景引导用户描述”这类指令式文字当成正文。
	如果你决定 shouldGenerateNextBatch=true 或 directive.action="finish_mid_dialog"，仍然要先输出一句给用户看的自然过渡话；不要只调用工具。

	结构化规则：
	1. 用户认可或说继续：scenarioGuidance.status="confirmed"，directive.action="finish_mid_dialog"，shouldGenerateNextBatch=true。
	2. 用户说场景不适合，并给出真实方向：status="refined"，directive.action="finish_mid_dialog"，更新 targetContext 和 includeTopics/avoidTopics，shouldGenerateNextBatch=true。
	3. 用户说场景太具体：status="abstract_scenarios"，directive.action="finish_mid_dialog"，granularity="abstract"，shouldGenerateNextBatch=true。
	4. 用户说题目不懂、没经历过、没想好或对这个方向不感兴趣：根据原话设置 includeTopics/avoidTopics，directive.action="finish_mid_dialog"，shouldGenerateNextBatch=true。
	5. 用户回复低信息、都行、随便、不清楚：不要继续追问，按当前场景继续生成第二部分，directive.action="finish_mid_dialog"，status="confirmed"，shouldGenerateNextBatch=true。
	6. 除非用户明确不想继续，否则这一轮中途对话后必须 shouldGenerateNextBatch=true，不再追加第二轮追问。
	7. 用户明确不想继续：directive.action="exit_requested"，status="exit_requested"，shouldGenerateNextBatch=false。`;
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
    recentUse: sessionState.background.recentUse,
    goal: sessionState.background.goal,
    goalStatus: sessionState.background.goalStatus,
    goalType: sessionState.background.goalType,
  };
  const guidance = agentBOutput.scenarioGuidance ?? sessionState.scenarioGuidance;

  return `【Phase 6 中途对话过渡修复】
dialogKey: ${dialogKey}

	上一轮模型已经成功调用 update_mid_dialogue 工具，并决定进入第二部分问卷，但没有输出用户可见正文。现在只补写一句给用户看的过渡话。

【最近对话】
${recentHistory || "（暂无）"}

【当前目标上下文】
role: ${target.role}
recentUse: ${target.recentUse}
goal: ${target.goal}
goalStatus: ${target.goalStatus}
goalType: ${target.goalType}

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
    recentUse: sessionState.background.recentUse,
    goal: sessionState.background.goal,
    goalStatus: sessionState.background.goalStatus,
    goalType: sessionState.background.goalType,
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

	注意：当前 Phase 6 主动问卷流程不是本路径；主动流程必须使用 generate_questionnaire_batch，hybrid_batch1 8 题、hybrid_batch2 16 题，共 24 题。
以下要求仅用于遗留调用或历史导出兼容，不应作为 Phase 6 主动批次生成说明。

【对话记录】
${history || "（尚无用户发言，请仍基于可得的访谈官开场等信息生成问卷）"}

【本轮唯一任务】
必须调用旧版兼容工具 generate_questionnaire，不要输出 JSON 文本。
如果输出用户可见正文，只能是一句陈述式过渡，例如“好的，我会根据你刚才说的写代码场景生成第一批问卷。”不要再追问用户，不要问目标、用途、课程作业、个人项目、学习新技术等问题；系统此时已经会进入问卷生成。

旧版兼容问卷硬性要求：
1. nextQuestions 长度只能是 16 或 20，优先 16。
2. 16 题时 Relation / Workflow / Epistemic / RepairScope 各 4 题；20 题时各 5 题。
3. 每个维度内必须同时包含 reverse=false 与 reverse=true。
4. reverse=false 代表认同该题时更靠近高端：Collaborative / Exploratory / Trusting / Local。
5. reverse=true 代表认同时更靠近低端：Instrumental / Framed / Auditing / Global。
6. 每题尽量绑定 targetContext；每个维度至少 2 题绑定用户目标或近期使用场景。
7. scenario 是 8～24 字短场景短语，不要写完整段落；question 是第一人称倾向陈述，不重复 scenario。
8. 不要编造用户明显没有经历过的场景；目标缺失时，围绕 recentUse 出题。`;
  }

  return `【当前对话轮数】${roundCount}（聊天背景阶段，轮数 < ${QUESTIONNAIRE_ENTRY_ROUND}）
【用户已回答轮数】${userReplyCount}

【对话记录】
${history || "（尚无）"}

${sessionState ? `${summarizeSessionStateForPrompt(sessionState)}\n` : ""}

【本轮唯一任务】
先用一句自然中文回复用户，再调用 update_session_state 工具。不要输出 JSON 文本，不要生成问卷。

【当前轮次任务】
${buildInitialInterviewRoundInstruction(userReplyCount)}

要求：
1. 只收集职业、AI 使用经历与当前目标，不要判断四维倾向。
2. 更新 analysis.background_summary，概括用户职业、常用工具、典型场景、当前目标。
3. 输出 targetContext：role、recentUse、goal、goalStatus、goalType。
4. role 必须优先来自用户对“职业或身份”的回答；如果没说清楚，保留已有值或“用户”，不要编造。
5. recentUse 必须优先来自用户对“平时用 AI 主要做什么”的回答；如果还没回答，保留已有值或“使用 AI 完成日常任务”，不要编造。
6. 如果目标缺失，goalStatus 写 "missing"，goal 写 "更有效地使用 AI"。
7. directive.action 只能用 probe_new 或 probe_deep；hint 给访谈官一句中文提示（≤40 字）。
8. nextQuestions 必须为空数组。
9. newEvidence 必须至少 1 条，quote 必须使用用户原话片段；如果只是背景信息，evidence_kind 仍写 "quote"。`;
}

function buildInitialInterviewRoundInstruction(userReplyCount: number): string {
  if (userReplyCount <= 1) {
    return `用户刚回答第一轮职业/身份问题。
- 必须把用户职业、身份、年级、岗位或当前状态写入 targetContext.role。
- 如果用户没有主动说 AI 使用方式，不要把职业内容写进 recentUse。
- 自然回复必须追问 AI 使用方式，使用开放式表达，例如：“你平时用 AI 主要做什么？可以说说你最常用的场景。”
- 这一轮不要追问测评维度，不要一次性追加很多问题。`;
  }
  return `用户已经回答过职业/身份，现在刚回答 AI 使用方式。
- 必须把用户平时用 AI 做的任务、工具或最近场景写入 targetContext.recentUse。
- 如果用户顺带说了目标，把它写入 targetContext.goal；否则目标保持 missing。
- 自然回复只需简短承接，不再继续追问职业或 AI 使用方式；接下来系统会进入个性化问卷生成。
- 不要把“更有效地使用 AI”当作具体 recentUse。`;
}

export function agentBOutputFromToolUses(toolUses: ClaudeToolUse[], roundCount: number): AgentBOutput | null {
  const expectedName = roundCount >= QUESTIONNAIRE_ENTRY_ROUND ? GENERATE_QUESTIONNAIRE_TOOL.name : UPDATE_SESSION_STATE_TOOL.name;
  const toolUse = toolUses.find((item) => item.name === expectedName);
  if (!toolUse || !toolUse.input || typeof toolUse.input !== "object") return null;
  const input = toolUse.input as Record<string, unknown>;

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
  toolUses: ClaudeToolUse[],
  textBlocks: string[] = []
): AgentBOutput | null {
  const toolUse = toolUses.find((item) => item.name === GENERATE_QUESTIONNAIRE_BATCH_TOOL.name);
  const textInput = toolUse?.input && typeof toolUse.input === "object"
    ? undefined
    : parseQuestionnaireBatchTextInput(textBlocks);
  const rawInput = toolUse?.input && typeof toolUse.input === "object" ? toolUse.input : textInput;
  if (!rawInput || typeof rawInput !== "object") return null;
  const input = rawInput as Record<string, unknown>;
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
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (record.input && typeof record.input === "object") return record.input as Record<string, unknown>;
  if (record.arguments && typeof record.arguments === "object") return record.arguments as Record<string, unknown>;
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

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next plausible JSON span.
    }
  }
  return null;
}

export function midDialogueOutputFromToolUses(toolUses: ClaudeToolUse[], turn: number): AgentBOutput | null {
  const toolUse = toolUses.find((item) => item.name === UPDATE_MID_DIALOGUE_TOOL.name);
  if (!toolUse || !toolUse.input || typeof toolUse.input !== "object") return null;
  const input = toolUse.input as Record<string, unknown>;
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
    recentUse: sessionState.refinedTargetContext?.recentUse ?? sessionState.background.recentUse,
    goal: sessionState.refinedTargetContext?.goal ?? sessionState.background.goal,
    goalStatus: sessionState.refinedTargetContext?.goalStatus ?? sessionState.background.goalStatus,
    goalType: sessionState.refinedTargetContext?.goalType ?? sessionState.background.goalType,
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
  const goalStatus = record.goalStatus;
  const goalType = record.goalType;
  if (
    typeof record.role !== "string" ||
    isPlaceholder(record.role) ||
    typeof record.recentUse !== "string" ||
    isPlaceholder(record.recentUse) ||
    typeof record.goal !== "string" ||
    (goalStatus !== "specific" && goalStatus !== "generic" && goalStatus !== "missing") ||
    !GOAL_TYPES.includes(goalType as GoalType)
  ) {
    return undefined;
  }
  return {
    role: record.role,
    recentUse: record.recentUse,
    goal: record.goal,
    goalStatus,
    goalType: goalType as GoalType,
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
      typeof record.question !== "string" ||
      typeof record.reverse !== "boolean"
    ) {
      return [];
    }
    return [{
      dimension: record.dimension as Dimension,
      scenario: record.scenario,
      question: record.question,
      reverse: record.reverse,
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
