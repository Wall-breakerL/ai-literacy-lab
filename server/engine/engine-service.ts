import { CORE_ASSESSMENT_BLUEPRINT, SCENE_REGISTRY } from "@/domain/assessment/registry";
import { SessionStateSchema, TurnOutputSchema, type SessionState, type TurnOutput } from "@/domain/engine/session-state";
import type { ProbeScoreDelta, RuleSignal } from "@/domain/probes/types";
import { SessionEventSchema, type SessionEvent } from "@/domain/session/events";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";
import { buildAgentAMessage } from "@/server/engine/agent-a-runner";
import { scoreProbeDeltas } from "@/server/engine/agent-b-scorer";
import { selectTriggeredProbes } from "@/server/engine/probe-orchestrator";
import { extractRuleSignals } from "@/server/engine/rule-extractor";
import { resolveSceneStageTransition } from "@/server/engine/scene-transition";
import { reduceSessionState } from "@/server/engine/session-reducer";

function event(
  sessionId: string,
  type: SessionEvent["type"],
  payload: Record<string, unknown>,
): SessionEvent {
  return SessionEventSchema.parse({ id: createId("evt"), sessionId, timestamp: nowIso(), type, payload });
}

export class EngineService {
  private readonly eventsBySession = new Map<string, SessionEvent[]>();

  listSessionIds(): string[] {
    return [...this.eventsBySession.keys()];
  }

  createSession(): SessionState {
    const sessionId = createId("session");
    const initialEvents = [
      event(sessionId, "SESSION_CREATED", { assessmentId: CORE_ASSESSMENT_BLUEPRINT.id }),
      event(sessionId, "ASSESSMENT_STARTED", { assessmentId: CORE_ASSESSMENT_BLUEPRINT.id }),
      event(sessionId, "SCENE_ENTERED", { sceneId: "apartment-tradeoff", sceneIndex: 0 }),
      event(sessionId, "BRIEF_SHOWN", {
        sceneId: "apartment-tradeoff",
        briefing: SCENE_REGISTRY["apartment-tradeoff"].briefingZh,
      }),
    ];
    this.eventsBySession.set(sessionId, initialEvents);
    return SessionStateSchema.parse(reduceSessionState(initialEvents, sessionId));
  }

  getState(sessionId: string): { state: SessionState; events: SessionEvent[] } {
    const events = this.eventsBySession.get(sessionId);
    if (!events) throw new Error("SESSION_NOT_FOUND");
    return { state: reduceSessionState(events, sessionId), events: [...events] };
  }

  runTurn(sessionId: string, userMessage: string): TurnOutput {
    const pack = this.getState(sessionId);
    const state = pack.state;
    if (state.assessmentState === "completed") {
      return TurnOutputSchema.parse({
        agentAMessage: "评估已完成，可查看结果汇总。",
        currentSceneId: state.currentSceneId,
        currentStage: state.sceneStates.find((item) => item.sceneId === state.currentSceneId)?.stageId ?? "finalize",
        assessmentProgress: state.assessmentState,
        firedProbeIds: [],
        ruleSignals: [],
        probeDeltas: [],
        updatedSessionSnapshot: state,
      });
    }

    const currentRun = state.sceneStates.find((item) => item.sceneId === state.currentSceneId);
    if (!currentRun) throw new Error("STATE_CORRUPTED");

    const scene = SCENE_REGISTRY[state.currentSceneId];
    const completionRequested = userMessage.trim() === COMPLETE_SCENE_SIGNAL;
    const normalizedMessage = completionRequested ? "用户点击了完成当前场景按钮。" : userMessage;
    const signals: RuleSignal[] = completionRequested ? [] : extractRuleSignals(normalizedMessage);
    const firedProbes = selectTriggeredProbes(
      scene.probes,
      {
        sessionId,
        sceneId: scene.id,
        stageId: currentRun.stageId,
        turnIndex: currentRun.turnCount,
        ruleSignals: signals,
        userMessage: normalizedMessage,
      },
      currentRun.firedHighWeightProbeIds,
    );
    const probeDeltas: ProbeScoreDelta[] = scoreProbeDeltas(firedProbes, signals);
    const transition = resolveSceneStageTransition({
      scene,
      currentStageId: currentRun.stageId,
      userMessage: normalizedMessage,
      signals,
      completionRequested,
    });

    const freshEvents: SessionEvent[] = [
      event(sessionId, "USER_MESSAGE", { sceneId: scene.id, message: normalizedMessage }),
      ...firedProbes.map((probe) =>
        event(sessionId, "PROBE_FIRED", { sceneId: scene.id, probeId: probe.id, prompt: probe.injectMessageTemplate }),
      ),
      ...firedProbes.map((probe, index) =>
        event(sessionId, "PROBE_SCORED", {
          sceneId: scene.id,
          probeId: probe.id,
          mbtiDeltas: probeDeltas[index]?.mbti ?? {},
          faaScores: probeDeltas[index]?.faa ?? {},
          evidenceExcerpt: normalizedMessage.slice(0, 160),
        }),
      ),
    ];

    if (transition.nextStageId !== currentRun.stageId) {
      freshEvents.push(
        event(sessionId, "STAGE_CHANGED", {
          sceneId: scene.id,
          fromStage: currentRun.stageId,
          toStage: transition.nextStageId,
        }),
      );
    }

    let bridgeToNextScene = false;
    if (transition.sceneCompleted) {
      freshEvents.push(event(sessionId, "SCENE_COMPLETED", { sceneId: scene.id, sceneIndex: scene.id === "apartment-tradeoff" ? 0 : 1 }));
      if (scene.id === "apartment-tradeoff") {
        bridgeToNextScene = true;
        freshEvents.push(event(sessionId, "SCENE_ENTERED", { sceneId: "brand-naming-sprint", sceneIndex: 1 }));
        freshEvents.push(
          event(sessionId, "BRIEF_SHOWN", {
            sceneId: "brand-naming-sprint",
            briefing: SCENE_REGISTRY["brand-naming-sprint"].briefingZh,
          }),
        );
      } else {
        freshEvents.push(event(sessionId, "ASSESSMENT_COMPLETED", { assessmentId: CORE_ASSESSMENT_BLUEPRINT.id }));
      }
    }

    const stateBeforeAgent = reduceSessionState([...pack.events, ...freshEvents], sessionId);
    const currentStage = stateBeforeAgent.sceneStates.find((item) => item.sceneId === stateBeforeAgent.currentSceneId)?.stageId ?? "brief";
    const agentAMessage = buildAgentAMessage({
      assessmentState: stateBeforeAgent.assessmentState,
      scene: SCENE_REGISTRY[stateBeforeAgent.currentSceneId],
      stageId: currentStage,
      bridgeToNextScene,
      firedProbes,
    });

    freshEvents.push(event(sessionId, "AGENT_A_MESSAGE", { sceneId: stateBeforeAgent.currentSceneId, message: agentAMessage }));
    const merged = [...pack.events, ...freshEvents];
    this.eventsBySession.set(sessionId, merged);
    const updated = reduceSessionState(merged, sessionId);

    return TurnOutputSchema.parse({
      agentAMessage,
      currentSceneId: updated.currentSceneId,
      currentStage: updated.sceneStates.find((item) => item.sceneId === updated.currentSceneId)?.stageId ?? "finalize",
      assessmentProgress: updated.assessmentState,
      firedProbeIds: firedProbes.map((probe) => probe.id),
      ruleSignals: signals,
      probeDeltas,
      updatedSessionSnapshot: updated,
    });
  }
}
