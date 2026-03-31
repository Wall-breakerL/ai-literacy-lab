"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ContextVariationNote } from "@/components/result/context-variation-note";
import { EvidenceCards } from "@/components/result/evidence-cards";
import { ExportActions } from "@/components/result/export-actions";
import { FaaChart } from "@/components/result/faa-chart";
import { MbtiBars } from "@/components/result/mbti-bars";
import { SceneContribution } from "@/components/result/scene-contribution";
import { TypeCard } from "@/components/result/type-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { buildSessionResult } from "@/server/services/build-session-result";
import { useAssessmentUiStore } from "@/stores/assessment-ui-store";

export default function ResultPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const { snapshot, events, loading, error, loadSession } = useAssessmentUiStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    void loadSession(sessionId);
  }, [loadSession, sessionId]);
  const result = useMemo(() => (snapshot ? buildSessionResult(snapshot, events) : null), [events, snapshot]);

  if (!snapshot && loading) {
    return <main className="mx-auto max-w-4xl px-6 py-16 text-lab-muted">正在加载结果...</main>;
  }

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-3 text-rose-300">{error ?? "结果不可用"}</p>
        <Link className="text-lab-accent hover:underline" href="/">
          返回首页
        </Link>
      </main>
    );
  }

  const bothScenesCompleted = snapshot.sceneStates.every((scene) => scene.completed);
  if (snapshot.assessmentState !== "completed" || !bothScenesCompleted) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-3 text-2xl font-semibold">结果尚未解锁</h1>
        <p className="mb-5 text-lab-muted">你需要先完成第二个任务（品牌命名冲刺）后才能访问结果页。</p>
        <Link className="text-lab-accent hover:underline" href={`/lab/${sessionId}`}>
          返回测评流程
        </Link>
      </main>
    );
  }
  if (!result) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-rose-300">结果构建失败。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <Panel>
        <Badge className="text-lab-accent">原型结果概览</Badge>
        <h1 className="mt-2 text-2xl font-semibold">协作结果摘要</h1>
        <p className="mt-2 text-sm text-lab-muted">
          当前为原型版结果解释，主要用于体验流程与交互反馈，不代表正式模型能力或最终评估结论。
        </p>
      </Panel>

      <TypeCard lowConfidenceNotes={result.lowConfidenceNotes} summary={result.summary} typeCode={result.mbtiTypeCode} />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="lab-layer-panel p-4">
          <p className="text-xs text-lab-muted">关键优势</p>
          <ul className="mt-2 space-y-1 text-sm text-lab-muted">
            {result.strengths.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </Card>
        <Card className="lab-layer-panel p-4">
          <p className="text-xs text-lab-muted">成长空间</p>
          <ul className="mt-2 space-y-1 text-sm text-lab-muted">
            {result.blindspots.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </Card>
        <Card className="lab-layer-panel p-4">
          <p className="text-xs text-lab-muted">实用建议</p>
          <ul className="mt-2 space-y-1 text-sm text-lab-muted">
            {result.suggestions.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </Card>
      </section>

      <EvidenceCards items={result.evidenceCards} />

      <Card className="lab-layer-panel p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-lab-muted">高级分析（研究与开发视角）</p>
          <Button onClick={() => setShowAdvanced((prev) => !prev)} variant="subtle">
            {showAdvanced ? "收起" : "展开"}
          </Button>
        </div>
        {showAdvanced ? (
          <div className="mt-4 space-y-6">
            <section className="grid gap-6 lg:grid-cols-2">
              <MbtiBars axes={result.mbtiAxes} />
              <FaaChart dimensions={result.faaDimensions} overall={result.faaOverall} />
            </section>

            <SceneContribution items={result.sceneContribution} />
            <ContextVariationNote items={result.contextVariation} />
            <ExportActions resultJson={result} sessionId={sessionId} shareCopy={result.shareCopy} />
            <div className="rounded-lg border border-lab bg-lab-panel p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-lab-muted">审计视图（原始技术数据）</p>
                <Button className="px-2 py-1 text-xs" onClick={() => setShowAudit((prev) => !prev)} variant="subtle">
                  {showAudit ? "隐藏" : "展开"}
                </Button>
              </div>
              {showAudit ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-lab bg-lab-panel p-3">
                    <p className="text-xs text-lab-muted">raw snapshot</p>
                    <pre className="mt-2 max-h-72 overflow-auto text-[11px]">{JSON.stringify(result.audit.rawSnapshot, null, 2)}</pre>
                  </div>
                  <div className="rounded-lg border border-lab bg-lab-panel p-3">
                    <p className="text-xs text-lab-muted">probe timeline</p>
                    <pre className="mt-2 max-h-72 overflow-auto text-[11px]">{JSON.stringify(result.audit.probeTimeline, null, 2)}</pre>
                  </div>
                  <div className="rounded-lg border border-lab bg-lab-panel p-3">
                    <p className="text-xs text-lab-muted">scene delta sources</p>
                    <pre className="mt-2 max-h-72 overflow-auto text-[11px]">{JSON.stringify(result.audit.sceneDeltaSources, null, 2)}</pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
