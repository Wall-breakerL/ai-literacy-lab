import { getFallbackPromptTemplate, getReportTaskLabel } from "@/lib/reportDisplayContext";
import type { ReportToolbox, TargetContext } from "@/lib/types";

export function completeReportToolbox(
  toolbox: ReportToolbox | undefined,
  targetContext: TargetContext
): Required<ReportToolbox> {
  const taskLabel = getReportTaskLabel(targetContext);
  const promptTemplates = validPromptTemplates(toolbox?.promptTemplates);
  const checklists = validChecklists(toolbox?.checklists);
  const workflow = validWorkflow(toolbox?.workflow);

  return {
    promptTemplates: promptTemplates.length > 0 ? promptTemplates : [fallbackPromptTemplate(targetContext)],
    checklists: checklists.length > 0 ? checklists : fallbackChecklists(taskLabel),
    workflow: workflow ?? fallbackWorkflow(taskLabel),
  };
}

function validPromptTemplates(value: ReportToolbox["promptTemplates"]): Required<ReportToolbox>["promptTemplates"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((template) => {
    if (!template?.title || !template.useCase || !template.prompt) return [];
    return [{
      title: template.title,
      useCase: template.useCase,
      prompt: template.prompt,
      tags: Array.isArray(template.tags) ? template.tags.filter(Boolean).slice(0, 3) : ["可复制"],
    }];
  }).slice(0, 5);
}

function validChecklists(value: ReportToolbox["checklists"]): Required<ReportToolbox>["checklists"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((checklist) => {
    const items = Array.isArray(checklist?.items) ? checklist.items.filter(Boolean).slice(0, 5) : [];
    if (!checklist?.title || items.length === 0) return [];
    return [{ title: checklist.title, items }];
  }).slice(0, 2);
}

function validWorkflow(value: ReportToolbox["workflow"]): Required<ReportToolbox>["workflow"] | undefined {
  const steps = Array.isArray(value?.steps) ? value.steps.filter((step) => step?.action && step.detail && step.time) : [];
  if (!value?.title || steps.length === 0) return undefined;
  return {
    title: value.title,
    steps: steps.slice(0, 7).map((step, index) => ({
      step: Number.isFinite(step.step) ? step.step : index + 1,
      action: step.action,
      detail: step.detail,
      time: step.time,
    })),
    totalTime: value.totalTime || "约 20 分钟",
    basedOn: value.basedOn,
  };
}

function fallbackPromptTemplate(targetContext: TargetContext): Required<ReportToolbox>["promptTemplates"][number] {
  const template = getFallbackPromptTemplate(targetContext);
  return {
    ...template,
    tags: ["可复制", "任务启动"],
  };
}

function fallbackChecklists(taskLabel: string): Required<ReportToolbox>["checklists"] {
  return [
    {
      title: `开始「${taskLabel}」前`,
      items: [
        "先写清楚这次要完成的具体结果",
        "列出 2 个最不能出错的判断标准",
        "让 AI 复述任务目标和限制条件",
        "确认第一版输出只做结构或方向验证",
      ],
    },
    {
      title: "使用 AI 后检查",
      items: [
        "标出 AI 输出里最不确定的一处",
        "把关键结论和原始需求逐条对照",
        "只保留能解释清楚来源的建议",
        "下一轮只改一个最重要的问题",
      ],
    },
  ];
}

function fallbackWorkflow(taskLabel: string): Required<ReportToolbox>["workflow"] {
  return {
    title: `适合你的「${taskLabel}」协作流程`,
    steps: [
      {
        step: 1,
        action: "明确目标",
        detail: "先把本次任务的完成标准和边界写成 3 条。",
        time: "2 分钟",
      },
      {
        step: 2,
        action: "让 AI 复述",
        detail: "要求 AI 复述任务，并列出它认为仍不确定的点。",
        time: "3 分钟",
      },
      {
        step: 3,
        action: "先看框架",
        detail: "第一轮只生成结构、方案或检查清单，不急着要完整成品。",
        time: "5 分钟",
      },
      {
        step: 4,
        action: "验证关键点",
        detail: "挑出最影响结果的一处事实、逻辑或约束先验证。",
        time: "5 分钟",
      },
      {
        step: 5,
        action: "局部迭代",
        detail: "确认方向后再让 AI 补齐细节，并保留你的修改记录。",
        time: "5 分钟",
      },
    ],
    totalTime: "约 20 分钟",
    basedOn: "本地兜底工具箱",
  };
}
