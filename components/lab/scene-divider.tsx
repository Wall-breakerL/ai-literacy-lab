import type { SceneId } from "@/domain";

interface SceneDividerProps {
  fromSceneId: SceneId;
  toSceneId: SceneId;
  timestamp: string;
}

export function SceneDivider({ timestamp, fromSceneId: _from, toSceneId: _to }: SceneDividerProps) {
  void _from;
  void _to;
  return (
    <div className="my-4 rounded-xl border border-lab/60 bg-lab-panel/80 p-4">
      <p className="text-[11px] text-lab-muted">{timestamp}</p>
      <p className="mt-1 text-sm text-lab-muted">接下来我们换个话题继续聊。</p>
      <div className="mt-3 h-px bg-[rgb(var(--lab-border))]/70" />
    </div>
  );
}
