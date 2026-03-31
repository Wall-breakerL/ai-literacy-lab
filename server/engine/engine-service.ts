import { CORE_ASSESSMENT_BLUEPRINT, SCENE_REGISTRY } from "@/domain/assessment/registry";
import { SessionStateSchema, TurnOutputSchema, type SessionState, type TurnOutput } from "@/domain/engine/session-state";
import type { ProbeDefinition, ProbeScoreDelta } from "@/domain/probes/types";
import { ProbeScoreDeltaSchema } from "@/domain/probes/types";
import { SessionEventSchema, type SessionEvent } from "@/domain/session/events";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";
import { generateAgentAReply } from "@/server/engine/agent-a-llm";
import { evaluateAgentB } from "@/server/engine/agent-b-evaluator";
import { extractRuleSignals } from "@/server/engine/rule-extractor";
import { selectTriggeredProbes } from "@/server/engine/probe-orchestrator";
import { reduceSessionState } from "@/server/engine/session-reducer";
import { resolveTransitionWithAgentB } from "@/server/engine/scene-transition";
import { getLlmEnvConfig } from "@/server/providers/llm-env";

function event(
  sessionId: string,
  type: SessionEvent["type"],
  payload: Record<string, unknown>,
): SessionEvent {
  return SessionEventSchema.parse({ id: createId("evt"), sessionId, timestamp: nowIso(), type, payload });
}

function mergeProbeScoreDeltas(deltas: ProbeScoreDelta[]): ProbeScoreDelta {
  const mbti: Record<string, number> = {};
  const faa: Record<string, number> = {};
  for (const d of deltas) {
    for (const [k, v] of Object.entries(d.mbti)) {
      if (typeof v === "number") mbti[k] = (mbti[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(d.faa)) {
      if (typeof v === "number") faa[k] = (faa[k] ?? 0) + v;
    }
  }
  return ProbeScoreDeltaSchema.parse({ mbti, faa });
}

function hasNonZeroDelta(d: ProbeScoreDelta): boolean {
  const m = Object.values(d.mbti).some((v) => typeof v === "number" && Math.abs(v) > 1e-6);
  const f = Object.values(d.faa).some((v) => typeof v === "number" && Math.abs(v) > 1e-6);
  return m || f;
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

  async runTurn(sessionId: string, userMessage: string): Promise<TurnOutput> {
    const pack = this.getState(sessionId);
    const state = pack.state;
    const cfg = getLlmEnvConfig();
    const llmEnabled = cfg.enabled && !!cfg.apiKey;

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
    const signals = completionRequested ? [] : extractRuleSignals(normalizedMessage);

    const { output: agentB, source: agentBSource } = await evaluateAgentB({
      scene,
      stageId: currentRun.stageId,
      userMessage,
      normalizedUserMessage: normalizedMessage,
      events: pack.events,
      sessionId,
      turnIndex: currentRun.turnCount,
      firedHighWeightProbeIds: currentRun.firedHighWeightProbeIds,
      completionRequested,
      llmEnabled,
    });

    const transition = resolveTransitionWithAgentB({
      scene,
      currentStageId: currentRun.stageId,
      userMessage: normalizedMessage,
      signals,
      completionRequested,
      agentB,
    });

    const validProbeIds = new Set(scene.probes.map((p) => p.id));
    let recommendedIds = agentB.recommended_probe_ids.filter((id) => validProbeIds.has(id));
    if (agentBSource === "fallback") {
      const ruleFired = selectTriggeredProbes(
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
      recommendedIds = ruleFired.map((p) => p.id);
    }
    recommendedIds = [...new Set(recommendedIds)].slice(0, 2);

    const firedProbeDefs: ProbeDefinition[] = [];
    for (const id of recommendedIds) {
      const def = scene.probes.find((p) => p.id === id);
      if (!def) continue;
      if (def.weight === "high" && currentRun.firedHighWeightProbeIds.includes(def.id)) continue;
      firedProbeDefs.push(def);
    }

    const freshEvents: SessionEvent[] = [
      event(sessionId, "USER_MESSAGE", { sceneId: scene.id, message: normalizedMessage }),
    ];

    const pr = agentB.probe_resolution;
    if (pr?.should_apply_score && pr.probe_instance_id && pr.score_delta) {
      const openBefore = pack.events.filter(
        (e): e is Extract<SessionEvent, { type: "PROBE_FIRED" }> =>
          e.type === "PROBE_FIRED" &&
          e.payload.sceneId === scene.id &&
          e.payload.probeInstanceId === pr.probe_instance_id,
      );
      const lastFire = openBefore[openBefore.length - 1];
      if (lastFire && lastFire.type === "PROBE_FIRED") {
        freshEvents.push(
          event(sessionId, "PROBE_SCORED", {
            sceneId: scene.id,
            probeId: lastFire.payload.probeId,
            probeInstanceId: pr.probe_instance_id,
            mbtiDeltas: pr.score_delta.mbti,
            faaScores: pr.score_delta.faa,
            evidenceExcerpt: pr.evidence_excerpt ?? normalizedMessage.slice(0, 160),
          }),
        );
      }
    }

    const mergedEval = mergeProbeScoreDeltas(agentB.score_deltas);
    if (hasNonZeroDelta(mergedEval)) {
      freshEvents.push(
        event(sessionId, "EVALUATION_SCORE_APPLIED", {
          sceneId: scene.id,
          mbtiDeltas: mergedEval.mbti,
          faaScores: mergedEval.faa,
          reason: `Agent B (${agentBSource}) signal aggregate`,
        }),
      );
    }

    for (const probe of firedProbeDefs) {
      const probeInstanceId = createId("probe");
      freshEvents.push(
        event(sessionId, "PROBE_FIRED", {
          sceneId: scene.id,
          probeId: probe.id,
          probeInstanceId,
          weight: probe.weight,
          prompt: probe.injectMessageTemplate,
        }),
      );
    }

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
    const currentStage =
      stateBeforeAgent.sceneStates.find((item) => item.sceneId === stateBeforeAgent.currentSceneId)?.stageId ?? "brief";

    const agentScene = SCENE_REGISTRY[stateBeforeAgent.currentSceneId];
    const agentAMessage = await generateAgentAReply({
      assessmentState: stateBeforeAgent.assessmentState,
      scene: agentScene,
      stageId: currentStage,
      bridgeToNextScene,
      firedProbes: firedProbeDefs,
      userMessagePreview: normalizedMessage,
      agentBIntentSummary: agentB.user_intent_summary,
      llmEnabled,
    });

    freshEvents.push(event(sessionId, "AGENT_A_MESSAGE", { sceneId: stateBeforeAgent.currentSceneId, message: agentAMessage }));
    const merged = [...pack.events, ...freshEvents];
    this.eventsBySession.set(sessionId, merged);
    const updated = reduceSessionState(merged, sessionId);

    const probeDeltasForOutput: ProbeScoreDelta[] = [];
    if (pr?.should_apply_score && pr.score_delta) probeDeltasForOutput.push(pr.score_delta);
    if (hasNonZeroDelta(mergedEval)) probeDeltasForOutput.push(mergedEval);

    return TurnOutputSchema.parse({
      agentAMessage,
      currentSceneId: updated.currentSceneId,
      currentStage: updated.sceneStates.find((item) => item.sceneId === updated.currentSceneId)?.stageId ?? "finalize",
      assessmentProgress: updated.assessmentState,
      firedProbeIds: firedProbeDefs.map((p) => p.id),
      ruleSignals: agentB.rule_signals.length > 0 ? agentB.rule_signals : signals,
      probeDeltas: probeDeltasForOutput,
      updatedSessionSnapshot: updated,
    });
  }
}
