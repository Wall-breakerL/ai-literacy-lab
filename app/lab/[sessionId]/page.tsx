"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { AssessmentProgress } from "@/components/lab/assessment-progress";
import { AssessmentShell } from "@/components/lab/assessment-shell";
import { BriefPanel } from "@/components/lab/brief-panel";
import { ChecklistPanel } from "@/components/lab/checklist-panel";
import { Composer } from "@/components/lab/composer";
import { DebugDrawer } from "@/components/lab/debug-drawer";
import { MessageList } from "@/components/lab/message-list";
import { QuickActions } from "@/components/lab/quick-actions";
import { SceneProgress } from "@/components/lab/scene-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { SCENE_BLUEPRINT_BY_ID } from "@/domain";
import { useSessionRecovery } from "@/hooks/use-session-recovery";
import { useSessionTurn } from "@/hooks/use-session-turn";
import { useAssessmentUiStore } from "@/stores/assessment-ui-store";
import { useLabUiStore } from "@/stores/lab-ui-store";

export default function LabSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId;
  const debugEnabledByQuery = searchParams.get("debug") === "1";

  const { snapshot, events, loading, error } = useAssessmentUiStore();
  const { reload } = useSessionRecovery(sessionId);
  const { submitTurn } = useSessionTurn(sessionId);
  const {
    isDebugOpen,
    isThinking,
    transitionError,
    lastTurnOutput,
    isLeftDrawerOpen,
    isRightDrawerOpen,
    setDebugOpen,
    setLeftDrawerOpen,
    setRightDrawerOpen,
    setTransitionError,
  } = useLabUiStore();

  const activeScene = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.sceneStates.find((scene) => scene.sceneId === snapshot.currentSceneId) ?? null;
  }, [snapshot]);

  useEffect(() => {
    if (debugEnabledByQuery) {
      setDebugOpen(true);
    }
  }, [debugEnabledByQuery, setDebugOpen]);

  const activeSceneBlueprint = activeScene ? SCENE_BLUEPRINT_BY_ID[activeScene.sceneId] : null;
  const stageByScene = useMemo(
    () =>
      snapshot
        ? snapshot.sceneStates.reduce<Record<string, string>>((acc, item) => {
            acc[item.sceneId] = item.stageId;
            return acc;
          }, {})
        : {},
    [snapshot],
  );

  useEffect(() => {
    const completedApartment = events.some(
      (event) => event.type === "SCENE_COMPLETED" && event.payload.sceneId === "apartment-tradeoff",
    );
    const enteredBrand = events.some(
      (event) => event.type === "SCENE_ENTERED" && event.payload.sceneId === "brand-naming-sprint",
    );
    if (completedApartment && !enteredBrand) {
      setTransitionError("场景过渡异常：已完成第一段但未进入第二段。请刷新会话。");
      return;
    }
    setTransitionError(null);
  }, [events, setTransitionError]);

  if (!snapshot && loading) {
    return <main className="mx-auto max-w-4xl px-6 py-16 text-lab-muted">正在加载会话...</main>;
  }

  if (!snapshot || !activeScene || !activeSceneBlueprint) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-4 text-rose-300">{error ?? "会话不可用"}</p>
        <Link className="text-lab-accent hover:underline" href="/">
          返回首页
        </Link>
        <Button className="ml-3" onClick={() => void reload()} variant="subtle">
          重试加载
        </Button>
      </main>
    );
  }

  const handleTurn = async (message: string) => {
    const ok = await submitTurn(message);
    if (!ok) {
      setTransitionError("turn 提交中断，请重试。");
    }
  };

  const interludeVisible =
    events.some((event) => event.type === "SCENE_COMPLETED" && event.payload.sceneId === "apartment-tradeoff") &&
    snapshot.currentSceneId === "brand-naming-sprint";

  return (
    <AssessmentShell
      center={
        <Panel className="lab-layer-panel flex h-full flex-col gap-3 p-4">
          <div className="mb-2 flex items-center justify-between">
            <Badge className="text-lab-accent">统一时间线</Badge>
            <div className="flex items-center gap-2">
              <Button className="px-2 py-1 text-xs lg:hidden" onClick={() => setLeftDrawerOpen(!isLeftDrawerOpen)} variant="subtle">
                Brief
              </Button>
              <Button className="px-2 py-1 text-xs lg:hidden" onClick={() => setRightDrawerOpen(!isRightDrawerOpen)} variant="subtle">
                Checklist
              </Button>
              <Button className="px-2 py-1 text-xs" onClick={() => setDebugOpen(!isDebugOpen)} variant="subtle">
                Debug
              </Button>
            </div>
          </div>

          {transitionError ? (
            <div className="rounded-lg border border-rose-300/40 bg-rose-950/25 px-3 py-2 text-sm text-rose-200">
              {transitionError}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-rose-300/40 bg-rose-950/25 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {interludeVisible ? (
            <div className="rounded-xl border border-cyan-300/35 bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 p-4">
              <p className="type-code text-xs text-cyan-200">INTERLUDE</p>
              <p className="mt-1 text-sm">第一段输出已锁定，系统正在将你的决策风格迁移到第二段品牌命名冲刺。</p>
            </div>
          ) : null}

          <MessageList events={events} isThinking={isThinking || loading} stageByScene={stageByScene} />
          <QuickActions disabled={loading} onAction={handleTurn} />
          <Composer disabled={loading} onSubmit={handleTurn} />

          <DebugDrawer
            onToggle={() => setDebugOpen(!isDebugOpen)}
            open={isDebugOpen}
            snapshot={snapshot}
            turnOutput={lastTurnOutput}
          />
        </Panel>
      }
      left={<BriefPanel scene={activeSceneBlueprint} />}
      mobileLeftDrawer={
        isLeftDrawerOpen ? (
          <div className="rounded-xl border border-lab bg-lab-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="type-code text-xs text-lab-muted">BRIEF DRAWER</p>
              <Button className="px-2 py-1 text-xs" onClick={() => setLeftDrawerOpen(false)} variant="subtle">
                收起
              </Button>
            </div>
            <BriefPanel scene={activeSceneBlueprint} />
          </div>
        ) : null
      }
      mobileRightDrawer={
        isRightDrawerOpen ? (
          <div className="rounded-xl border border-lab bg-lab-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="type-code text-xs text-lab-muted">CHECKLIST DRAWER</p>
              <Button className="px-2 py-1 text-xs" onClick={() => setRightDrawerOpen(false)} variant="subtle">
                收起
              </Button>
            </div>
            <ChecklistPanel events={events} scene={activeSceneBlueprint} />
          </div>
        ) : null
      }
      right={<ChecklistPanel events={events} scene={activeSceneBlueprint} />}
      subTop={<SceneProgress run={activeScene} scene={activeSceneBlueprint} />}
      top={<AssessmentProgress assessmentState={snapshot.assessmentState} sessionId={sessionId} />}
    />
  );
}
