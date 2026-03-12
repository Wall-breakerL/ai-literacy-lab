/**
 * Shared types aligned with docs/ and .cursor/rules/core-principles.mdc
 */

export type UserProfile = {
  role: "student" | "general";
  level: "novice" | "intermediate";
};

export type HiddenProbe = "ambiguity" | "revision" | "verification" | "boundary";

export type Scenario = {
  id: string;
  profileTags: Array<"student" | "general">;
  visibleTask: string;
  hiddenChecks: string[];
  hiddenProbes: HiddenProbe[];
};

export type EvalEvent =
  | "goal_specified"
  | "constraint_specified"
  | "recipient_specified"
  | "context_added"
  | "example_added"
  | "revision_requested"
  | "comparison_requested"
  | "verification_requested"
  | "risk_noticed"
  | "sensitive_info_shared";

/** 单维得分：0–100 百分制（整数） */
export type DimensionScore = number;

export type DimensionScores = {
  clarity: DimensionScore;
  context: DimensionScore;
  steering: DimensionScore;
  judgment: DimensionScore;
  safetyOwnership: DimensionScore;
};

export type JudgeOutput = {
  scenarioId: string;
  sessionId: string;
  dimensionScores: DimensionScores;
  weightedScore: number;
  evidence?: Record<string, string[]>;
};

/** 富结构：每维 level + evidence + reason（docs/07） */
export type DimensionResult = {
  level: DimensionScore;
  evidence: string[];
  reason: string;
};

export type DimensionKey = keyof DimensionScores;

/** Judge 富结构输出（Structured Output），用于展示与解释 */
export type JudgeOutputRich = {
  rubricVersion: string;
  scenarioId: string;
  profile: UserProfile;
  dimensions: Record<DimensionKey, DimensionResult>;
  flags: string[];
  suggestions: string[];
};

export type EvalVersion = {
  rubricVersion: string;
  scenarioVersion: string;
  eventSchemaVersion: string;
  judgeVersion?: string;
  judgeModel?: string;
  judgePromptVersion?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** 助手回复中的思考过程（如 <think> 块），可选展示 */
  thinking?: string;
};

export type Session = {
  sessionId: string;
  scenarioId: string;
  profile: UserProfile;
  messages: ChatMessage[];
  createdAt: string;
};

export type EvalEventRecord = {
  event: EvalEvent;
  turnIndex?: number;
};
