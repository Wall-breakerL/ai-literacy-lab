import { CORE_ASSESSMENT_BLUEPRINT, SCENE_REGISTRY } from "@/domain/assessment/registry";
import { SessionStateSchema, TurnOutputSchema, type SessionState, type TurnOutput } from "@/domain/engine/session-state";
import type { ProbeDefinition, ProbeScoreDelta } from "@/domain/probes/types";
import { ProbeScoreDeltaSchema } from "@/domain/probes/types";
import { buildSceneContextPacket, sceneContextPacketForPrompt } from "@/domain/scenes/scene-context-packet";
import type { ScenarioProbeRuntime } from "@/domain/scenes/scenario-data";
import type { SceneId } from "@/domain/scenes/types";
import { SessionEventSchema, type SessionEvent } from "@/domain/session/events";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { COMPLETE_SCENE_SIGNAL } from "@/lib/turn-signals";
import { generateAgentAReply } from "@/server/engine/agent-a-llm";
import { evaluateAgentB } from "@/server/engine/agent-b-evaluator";
import { buildChatTurnsForScene } from "@/server/engine/chat-history";
import { ProbeInjector } from "@/server/engine/probe-injector";
import { trackProbeDetection } from "@/server/engine/probe-tracker";
import { extractRuleSignals } from "@/server/engine/rule-extractor";
import { cloneScenarioProbeRuntimes, getScenarioDataLayer } from "@/server/engine/scenarios/registry";
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
  /** Server-only runtime state for scenario-data injection probes (not in client schemas). */
  private readonly injectionBySession = new Map<string, Map<SceneId, ScenarioProbeRuntime[]>>();

  private getRuntimeProbes(sessionId: string, sceneId: SceneId): ScenarioProbeRuntime[] {
    let sceneMap = this.injectionBySession.get(sessionId);
    if (!sceneMap) {
      sceneMap = new Map();
      this.injectionBySession.set(sessionId, sceneMap);
    }
    if (!sceneMap.has(sceneId)) {
      const layer = getScenarioDataLayer(sceneId);
      sceneMap.set(sceneId, cloneScenarioProbeRuntimes(layer));
    }
    return sceneMap.get(sceneId)!;
  }

  listSessionIds(): string[] {
    return [...this.eventsBySession.keys()];
  }

  createSession(): SessionState {
    const sessionId = createId("session");
    const initialEvents = [
      event(sessionId, "SESSION_CREATED", { assessmentId: CORE_ASSESSMENT_BLUEPRINT.id }),
      event(sessionId, "ASSESSMENT_STARTED", { assessmentId: CORE_ASSESSMENT_BLUEPRINT.id }),
      event(sessionId, "SCENE_ENTERED", { sceneId: "apartment-tradeoff", sceneIndex: 0 }),
      event(sessionId, "SCENE_CONTEXT_SYNC", {
        sceneId: "apartment-tradeoff",
        phase: "orient",
        workingSummaryZh: "",
      }),
      event(sessionId, "BRIEF_SHOWN", {
        sceneId: "apartment-tradeoff",
        briefing: SCENE_REGISTRY["apartment-tradeoff"].briefingZh,
      }),
    ];
    this.eventsBySession.set(sessionId, initialEvents);
    void this.getRuntimeProbes(sessionId, "apartment-tradeoff");
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

    const completionRequested = userMessage.trim() === COMPLETE_SCENE_SIGNAL;
    if (!completionRequested && userMessage.trim().length > 0) {
      const nextUserTurn = currentRun.turnCount + 1;
      trackProbeDetection({
        probes: this.getRuntimeProbes(sessionId, state.currentSceneId),
        userMessage: userMessage.trim(),
        currentUserTurn: nextUserTurn,
      });
    }

    const scene = SCENE_REGISTRY[state.currentSceneId];
    const normalizedMessage = completionRequested ? "用户点击了完成当前场景按钮。" : userMessage;
    const signals = completionRequested ? [] : extractRuleSignals(normalizedMessage);

    const packetBefore = buildSceneContextPacket(scene, currentRun);
    const sceneContextPromptBefore = sceneContextPacketForPrompt(packetBefore);

    const { output: rawAgentB, source: agentBSource } = await evaluateAgentB({
      scene,
      stageId: currentRun.stageId,
      sceneContextPrompt: sceneContextPromptBefore,
      userMessage,
      normalizedUserMessage: normalizedMessage,
      events: pack.events,
      sessionId,
      turnIndex: currentRun.turnCount,
      firedHighWeightProbeIds: currentRun.firedHighWeightProbeIds,
      completionRequested,
      llmEnabled,
    });

    const agentB =
      rawAgentB.probe_resolution?.should_apply_score === true
        ? {
            ...rawAgentB,
            scoring_events: rawAgentB.scoring_events.filter((e) => e.source_type !== "probe_response"),
          }
        : rawAgentB;

    const transition = resolveTransitionWithAgentB({
      scene,
      currentStageId: currentRun.stageId,
      userMessage: normalizedMessage,
      signals,
      completionRequested,
      agentB,
    });

    const freshEvents: SessionEvent[] = [event(sessionId, "USER_MESSAGE", { sceneId: scene.id, message: normalizedMessage })];

    const pr = agentB.probe_resolution;
    if (pr?.probe_instance_id && pr.outcome === "unresolved" && !pr.should_apply_score) {
      const openBefore = pack.events.filter(
        (e): e is Extract<SessionEvent, { type: "PROBE_FIRED" }> =>
          e.type === "PROBE_FIRED" &&
          e.payload.sceneId === scene.id &&
          e.payload.probeInstanceId === pr.probe_instance_id,
      );
      const lastFire = openBefore[openBefore.length - 1];
      if (lastFire && lastFire.type === "PROBE_FIRED") {
        freshEvents.push(
          event(sessionId, "PROBE_CLOSED", {
            sceneId: scene.id,
            probeId: lastFire.payload.probeId,
            probeInstanceId: pr.probe_instance_id,
            outcome: "unresolved",
            reason: pr.reason ?? "隐藏追问未形成可评分回应，已结案（不计分）。",
            evidenceExcerpt: pr.evidence_excerpt ?? normalizedMessage.slice(0, 160),
            userResponseExcerpt: normalizedMessage.slice(0, 200),
            mbtiDeltas: {},
            faaScores: {},
            scoreApplied: false,
          }),
        );
      }
    } else if (pr?.should_apply_score && pr.probe_instance_id && pr.score_delta && pr.outcome !== "unresolved") {
      const openBefore = pack.events.filter(
        (e): e is Extract<SessionEvent, { type: "PROBE_FIRED" }> =>
          e.type === "PROBE_FIRED" &&
          e.payload.sceneId === scene.id &&
          e.payload.probeInstanceId === pr.probe_instance_id,
      );
      const lastFire = openBefore[openBefore.length - 1];
      if (lastFire && lastFire.type === "PROBE_FIRED") {
        freshEvents.push(
          event(sessionId, "PROBE_CLOSED", {
            sceneId: scene.id,
            probeId: lastFire.payload.probeId,
            probeInstanceId: pr.probe_instance_id,
            outcome: "resolved",
            reason: pr.reason ?? "用户对隐藏追问给出了可评估的回应，按探针定义计分。",
            evidenceExcerpt: pr.evidence_excerpt ?? normalizedMessage.slice(0, 160),
            userResponseExcerpt: normalizedMessage.slice(0, 200),
            mbtiDeltas: pr.score_delta.mbti,
            faaScores: pr.score_delta.faa,
            scoreApplied: true,
          }),
        );
      }
    }

    for (const se of agentB.scoring_events) {
      const merged = mergeProbeScoreDeltas([se.score_delta]);
      if (!hasNonZeroDelta(merged)) continue;
      freshEvents.push(
        event(sessionId, "EVALUATION_SCORE_APPLIED", {
          sceneId: scene.id,
          mbtiDeltas: merged.mbti,
          faaScores: merged.faa,
          reason: se.why_this_matters,
          evidenceExcerpt: se.evidence_excerpt,
          sourceType: se.source_type,
        }),
      );
    }

    const firedProbeDefs: ProbeDefinition[] = [];
    if (agentB.should_fire_probe && agentB.recommended_probe_id) {
      const def = scene.probes.find((p) => p.id === agentB.recommended_probe_id);
      if (def && !(def.weight === "high" && currentRun.firedHighWeightProbeIds.includes(def.id))) {
        firedProbeDefs.push(def);
        const probeInstanceId = createId("probe");
        const hiddenZh = agentB.hidden_conversational_objective_zh?.trim() || def.probeIntentZh;
        freshEvents.push(
          event(sessionId, "PROBE_FIRED", {
            sceneId: scene.id,
            probeId: def.id,
            probeInstanceId,
            weight: def.weight,
            prompt: def.injectMessageTemplate,
            hiddenObjectiveZh: hiddenZh,
            triggerReason: `行为评估（${agentBSource}）建议插入一条自然协作追问；探针「${def.label}」`,
          }),
        );
      }
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

    freshEvents.push(
      event(sessionId, "SCENE_CONTEXT_SYNC", {
        sceneId: scene.id,
        phase: agentB.phase_suggestion,
        workingSummaryZh: agentB.working_summary_update.slice(0, 2000),
      }),
    );

    let bridgeToNextScene = false;
    if (transition.sceneCompleted) {
      freshEvents.push(event(sessionId, "SCENE_COMPLETED", { sceneId: scene.id, sceneIndex: scene.id === "apartment-tradeoff" ? 0 : 1 }));
      if (scene.id === "apartment-tradeoff") {
        bridgeToNextScene = true;
        freshEvents.push(event(sessionId, "SCENE_ENTERED", { sceneId: "brand-naming-sprint", sceneIndex: 1 }));
        freshEvents.push(
          event(sessionId, "SCENE_CONTEXT_SYNC", {
            sceneId: "brand-naming-sprint",
            phase: "orient",
            workingSummaryZh: "",
          }),
        );
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
    const activeSceneId = stateBeforeAgent.currentSceneId;
    const runForAgent = stateBeforeAgent.sceneStates.find((item) => item.sceneId === activeSceneId);
    const agentScene = SCENE_REGISTRY[activeSceneId];

    const packetForAgent = runForAgent ? buildSceneContextPacket(agentScene, runForAgent) : buildSceneContextPacket(agentScene, currentRun);
    const sceneContextPromptForAgent = sceneContextPacketForPrompt(packetForAgent);

    const histForInject = buildChatTurnsForScene([...pack.events, ...freshEvents], activeSceneId);
    const currentTurnForInject = histForInject.filter((m) => m.role === "user").length;

    let scenarioDataForLLM: Record<string, unknown> | null = null;
    if (!bridgeToNextScene) {
      const layer = getScenarioDataLayer(activeSceneId);
      const probes = this.getRuntimeProbes(sessionId, activeSceneId);
      const injector = new ProbeInjector();
      const injected = injector.processBeforeLLMCall({
        layer,
        conversationHistory: histForInject,
        currentTurn: Math.max(1, currentTurnForInject),
        probes,
      });
      scenarioDataForLLM = injected.scenarioDataForLLM;
    }

    const agentAMessage = await generateAgentAReply({
      scene: agentScene,
      bridgeToNextScene,
      sceneContextPrompt: sceneContextPromptForAgent,
      scenarioDataForLLM,
      userMessagePreview: normalizedMessage,
      agentBIntentSummary: agentB.user_intent_summary,
      llmEnabled,
    });

    freshEvents.push(event(sessionId, "AGENT_A_MESSAGE", { sceneId: activeSceneId, message: agentAMessage }));
    const merged = [...pack.events, ...freshEvents];
    this.eventsBySession.set(sessionId, merged);
    const updated = reduceSessionState(merged, sessionId);

    const probeDeltasForOutput: ProbeScoreDelta[] = [];
    if (pr?.should_apply_score && pr.score_delta) probeDeltasForOutput.push(pr.score_delta);
    for (const se of agentB.scoring_events) {
      if (hasNonZeroDelta(se.score_delta)) probeDeltasForOutput.push(se.score_delta);
    }

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
