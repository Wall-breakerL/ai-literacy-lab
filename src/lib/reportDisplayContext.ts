import type { PromptTemplate, TargetContext } from "@/lib/types";

const PLACEHOLDER_GOALS = new Set([
  "更有效地使用 AI",
  "更有效地使用AI",
  "提升 AI 使用效率",
  "提升AI使用效率",
]);

const GENERIC_RECENT_USES = new Set([
  "使用 AI 完成日常任务",
  "使用AI完成日常任务",
  "日常使用 AI",
  "日常使用AI",
]);

const PERSONALITY_NEXT_ACTIONS: Record<string, string> = {
  IFAG: "下次先让 AI 画出整体结构和关键风险，再从最高风险的一块开始细化。",
  IFAL: "下次先让 AI 把目标拆成蓝图、步骤和验收标准，再逐块推进。",
  IFTG: "下次先让 AI 列出它最不确定的 3 个判断，你只检查这些关键点。",
  IFTL: "下次先让 AI 按你的规则产出第一版，再只改最影响交付的一处。",
  IEAG: "下次先让 AI 给出 3 条完全不同的路线，再选一条继续深挖。",
  IEAL: "下次先让 AI 写 2 个风格不同的小样，你挑更顺手的方向继续改。",
  IETG: "下次先让 AI 快速试做一个粗版本，再用结果反推下一轮怎么问。",
  IETL: "下次先让 AI 生成一版可改素材，你只圈出最值得保留和微调的部分。",
  CFAG: "下次先让 AI 复述你的全局目标，再列出会影响决策的关键变量。",
  CFAL: "下次先让 AI 把任务拆成负责人、步骤和交付物，再开始生成内容。",
  CFTG: "下次先让 AI 给出整体方案和取舍理由，你只决定先推进哪条线。",
  CFTL: "下次先让 AI 交付一个可用初版，再按你的反馈做小步修正。",
  CEAG: "下次先让 AI 和你一起比较 3 个策略选项，再决定要押注哪一个。",
  CEAL: "下次先让 AI 先复述双方目标和限制，再提出一个折中推进方案。",
  CETG: "下次先让 AI 生成几条探索路线，你先选最有潜力的一条试跑。",
  CETL: "下次先让 AI 给出 3 个实现方向，你选一个最顺眼的继续迭代。",
};

export function normalizeReportTaskLabel(value: string | undefined, fallback = "AI 协作任务"): string {
  const clean = normalizeAiText(value ?? "");
  if (!clean || GENERIC_RECENT_USES.has(clean)) return fallback;

  const withoutPrefix = clean
    .replace(/^(我)?(平时|最近|日常)?主要/, "")
    .replace(/^(我)?(平时|最近|日常)?/, "")
    .trim();
  const aiUseMatch = withoutPrefix.match(/^(?:会)?(?:用|使用|拿)\s*AI\s*(?:来|去)?(.+)$/i);
  if (aiUseMatch?.[1]) {
    const task = aiUseMatch[1].trim().replace(/^主要/, "").trim();
    return task ? `AI 辅助${task}` : fallback;
  }

  return withoutPrefix || fallback;
}

export function getDisplayGoalLabel(targetContext: TargetContext): string | undefined {
  const goal = normalizeAiText(targetContext.goal);
  if (!goal || targetContext.goalStatus === "missing" || PLACEHOLDER_GOALS.has(goal)) return undefined;
  return goal;
}

export function getReportTaskLabel(targetContext?: TargetContext): string {
  return normalizeReportTaskLabel(targetContext?.recentUse ?? targetContext?.goal);
}

export function getPersonalityNextAction(code: string | undefined): string {
  return PERSONALITY_NEXT_ACTIONS[code ?? ""] ?? PERSONALITY_NEXT_ACTIONS.CEAL;
}

export function getFallbackPromptTemplate(targetContext?: TargetContext): PromptTemplate {
  const taskLabel = getReportTaskLabel(targetContext);

  return {
    title: "三路试跑",
    useCase: "刚起步，还不想直接定稿时",
    prompt: `我在做 ${taskLabel}。你先别直接写完整答案，先给我 3 个不同推进方向，每个用一句话说明适合什么情况。我挑一个后，你再展开成第一版；如果你发现有信息不确定，就直接标出来等我确认。`,
  };
}

export function hasAwkwardReportContextText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = normalizeAiText(value);
  return (
    /主要用\s*AI/i.test(text) ||
    PLACEHOLDER_GOALS.has(text) ||
    text.includes("更有效地使用 AI") ||
    /使用 AI[」”"']?使用 AI/.test(text)
  );
}

function normalizeAiText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/ai/g, "AI")
    .trim();
}
