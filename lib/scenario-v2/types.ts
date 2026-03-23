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

export type ScenarioBlueprint = {
  id: string;
  pack: ScenarioPack;
  family: string;
  applicableIdentityTags: string[];
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

export function isScenarioBlueprint(x: unknown): x is ScenarioBlueprint {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.openingMessage === "string" &&
    typeof o.worldState === "string" &&
    Array.isArray(o.hiddenProbes) &&
    Array.isArray(o.debriefQuestions)
  );
}
