import type { SceneId } from "@/domain";

const SCENE_TITLE: Record<SceneId, string> = {
  "apartment-tradeoff": "第一段：租房权衡决策",
  "brand-naming-sprint": "第二段：品牌命名冲刺",
};

interface SceneDividerProps {
  fromSceneId: SceneId;
  toSceneId: SceneId;
  timestamp: string;
}

export function SceneDivider({ fromSceneId, toSceneId, timestamp }: SceneDividerProps) {
  return (
    <div className="my-4 rounded-xl border border-lab bg-lab-panel p-4">
      <p className="text-[11px] text-lab-muted">{timestamp}</p>
      <p className="mt-1 text-sm">
        {SCENE_TITLE[fromSceneId]}已完成，进入{SCENE_TITLE[toSceneId]}
      </p>
      <div className="mt-3 h-px bg-[rgb(var(--lab-border))]/70" />
    </div>
  );
}
