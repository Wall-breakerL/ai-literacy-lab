export type ScenarioPack =
  | "coordination"
  | "verification"
  | "decision"
  | "risk_boundary";

export type ProbeInjectionTiming = "opening" | "after_turn_n" | "on_signal" | "before_close";

export type ProbeSpec = {
  probeId: string;
  targetDimensions: string[];
  injectionTiming: ProbeInjectionTiming;
  injectionTurn?: number;
  assistantMove: string;
  positiveSignals: string[];
  negativeSignals: string[];
  severity: "low" | "medium" | "high";
};

// ---------------------------------------------------------------------------
// Phase types (v3 two-phase blueprint)
// ---------------------------------------------------------------------------

export type PhaseId = "helper" | "talk";

/** Phase 1 — AI assistant helps user accomplish a concrete task. */
export type HelperPhaseSpec = {
  type: "helper";
  assistantRolePrompt: string;
  worldState: string;
  openingMessage: string;
  hiddenProbes: ProbeSpec[];
  turnPolicies: {
    maxTurns?: number;
    minUserTurns?: number;
    allowEarlyFinish?: boolean;
  };
  successSignals: string[];
  stopConditions: string[];
};

/** Safety gate for Phase 2 prompt input. */
export type TalkSafety = {
  blockedCategories: string[];
  blockedKeywords: string[];
  fallbackMessage: string;
};

/** Phase 2 — open-ended discussion to probe AI understanding. */
export type TalkPhaseSpec = {
  type: "talk";
  assistantRolePrompt: string;
  openingMessage: string;
  hiddenProbes: ProbeSpec[];
  /** Default user prompt when user leaves talk input empty. */
  defaultTalkPrompt: string;
  /** Optional input policy for talk prompt UI. */
  talkPromptPolicy?: {
    allowEmptyPrompt?: boolean;
    maxChars?: number;
  };
  talkSafety: TalkSafety;
  turnPolicies: {
    maxTurns?: number;
    minUserTurns?: number;
  };
};

export type PhaseSwitchPolicy = {
  /** How phase1→phase2 transition is triggered */
  trigger: "user_explicit" | "min_turns_reached" | "stop_condition_met";
  /** Minimum user turns in phase1 before switch is offered */
  minPhase1UserTurns: number;
};

// ---------------------------------------------------------------------------
// ScenarioBlueprint (v3 — backward-compatible)
// ---------------------------------------------------------------------------

export type ScenarioBlueprint = {
  id: string;
  pack: ScenarioPack;
  family: string;
  applicableIdentityTags: string[];

  /** v3: two-phase specs; when present, top-level assistantRolePrompt etc. are ignored. */
  phases?: {
    helper: HelperPhaseSpec;
    talk: TalkPhaseSpec;
  };
  phaseSwitchPolicy?: PhaseSwitchPolicy;

  /** Top-level fields kept for backward compat (single-phase blueprints). */
  assistantRolePrompt: string;
  worldState: string;
  openingMessage: string;
  hiddenProbes: ProbeSpec[];
  turnPolicies: {
    maxTurns?: number;
    minUserTurns?: number;
    allowEarlyFinish?: boolean;
  };
  successSignals: string[];
  stopConditions: string[];

  debriefQuestions: string[];
  version: string;
};

/** Whether the blueprint uses the new two-phase flow. */
export function isTwoPhaseBlueprint(bp: ScenarioBlueprint): boolean {
  return Boolean(bp.phases?.helper && bp.phases?.talk);
}

export function isScenarioBlueprint(x: unknown): x is ScenarioBlueprint {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const hasTopLevel =
    typeof o.id === "string" &&
    typeof o.openingMessage === "string" &&
    typeof o.worldState === "string" &&
    Array.isArray(o.hiddenProbes) &&
    Array.isArray(o.debriefQuestions);
  if (hasTopLevel) return true;
  // v3: top-level fields may be empty strings if phases are present
  if (typeof o.id === "string" && o.phases && typeof o.phases === "object") {
    const p = o.phases as Record<string, unknown>;
    return Boolean(p.helper && p.talk);
  }
  return false;
}
