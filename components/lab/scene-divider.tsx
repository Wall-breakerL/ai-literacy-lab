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
    <div className="my-4 rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-950/35 to-indigo-950/35 p-4">
      <p className="type-code text-[11px] text-cyan-200">{timestamp}</p>
      <p className="mt-1 text-sm">
        {SCENE_TITLE[fromSceneId]}已完成，进入{SCENE_TITLE[toSceneId]}
      </p>
      <div className="mt-3 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
    </div>
  );
}
