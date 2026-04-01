import type { ProbeDefinition, ProbeId } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import type { ScenePhase } from "@/domain/scenes/scene-phase";
import { AgentBOutputSchema, type AgentBOutput, type AgentBScoringEvent } from "@/domain/agent/agent-b-output";
import { ProbeScoreDeltaSchema } from "@/domain/probes/types";
import { mergeSignalOnlyDeltas } from "@/server/engine/agent-b-scorer";
import type { RuleSignal } from "@/domain/probes/types";
import { computeStageTransition } from "@/server/engine/stage-completion";

function hasOpenProbePattern(msg: string): boolean {
  return /核验|追问|确认|中介|房东|合同文本|书面|补充协议/.test(msg);
}

function mentionsComparison(msg: string): boolean {
  return /对比|比较|并排|矩阵|两套|两个房源|A.*B|B.*A|逐项/.test(msg);
}

function mentionsRanking(msg: string): boolean {
  return /排序|首选|推荐|梯队|第一|第二/.test(msg);
}

function mentionsRestructure(msg: string): boolean {
  return /重排|调整排序|出局|淘汰|收紧|预算.*降|假设.*通勤/.test(msg);
}

/** Heuristic: should we suggest firing a probe when LLM is off? Only when no probe is already open. */
export function fallbackShouldFireProbe(input: {
  scene: SceneBlueprint;
  userMessage: string;
  hasOpenProbe: boolean;
  firedHighWeightProbeIds: ProbeId[];
}): ProbeDefinition | null {
  if (input.hasOpenProbe) return null;
  const msg = input.userMessage;
  if (msg.length < 4) return null;

  const mustVerifyCount = input.scene.decisionContext?.mustVerifyQuestions?.length ?? 0;
  const verificationHint = mustVerifyCount > 0 || (input.scene.decisionContext?.verificationQueue?.length ?? 0) > 0;

  if (input.scene.id === "brand-naming-sprint") {
    if (/cluster|聚类矩阵|按\s*cluster/i.test(msg) && msg.length < 400) {
      const p = input.scene.probes.find((x) => x.id === "brand-naming-probe-04");
      if (p && !(p.weight === "high" && input.firedHighWeightProbeIds.includes(p.id))) return p;
    }
    if (/(伪访谈|回到\s*brief|consistency\s*check|brief\s*一致性)/i.test(msg)) {
      const p = input.scene.probes.find((x) => x.id === "brand-naming-probe-07");
      if (p && !(p.weight === "high" && input.firedHighWeightProbeIds.includes(p.id))) return p;
    }
  }

  if (input.scene.id === "apartment-tradeoff") {
    if (verificationHint && mentionsRanking(msg) && !hasOpenProbePattern(msg) && /排序|梯队|从好到坏/.test(msg)) {
      const p = input.scene.probes.find((x) => x.id === "apartment-tradeoff-probe-03");
      if (p && !(p.weight === "high" && input.firedHighWeightProbeIds.includes(p.id))) return p;
    }
    const picksLetter = /推荐\s*[ABCD]|首选\s*[ABCD]|我选\s*[ABCD]|就[选订]\s*[ABCD]/i.test(msg);
    if (picksLetter && !hasOpenProbePattern(msg) && msg.length < 220) {
      const p = input.scene.probes.find((x) => x.id === "apartment-tradeoff-probe-02");
      if (p && !(p.weight === "high" && input.firedHighWeightProbeIds.includes(p.id))) return p;
    }
  }

  // Early pick / closure without verification path (role contract)
  const earlyPick =
    /就选|先订|直接选/.test(msg) || (/我选\s*[ABCD]|首选\s*[ABCD]/i.test(msg) && !/推荐/.test(msg));
  if (earlyPick && !hasOpenProbePattern(msg) && msg.length < 140) {
    const p = input.scene.probes.find((x) => x.id === "apartment-tradeoff-probe-01" || x.id === "brand-naming-probe-01");
    if (p && !(p.weight === "high" && input.firedHighWeightProbeIds.includes(p.id))) return p;
  }

  // Single-metric convergence
  const singleMetric =
    /只(看|考虑)|唯一指标|就看(租金|通勤|价格)/.test(msg) ||
    (/通勤|租金/.test(msg) && !/宠物|合同|室友|噪音|采光/.test(msg) && msg.length < 100);
  if (singleMetric) {
    const p = input.scene.probes.find((x) => x.id === "apartment-tradeoff-probe-02" || x.id === "brand-naming-probe-04");
    if (p && !(p.weight === "high" && input.firedHighWeightProbeIds.includes(p.id))) return p;
  }

  // Stress / new constraint re-rank (apartment)
  if (input.scene.id === "apartment-tradeoff" && mentionsRestructure(msg) && mentionsComparison(msg)) {
    const p = input.scene.probes.find((x) => x.id === "apartment-tradeoff-probe-04");
    if (p) return p;
  }

  return null;
}

function fallbackPhaseFromStage(stageId: string): ScenePhase {
  if (stageId === "brief") return "orient";
  if (stageId === "decide" || stageId === "finalize") return "wrap";
  return "work";
}

export function buildFallbackAgentBOutput(input: {
  scene: SceneBlueprint;
  stageId: string;
  normalizedUserMessage: string;
  signals: RuleSignal[];
  completionRequested: boolean;
  openProbeInstanceId: string | null;
  openProbeId: ProbeId | null;
  firedHighWeightProbeIds: ProbeId[];
}): AgentBOutput {
  const msg = input.normalizedUserMessage;
  const openProbes = input.openProbeInstanceId && input.openProbeId ? [{ probeInstanceId: input.openProbeInstanceId, probeId: input.openProbeId }] : [];

  let probeResolution: AgentBOutput["probe_resolution"];
  if (openProbes.length > 0) {
    const target = openProbes[0]!;
    const def = input.scene.probes.find((p) => p.id === target.probeId);
    const addressed =
      msg.length > 20 &&
      (hasOpenProbePattern(msg) || mentionsComparison(msg) || mentionsRestructure(msg) || /理由|因为|相比|权衡/.test(msg));
    probeResolution = {
      probe_instance_id: target.probeInstanceId,
      should_apply_score: addressed,
      outcome: addressed ? "resolved" : "unresolved",
      score_delta: addressed && def ? def.scoreDelta : undefined,
      evidence_excerpt: msg.slice(0, 200),
      reason: addressed ? "用户回应包含可核验或结构化比较/修正，视为完成隐藏追问。" : undefined,
    };
  }

  const transition = computeStageTransition({
    scene: input.scene,
    currentStageId: input.stageId,
    userMessage: msg,
    signals: input.signals,
    completionRequested: input.completionRequested,
  });

  const canAdvance = transition.nextStageId !== input.stageId || transition.sceneCompleted;
  const scoringEvents: AgentBScoringEvent[] = [];

  if (!probeResolution?.should_apply_score) {
    const ordinaryDelta = mergeSignalOnlyDeltas(input.signals);
    const hasOrdinary =
      Object.values(ordinaryDelta.mbti).some((v) => typeof v === "number" && Math.abs(v) > 1e-6) ||
      Object.values(ordinaryDelta.faa).some((v) => typeof v === "number" && Math.abs(v) > 1e-6);
    if (hasOrdinary) {
      scoringEvents.push({
        source_type: "ordinary_collaboration",
        evidence_excerpt: msg.slice(0, 220),
        why_this_matters: "基于可观察协作行为（规则信号聚合，回退路径），反映结构化表达或来源意识。",
        score_delta: ProbeScoreDeltaSchema.parse(ordinaryDelta),
      });
    }
    if (mentionsComparison(msg) && msg.length > 24) {
      scoringEvents.push({
        source_type: "ordinary_collaboration",
        evidence_excerpt: msg.slice(0, 220),
        why_this_matters: "用户进行了多方案对照，有利于降低单指标偏差。",
        score_delta: ProbeScoreDeltaSchema.parse({ mbti: { epistemic: 0.06 }, faa: { RC: 0.05 } }),
      });
    }
  }

  const hasOpen = openProbes.length > 0;
  const fire = fallbackShouldFireProbe({
    scene: input.scene,
    userMessage: msg,
    hasOpenProbe: hasOpen,
    firedHighWeightProbeIds: input.firedHighWeightProbeIds,
  });

  return AgentBOutputSchema.parse({
    user_intent_summary: "（规则回退）基于行为模式与阶段门控的本地评估。",
    working_summary_update:
      msg.length > 40
        ? `用户最新表述摘要：${msg.slice(0, 120)}${msg.length > 120 ? "…" : ""}`
        : "用户本轮表述较短，尚未形成可摘要的协作产出。",
    phase_suggestion: fallbackPhaseFromStage(
      transition.nextStageId !== input.stageId ? transition.nextStageId : input.stageId,
    ),
    evidence_excerpts: [{ text: msg.slice(0, 200), source: "user_message" }],
    rule_signals: input.signals,
    scoring_events: scoringEvents,
    score_deltas: [],
    risk_flags: [],
    should_fire_probe: !!fire,
    recommended_probe_id: fire?.id ?? null,
    hidden_conversational_objective_zh: fire?.probeIntentZh,
    recommended_probe_ids: [],
    stage_completion_status: transition.sceneCompleted ? "complete" : transition.gateMet ? "ready" : "incomplete",
    next_stage_suggestion: transition.nextStageId,
    can_advance_stage: canAdvance,
    confidence: transition.confidence,
    probe_resolution: probeResolution,
  });
}
