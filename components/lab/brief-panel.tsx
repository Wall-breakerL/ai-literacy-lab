import type { SceneBlueprint } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";

interface BriefPanelProps {
  scene: SceneBlueprint;
  /** Current engine stage id for this scene (optional). */
  currentStageId?: string;
}

function stageGoalZh(scene: SceneBlueprint, stageId: string | undefined): string | null {
  if (!stageId) return null;
  const map: Record<string, string> = {
    brief: "理解约束与四套房源差异，明确你要我协助核对哪些信息。",
    criteria: "列出硬约束与软约束，并说明各自优先级。",
    compare: "至少对比两套房源，在同一维度上说明取舍理由。",
    stress_test: "在新增约束或风险下调整排序，并说明改变了什么。",
    decide: "给出完整排序、最推荐/最不推荐、权重理由，以及待核验问题清单。",
  };
  return map[stageId] ?? null;
}

export function BriefPanel({ scene, currentStageId }: BriefPanelProps) {
  const dc = scene.decisionContext;
  const knownList = [...scene.internalFacts, ...(dc?.knownInfo ?? [])];
  const stageHint = stageGoalZh(scene, currentStageId);

  return (
    <Card className="lab-layer-panel max-h-[min(85vh,920px)] overflow-y-auto p-4">
      <Badge className="text-lab-accent">任务说明</Badge>
      <h3 className="mt-2 text-base font-semibold">{scene.titleZh}</h3>
      <p className="mt-2 text-sm text-lab-muted">{scene.briefingZh}</p>

      {stageHint ? (
        <div className="mt-4 rounded-lg border border-lab/50 bg-lab-card/50 px-3 py-2">
          <p className="text-xs text-lab-muted">本阶段目标</p>
          <p className="mt-1 text-sm text-lab-muted/95">{stageHint}</p>
          {currentStageId ? (
            <p className="mt-1 text-[11px] text-lab-muted/70">当前阶段：{currentStageId}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-xs text-lab-muted">本场景交付物</p>
        <ul className="mt-2 space-y-1 text-sm">
          {scene.deliverables.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs text-lab-muted">已知信息</p>
        <ul className="mt-2 space-y-1 text-sm text-lab-muted">
          {knownList.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      {dc?.verificationQueue && dc.verificationQueue.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-amber-200/90">待核验（需追问后才能当作决策依据）</p>
          <ul className="mt-2 space-y-1 text-sm text-lab-muted">
            {dc.verificationQueue.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {dc?.optionCatalog && dc.optionCatalog.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-lab-muted">可选房源（完整对比）</p>
          <div className="mt-2 space-y-3">
            {dc.optionCatalog.map((opt) => (
              <div className="rounded-lg border border-lab/40 bg-lab-panel/60 p-3 text-sm" key={opt.id}>
                <p className="font-semibold text-cyan-200/90">
                  {opt.id} · {opt.name}
                </p>
                <dl className="mt-2 grid gap-1 text-[12px] text-lab-muted md:grid-cols-2">
                  <div>
                    <dt className="text-lab-muted/70">租金</dt>
                    <dd>{opt.rent}</dd>
                  </div>
                  <div>
                    <dt className="text-lab-muted/70">通勤</dt>
                    <dd>{opt.commute}</dd>
                  </div>
                  <div>
                    <dt className="text-lab-muted/70">采光</dt>
                    <dd>{opt.light}</dd>
                  </div>
                  <div>
                    <dt className="text-lab-muted/70">噪音</dt>
                    <dd>{opt.noise}</dd>
                  </div>
                  <div>
                    <dt className="text-lab-muted/70">宠物条款</dt>
                    <dd>{opt.petPolicy}</dd>
                  </div>
                  <div>
                    <dt className="text-lab-muted/70">合同风险</dt>
                    <dd>{opt.contractRisk}</dd>
                  </div>
                  <div>
                    <dt className="text-lab-muted/70">入住</dt>
                    <dd>{opt.moveInDate}</dd>
                  </div>
                  <div>
                    <dt className="text-lab-muted/70">室友匹配</dt>
                    <dd>{opt.roommateFit}</dd>
                  </div>
                </dl>
                <div className="mt-2 text-[12px]">
                  <span className="text-lab-muted/70">已知问题：</span>
                  <span className="text-lab-muted">{opt.knownIssues.join("；")}</span>
                </div>
                <div className="mt-1 text-[12px]">
                  <span className="text-amber-200/80">待核验：</span>
                  <span className="text-lab-muted">{opt.unknownsToVerify.join("；")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 rounded-lg border border-lab/60 bg-lab-card/40 px-2 py-1.5 text-[11px] text-lab-muted">
        结束本段场景：在输入框单独发送{" "}
        <code className="rounded bg-lab-panel px-1 text-cyan-200/90">{COMPLETE_SCENE_SIGNAL}</code>（原型约定，非自然语言）。
      </p>
    </Card>
  );
}
