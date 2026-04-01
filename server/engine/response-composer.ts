import type { TailType } from "@/domain/probes/types";

export interface AgentAResponse {
  content: string;
  tailQuestion?: string;
}

export function buildTailQuestion(tailType: TailType): string {
  if (tailType === "priority") return "你更想先定标准，还是先看候选？";
  if (tailType === "comparison") return "要不要我先做成比较矩阵？";
  if (tailType === "uncertainty") return "这里有个未知点，你想先按保守假设排，还是先列追问问题？";
  return "这版你更想让我重做框架，还是沿着当前版本局部修补？";
}

export function composeAgentAResponse(input: {
  knownFacts: string[];
  openUnknowns: string[];
  currentDraft: string;
  nextMove: string;
  tailType?: TailType;
}): AgentAResponse {
  const core = [
    `已知：${input.knownFacts.slice(0, 2).join("；") || "暂无"}`,
    `未知：${input.openUnknowns.slice(0, 1).join("；") || "暂无"}`,
    `草案：${input.currentDraft}`,
    `下一步：${input.nextMove}`,
  ].join("。");
  return {
    content: core.slice(0, 140),
    tailQuestion: input.tailType ? buildTailQuestion(input.tailType) : undefined,
  };
}

