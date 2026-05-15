import type {
  QuestionnaireBatchMode,
  QuestionnaireQuestion,
  ScenarioGuidance,
  TargetContext,
} from "@/lib/types";

/**
 * Legacy single-questionnaire fallback：每维 4 题（含正反向），共 16 题。
 * 当前 AI-MBTI 主链路使用下方两部分 8+8 题 fallback。
 */
export const FALLBACK_QUESTIONNAIRE: QuestionnaireQuestion[] = [
  // Relation ×4
  {
    dimension: "Relation",
    scenario: "你需要完成一项比较重要的学习任务时",
    question: "我更愿意把 AI 当作可以一起讨论、打磨思路的搭档，而不是只会执行指令的工具。",
    reverse: false,
  },
  {
    dimension: "Relation",
    scenario: "时间紧、只想快速拿到结果时",
    question: "我通常让 AI「照我说的做就行」，不会花时间和它讨论多余的东西。",
    reverse: true,
  },
  {
    dimension: "Relation",
    scenario: "遇到不太有把握的问题时",
    question: "我希望 AI 能主动帮我拆解、追问，而不只是给一段答案就结束。",
    reverse: false,
  },
  {
    dimension: "Relation",
    scenario: "用完 AI 之后",
    question: "我很少关心「协作过程」，主要看输出能不能用。",
    reverse: true,
  },
  // Workflow ×4
  {
    dimension: "Workflow",
    scenario: "开始一个新任务前",
    question: "我习惯先把目标、步骤和约束写清楚，再让 AI 在框架里动手。",
    reverse: false,
  },
  {
    dimension: "Workflow",
    scenario: "面对一个有点模糊的需求",
    question: "我更喜欢先扔一个大概想法给 AI，边试边改，而不是先列完整方案。",
    reverse: true,
  },
  {
    dimension: "Workflow",
    scenario: "协作写文档或写代码时",
    question: "我会先定目录/接口/清单，再让 AI 填充，避免一开始就发散。",
    reverse: false,
  },
  {
    dimension: "Workflow",
    scenario: "探索一个不熟悉的领域时",
    question: "我宁愿快速试几种提法，也不太想先写一大份规格说明。",
    reverse: true,
  },
  // Epistemic ×4
  {
    dimension: "Epistemic",
    scenario: "AI 给出一个看起来合理的结论时",
    question: "我通常会再查证、对比其他来源，而不是直接采用。",
    reverse: false,
  },
  {
    dimension: "Epistemic",
    scenario: "赶进度、结果看起来没问题时",
    question: "我经常直接使用 AI 的答案，不再额外验证。",
    reverse: true,
  },
  {
    dimension: "Epistemic",
    scenario: "涉及风险或重要决策时",
    question: "我会刻意检查 AI 的推理链条和引用是否靠谱。",
    reverse: false,
  },
  {
    dimension: "Epistemic",
    scenario: "日常琐事或非关键任务",
    question: "我倾向于相信 AI 的表述，很少挑错。",
    reverse: true,
  },
  // RepairScope ×4
  {
    dimension: "RepairScope",
    scenario: "发现 AI 输出有明显错误时",
    question: "我倾向于在现有结果上局部修改、迭代，而不是推倒重来。",
    reverse: true,
  },
  {
    dimension: "RepairScope",
    scenario: "多轮对话里越改越乱时",
    question: "我更愿意清空上下文、重新描述问题，从头再试一遍。",
    reverse: false,
  },
  {
    dimension: "RepairScope",
    scenario: "AI 生成的内容需要大改时",
    question: "我会一块块改，尽量保留可用的部分。",
    reverse: true,
  },
  {
    dimension: "RepairScope",
    scenario: "结果离预期差很远时",
    question: "我第一反应是整段删掉、换提问方式重来，而不是微调句子。",
    reverse: false,
  },
];

export const FALLBACK_QUESTIONNAIRE_BATCHES: Record<QuestionnaireBatchMode, QuestionnaireQuestion[]> = {
  hybrid_batch1: [
    {
      dimension: "Relation",
      scenario: "通用",
      question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具。",
      questionType: "universal",
      reverse: false,
    },
    {
      dimension: "Relation",
      scenario: "做事",
      question: "做事时，我更习惯直接给 AI 明确指令，让它按要求快速产出结果。",
      questionType: "semi_specific",
      reverse: true,
    },
    {
      dimension: "Workflow",
      scenario: "通用",
      question: "用 AI 时，我习惯先明确目标，再开始对话。",
      questionType: "universal",
      reverse: false,
    },
    {
      dimension: "Workflow",
      scenario: "完成任务",
      question: "完成任务时，我更喜欢先让 AI 探索几个方向，再决定怎么推进。",
      questionType: "semi_specific",
      reverse: true,
    },
    {
      dimension: "Epistemic",
      scenario: "通用",
      question: "AI 给出答案后，我通常会先验证再使用。",
      questionType: "universal",
      reverse: false,
    },
    {
      dimension: "Epistemic",
      scenario: "做判断",
      question: "做判断时，AI 给出的结论只要读起来合理，我通常会先采用再说。",
      questionType: "semi_specific",
      reverse: true,
    },
    {
      dimension: "RepairScope",
      scenario: "通用",
      question: "AI 出错时，我更愿意重新描述问题，而不是只改局部。",
      questionType: "universal",
      reverse: false,
    },
    {
      dimension: "RepairScope",
      scenario: "出错时",
      question: "结果偏离预期时，我习惯在现有内容上一点点调整，保留还能用的部分。",
      questionType: "semi_specific",
      reverse: true,
    },
  ],
  hybrid_batch2: [
    {
      dimension: "Relation",
      scenario: "协作任务",
      question: "处理协作任务时，我会让 AI 一起比较不同方案的取舍。",
      questionType: "semi_specific",
      reverse: false,
    },
    {
      dimension: "Relation",
      scenario: "当前任务",
      question: "做当前任务时，我更希望 AI 听清楚指令后直接执行，少主动扩展边界。",
      questionType: "specific",
      reverse: true,
    },
    {
      dimension: "Workflow",
      scenario: "规划任务",
      question: "规划任务时，我会先写清楚边界，再让 AI 展开内容。",
      questionType: "semi_specific",
      reverse: false,
    },
    {
      dimension: "Workflow",
      scenario: "当前任务",
      question: "推进当前任务时，我更愿意先看 AI 的初稿，再从结果里反推目标和标准。",
      questionType: "specific",
      reverse: true,
    },
    {
      dimension: "Epistemic",
      scenario: "重要判断",
      question: "遇到重要判断时，我会要求 AI 标出不确定的地方。",
      questionType: "semi_specific",
      reverse: false,
    },
    {
      dimension: "Epistemic",
      scenario: "当前任务",
      question: "做当前任务时，AI 的关键建议只要能解决眼前问题，我通常会直接推进。",
      questionType: "specific",
      reverse: true,
    },
    {
      dimension: "RepairScope",
      scenario: "结果跑偏",
      question: "结果跑偏时，我会重新描述背景，让 AI 换框架再来。",
      questionType: "semi_specific",
      reverse: false,
    },
    {
      dimension: "RepairScope",
      scenario: "当前任务",
      question: "当前任务越改越乱时，我会先定位最小问题点，尽量不重开整体对话。",
      questionType: "specific",
      reverse: true,
    },
  ],
};

export const FALLBACK_QUESTIONNAIRE_TOTAL: QuestionnaireQuestion[] = [
  ...FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch1,
  ...FALLBACK_QUESTIONNAIRE_BATCHES.hybrid_batch2,
];

export function getFallbackQuestionnaireBatch(
  mode: QuestionnaireBatchMode,
  options?: { targetContext?: TargetContext; scenarioGuidance?: ScenarioGuidance }
): QuestionnaireQuestion[] {
  const anchor = getScenarioAnchor(options);
  return FALLBACK_QUESTIONNAIRE_BATCHES[mode].map((question) => {
    if (question.questionType === "universal" || question.scenario === "通用") return { ...question };
    return {
      ...question,
      scenario: personalizeScenario(question.scenario, anchor, options?.scenarioGuidance),
    };
  });
}

function getScenarioAnchor(options?: {
  targetContext?: TargetContext;
  scenarioGuidance?: ScenarioGuidance;
}): string {
  const raw =
    options?.scenarioGuidance?.scenarioSummary ||
    options?.targetContext?.recentUse ||
    options?.targetContext?.goal ||
    "当前 AI 协作任务";
  return raw.trim().replace(/\s+/g, " ").slice(0, 24) || "当前 AI 协作任务";
}

function personalizeScenario(
  scenario: string,
  anchor: string,
  guidance?: ScenarioGuidance
): string {
  if (guidance?.granularity === "abstract") {
    return scenario.includes("调整") ? "处理调整后的 AI 任务时" : "推进重要 AI 任务时";
  }
  if (scenario.includes("当前目标")) return `围绕${anchor}时`;
  if (scenario.includes("当前任务")) return `${anchor}中`;
  if (scenario.includes("调整后的")) return `${anchor}的后续调整中`;
  return scenario;
}
