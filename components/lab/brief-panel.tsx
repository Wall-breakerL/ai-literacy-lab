import type { SceneBlueprint } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";

interface BriefPanelProps {
  scene: SceneBlueprint;
  currentStageId?: string;
}

const certaintyLabel: Record<string, string> = {
  confirmed: "已确认",
  broker_claim: "中介口径",
  mixed: "混合",
  unknown: "未知",
};

const blockerLabel: Record<string, string> = {
  pass: "可行",
  risky: "高风险",
  blocked: "可能淘汰",
  unknown: "待判",
};

const blockerClass: Record<string, string> = {
  pass: "border-emerald-500/40 bg-emerald-950/20 text-emerald-200/90",
  risky: "border-amber-500/40 bg-amber-950/25 text-amber-200/90",
  blocked: "border-rose-500/40 bg-rose-950/25 text-rose-200/90",
  unknown: "border-lab/50 bg-lab-panel/60 text-lab-muted",
};

export function BriefPanel({ scene, currentStageId }: BriefPanelProps) {
  const dc = scene.decisionContext;

  return (
    <Card className="lab-layer-panel max-h-[min(85vh,920px)] overflow-y-auto p-4">
      <Badge className="text-lab-accent">任务说明</Badge>
      <h3 className="mt-2 text-base font-semibold">{scene.titleZh}</h3>
      <p className="mt-2 text-sm text-lab-muted">{scene.briefingZh}</p>

      {currentStageId ? (
        <p className="mt-2 text-[11px] text-lab-muted/70">内部进度标记（兼容）: {currentStageId}</p>
      ) : null}

      {dc ? (
        <>
          <div className="mt-4">
            <p className="text-xs font-medium text-lab-muted">硬约束</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(dc.globalHardConstraints.length ? dc.globalHardConstraints : scene.internalFacts).map((item) => (
                <li key={item}>
                  <span className="inline-block rounded-md border border-rose-400/35 bg-rose-950/20 px-2 py-0.5 text-[11px] text-rose-100/90">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {dc.softPreferences.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-lab-muted">软偏好</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {dc.softPreferences.map((item) => (
                  <li key={item}>
                    <span className="inline-block rounded-md border border-cyan-500/30 bg-cyan-950/15 px-2 py-0.5 text-[11px] text-cyan-100/85">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(dc.userContext || dc.roommateContext) && (
            <div className="mt-4 grid gap-2 text-[12px] text-lab-muted md:grid-cols-2">
              {dc.userContext ? (
                <div className="rounded-lg border border-lab/40 bg-lab-panel/50 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-lab-muted/70">用户情境</p>
                  <p className="mt-1">{dc.userContext}</p>
                </div>
              ) : null}
              {dc.roommateContext ? (
                <div className="rounded-lg border border-lab/40 bg-lab-panel/50 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-lab-muted/70">室友情境</p>
                  <p className="mt-1">{dc.roommateContext}</p>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-medium text-lab-muted">交付物</p>
            <ul className="mt-2 space-y-1 text-sm text-lab-muted">
              {scene.deliverables.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>

          {dc.knownInfo.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs text-lab-muted">已知事实（非中介口径）</p>
              <ul className="mt-2 space-y-1 text-sm text-lab-muted">
                {dc.knownInfo.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(dc.mustVerifyQuestions.length > 0 || dc.verificationQueue.length > 0) && (
            <div className="mt-4">
              <p className="text-xs font-medium text-amber-200/90">必须核验（落实前勿当硬结论）</p>
              <ul className="mt-2 space-y-1 text-sm text-lab-muted">
                {[...new Set([...dc.mustVerifyQuestions, ...dc.verificationQueue])].map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-medium text-lab-muted">房源比对</p>
            <div className="mt-2 space-y-3">
              {dc.optionCatalog.map((opt) => (
                <div
                  className={`rounded-lg border p-3 text-sm ${blockerClass[opt.blockerStatus] ?? blockerClass.unknown}`}
                  key={opt.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-cyan-200/95">
                      {opt.id} · {opt.name}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge className="border-lab/60 text-[10px]">{certaintyLabel[opt.certaintyStatus] ?? opt.certaintyStatus}</Badge>
                      <Badge className="border-lab/60 text-[10px]">{blockerLabel[opt.blockerStatus] ?? opt.blockerStatus}</Badge>
                    </div>
                  </div>
                  <dl className="mt-2 grid gap-1 text-[11px] md:grid-cols-2">
                    <div>
                      <dt className="text-lab-muted/70">租金</dt>
                      <dd className="text-lab-muted">{opt.rent}</dd>
                    </div>
                    <div>
                      <dt className="text-lab-muted/70">通勤</dt>
                      <dd className="text-lab-muted">{opt.commute}</dd>
                    </div>
                    <div>
                      <dt className="text-lab-muted/70">采光</dt>
                      <dd className="text-lab-muted">{opt.light}</dd>
                    </div>
                    <div>
                      <dt className="text-lab-muted/70">噪音</dt>
                      <dd className="text-lab-muted">{opt.noise}</dd>
                    </div>
                    <div>
                      <dt className="text-lab-muted/70">宠物</dt>
                      <dd className="text-lab-muted">{opt.petPolicy}</dd>
                    </div>
                    <div>
                      <dt className="text-lab-muted/70">合同风险</dt>
                      <dd className="text-lab-muted">{opt.contractRisk}</dd>
                    </div>
                    <div>
                      <dt className="text-lab-muted/70">入住</dt>
                      <dd className="text-lab-muted">{opt.moveInDate}</dd>
                    </div>
                    <div>
                      <dt className="text-lab-muted/70">室友匹配</dt>
                      <dd className="text-lab-muted">{opt.roommateFit}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-lab-muted/70">押金 / 违约金</dt>
                      <dd className="text-lab-muted">{opt.depositPenalty === "unknown" ? "unknown（待核实）" : opt.depositPenalty}</dd>
                    </div>
                  </dl>
                  <div className="mt-2 text-[11px]">
                    <span className="text-lab-muted/70">已知问题：</span>
                    <span className="text-lab-muted">{opt.knownIssues.join("；")}</span>
                  </div>
                  <div className="mt-1 text-[11px]">
                    <span className="text-amber-200/80">待核验：</span>
                    <span className="text-lab-muted">{opt.unknownsToVerify.join("；")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-xs text-lab-muted">要点</p>
            <ul className="mt-2 space-y-1 text-sm text-lab-muted">
              {scene.internalFacts.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <p className="text-xs text-lab-muted">交付物</p>
            <ul className="mt-2 space-y-1 text-sm text-lab-muted">
              {scene.deliverables.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      <p className="mt-4 rounded-lg border border-lab/60 bg-lab-card/40 px-2 py-1.5 text-[11px] text-lab-muted">
        结束本段场景：在输入框单独发送{" "}
        <code className="rounded bg-lab-panel px-1 text-cyan-200/90">{COMPLETE_SCENE_SIGNAL}</code>（原型约定，非自然语言）。
      </p>
    </Card>
  );
}
