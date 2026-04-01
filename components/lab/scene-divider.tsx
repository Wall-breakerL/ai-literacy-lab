import type { SceneId } from "@/domain";

interface SceneDividerProps {
  fromSceneId: SceneId;
  toSceneId: SceneId;
  timestamp: string;
}

const SCENE_TITLES: Record<SceneId, string> = {
  "apartment-tradeoff": "公寓选择权衡",
  "brand-naming-sprint": "品牌命名冲刺",
};

const TRANSITION_CONTENT: Record<string, { gained: string; nextHint: string }> = {
  "apartment-tradeoff:brand-naming-sprint": {
    gained: "刚才的权衡任务锻炼了你界定约束、分清主次的能力",
    nextHint: "接下来换个思路：从决策切换到创意——我们一起给一个产品起名字",
  },
  "brand-naming-sprint:apartment-tradeoff": {
    gained: "命名冲刺完成，你经历了从发散到收敛的过程",
    nextHint: "回到任务流程",
  },
};

export function SceneDivider({ fromSceneId, toSceneId, timestamp }: SceneDividerProps) {
  const key = `${fromSceneId}:${toSceneId}`;
  const content = TRANSITION_CONTENT[key] ?? {
    gained: "已完成上一阶段",
    nextHint: "继续推进",
  };

  return (
    <div className="my-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
      <p className="text-[11px] text-lab-muted">{timestamp}</p>
      <div className="mt-2 flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          <svg className="h-4 w-4 text-cyan-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm text-cyan-200/90">{content.nextHint}</p>
          <p className="text-xs text-lab-muted/80">{content.gained}。</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-lab-muted">
        <span className="rounded bg-lab-panel px-1.5 py-0.5">{SCENE_TITLES[fromSceneId]}</span>
        <span>→</span>
        <span className="rounded bg-cyan-950/40 px-1.5 py-0.5 text-cyan-200/80">{SCENE_TITLES[toSceneId]}</span>
      </div>
    </div>
  );
}
