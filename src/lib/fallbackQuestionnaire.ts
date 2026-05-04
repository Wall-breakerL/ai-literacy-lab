import type {
  QuestionnaireBatchMode,
  QuestionnaireQuestion,
  ScenarioGuidance,
  TargetContext,
} from "@/lib/types";

/**
 * Legacy single-questionnaire fallback：每维 4 题（含正反向），共 16 题。
 * 当前 AI-MBTI 主链路使用下方两部分 8+16 题 fallback。
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
    reverse: true,
  },
  {
    dimension: "Workflow",
    scenario: "面对一个有点模糊的需求",
    question: "我更喜欢先扔一个大概想法给 AI，边试边改，而不是先列完整方案。",
    reverse: false,
  },
  {
    dimension: "Workflow",
    scenario: "协作写文档或写代码时",
    question: "我会先定目录/接口/清单，再让 AI 填充，避免一开始就发散。",
    reverse: true,
  },
  {
    dimension: "Workflow",
    scenario: "探索一个不熟悉的领域时",
    question: "我宁愿快速试几种提法，也不太想先写一大份规格说明。",
    reverse: false,
  },
  // Epistemic ×4
  {
    dimension: "Epistemic",
    scenario: "AI 给出一个看起来合理的结论时",
    question: "我通常会再查证、对比其他来源，而不是直接采用。",
    reverse: true,
  },
  {
    dimension: "Epistemic",
    scenario: "赶进度、结果看起来没问题时",
    question: "我经常直接使用 AI 的答案，不再额外验证。",
    reverse: false,
  },
  {
    dimension: "Epistemic",
    scenario: "涉及风险或重要决策时",
    question: "我会刻意检查 AI 的推理链条和引用是否靠谱。",
    reverse: true,
  },
  {
    dimension: "Epistemic",
    scenario: "日常琐事或非关键任务",
    question: "我倾向于相信 AI 的表述，很少挑错。",
    reverse: false,
  },
  // RepairScope ×4
  {
    dimension: "RepairScope",
    scenario: "发现 AI 输出有明显错误时",
    question: "我倾向于在现有结果上局部修改、迭代，而不是推倒重来。",
    reverse: false,
  },
  {
    dimension: "RepairScope",
    scenario: "多轮对话里越改越乱时",
    question: "我更愿意清空上下文、重新描述问题，从头再试一遍。",
    reverse: true,
  },
  {
    dimension: "RepairScope",
    scenario: "AI 生成的内容需要大改时",
    question: "我会一块块改，尽量保留可用的部分。",
    reverse: false,
  },
  {
    dimension: "RepairScope",
    scenario: "结果离预期差很远时",
    question: "我第一反应是整段删掉、换提问方式重来，而不是微调句子。",
    reverse: true,
  },
];

export const FALLBACK_QUESTIONNAIRE_BATCHES: Record<QuestionnaireBatchMode, QuestionnaireQuestion[]> = {
  hybrid_batch1: [
    // Relation ×2 (all forward)
    {
      dimension: "Relation",
      scenario: "习惯",
      question: "我习惯把 AI 当成一起打磨思路的协作者，而不是只负责交付结果的工具。",
      reverse: false,
    },
    {
      dimension: "Relation",
      scenario: "需要快速完成当前任务时",
      question: "即使需要快速完成任务，我也希望 AI 能补充判断或提醒我可能忽略的取舍。",
      reverse: false,
    },
    // Workflow ×2 (all forward)
    {
      dimension: "Workflow",
      scenario: "习惯",
      question: "我习惯先给 AI 一个大方向，再通过多轮尝试逐步靠近想要的结果。",
      reverse: false,
    },
    {
      dimension: "Workflow",
      scenario: "当前任务需要稳定交付时",
      question: "即使任务需要稳定交付，我也愿意先让 AI 试几个切入方向，再从中收敛。",
      reverse: false,
    },
    // Epistemic ×2 (all forward)
    {
      dimension: "Epistemic",
      scenario: "习惯",
      question: "我习惯在 AI 的答案看起来顺畅时直接采纳，不会逐条核验。",
      reverse: false,
    },
    {
      dimension: "Epistemic",
      scenario: "当前任务涉及重要判断时",
      question: "如果 AI 对重要判断的说明足够清楚，我会先采纳它，再在推进中校正。",
      reverse: false,
    },
    // RepairScope ×2 (all forward)
    {
      dimension: "RepairScope",
      scenario: "习惯",
      question: "我习惯在 AI 已有输出上局部修改，尽量保留其中可用的部分。",
      reverse: false,
    },
    {
      dimension: "RepairScope",
      scenario: "当前任务越改越乱时",
      question: "即使当前任务越改越乱，我也会先找还能保留的部分，再让 AI 局部修正。",
      reverse: false,
    },
  ],
  hybrid_batch2: [
    // Relation ×4 (2习惯 + 2场景)
    {
      dimension: "Relation",
      scenario: "习惯",
      question: "我习惯把 AI 当成执行指令的工具，尽量少和它讨论过程。",
      reverse: true,
    },
    {
      dimension: "Relation",
      scenario: "习惯",
      question: "我更希望 AI 严格执行我的安排，不要主动改变任务方向。",
      reverse: true,
    },
    {
      dimension: "Relation",
      scenario: "调整后的 AI 协作场景中",
      question: "我会自然地让 AI 参与判断和取舍，而不只是等待我下达具体命令。",
      reverse: false,
    },
    {
      dimension: "Relation",
      scenario: "处理调整后的任务时",
      question: "我会让 AI 一起比较不同方案的取舍，再决定下一步怎么推进。",
      reverse: false,
    },
    // Workflow ×4 (2习惯 + 2场景)
    {
      dimension: "Workflow",
      scenario: "习惯",
      question: "我愿意让 AI 先探索多个版本，再从中挑选和收敛。",
      reverse: false,
    },
    {
      dimension: "Workflow",
      scenario: "习惯",
      question: "我习惯先写清楚目标、边界和步骤，再让 AI 在框架里完成任务。",
      reverse: true,
    },
    {
      dimension: "Workflow",
      scenario: "打磨调整后的任务方案时",
      question: "我会先让 AI 尝试不同切入点，再判断哪个方向值得继续。",
      reverse: false,
    },
    {
      dimension: "Workflow",
      scenario: "需要把调整后的任务稳定交付时",
      question: "我会先把流程和格式固定下来，再让 AI 按照这个框架工作。",
      reverse: true,
    },
    // Epistemic ×4 (2习惯 + 2场景)
    {
      dimension: "Epistemic",
      scenario: "习惯",
      question: "我习惯检查 AI 的依据、推理和遗漏，再决定是否采用它的结论。",
      reverse: true,
    },
    {
      dimension: "Epistemic",
      scenario: "习惯",
      question: "如果 AI 给出的判断能推进任务，我会先相信它并继续往下做。",
      reverse: false,
    },
    {
      dimension: "Epistemic",
      scenario: "当前任务涉及重要判断时",
      question: "我会要求 AI 说明依据，并自己复核关键结论是否可靠。",
      reverse: true,
    },
    {
      dimension: "Epistemic",
      scenario: "处理调整后的任务时",
      question: "如果 AI 的判断能解释清楚并推进任务，我会先采纳它再边做边校正。",
      reverse: false,
    },
    // RepairScope ×4 (2习惯 + 2场景)
    {
      dimension: "RepairScope",
      scenario: "习惯",
      question: "我会优先在已有答案里找可保留的部分，再让 AI 做局部修正。",
      reverse: false,
    },
    {
      dimension: "RepairScope",
      scenario: "习惯",
      question: "当输出方向明显不对时，我会换一种提法重新开始。",
      reverse: true,
    },
    {
      dimension: "RepairScope",
      scenario: "修正已调整的 AI 输出时",
      question: "我会沿着已有输出逐段修正，让 AI 继续在原方向上迭代。",
      reverse: false,
    },
    {
      dimension: "RepairScope",
      scenario: "当前任务的输出有偏差时",
      question: "我会重新描述需求，让 AI 从新的框架开始生成。",
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
    if (question.scenario === "习惯") return { ...question };
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
    options?.targetContext?.goal ||
    options?.targetContext?.recentUse ||
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
