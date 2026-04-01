interface TypingIndicatorProps {
  stageId?: string;
  stageIndex?: number;
  stageTotal?: number;
}

const STAGE_HINTS: Record<string, string> = {
  brief: "正在理解任务背景...",
  criteria: "正在帮你梳理思路...",
  compare: "正在对比方案...",
  cluster: "正在聚类分析...",
  ideate: "正在发散命名方向...",
  stress_test: "正在压力测试你的选择...",
  decide: "正在整理结论...",
  finalize: "正在生成最终方案...",
};

export function TypingIndicator({ stageId, stageIndex, stageTotal }: TypingIndicatorProps) {
  const hint = stageId ? (STAGE_HINTS[stageId] ?? "正在组织回应...") : "正在组织回应...";
  const progressLabel = stageIndex !== undefined && stageTotal !== undefined
    ? ` 第 ${stageIndex + 1}/${stageTotal} 阶段`
    : null;

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-lab bg-lab-panel px-3 py-2 text-xs text-lab-muted">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:240ms]" />
      Agent A {hint}{progressLabel}
    </div>
  );
}
