export type Dimension = "Relation" | "Workflow" | "Epistemic" | "RepairScope";
export type SignalStrength = "strong" | "weak" | "none";
export type CoverageStatus = "uncovered" | "weak" | "covered";
export type DirectiveAction = "probe_new" | "probe_deep" | "clarify" | "conclude" | "start_questionnaire";

export interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
  /** 本轮助手回复从发起请求到成功所经历的秒数（含客户端重试与等待），仅展示用 */
  thinkDurationSec?: number;
}

export interface SignalDetected {
  dimension: Dimension;
  strength: SignalStrength;
  tendency: string;
}

export interface AgentBDirective {
  action: DirectiveAction;
  target_dimension?: Dimension;
  hint?: string;
}

export interface AgentBOutput {
  analysis: {
    reasoning: string;
    background_summary?: string;
    coverage?: Record<Dimension, CoverageStatus>;
  };
  directive: AgentBDirective;
  nextQuestions?: QuestionnaireQuestion[];
}

export interface DimensionReport {
  dimension: Dimension;
  label: string;
  tendency: string;
  tendencyLabel: string;
  score: number;
  evidence: string[];
  analysis: string;
  advice: string;
}

export interface FinalReport {
  summary: string;
  tags: string[];
  dimensions: DimensionReport[];
}

export interface QuestionnaireQuestion {
  dimension: Dimension;
  question: string;
  /** 场景题：具体情境描述；习惯题：模型约定填字面量「习惯」，UI 会按习惯题展示 */
  scenario: string;
  reverse?: boolean;
}

export interface QuestionnaireAnswer {
  dimension: Dimension;
  score: number;
  question: string;
  scenario: string;
  reverse?: boolean;
}

// Phase 2 AI-HQ types
export type HQDimension = "route" | "frame" | "workflow" | "repair";
export type HQLevel = "L1" | "L2" | "L3";

export interface HQDimensionScore {
  score: number;
  max: number;
  probes: boolean[];
}

export interface HQScores {
  route: HQDimensionScore;
  frame: HQDimensionScore;
  workflow: HQDimensionScore;
  repair: HQDimensionScore;
  total: number;
  level: HQLevel;
}

export interface HQReport {
  scores: HQScores;
  overall: string;
  dimensions: {
    dimension: HQDimension;
    label: string;
    score: number;
    max: number;
    analysis: string;
    advice?: string;
  }[];
}

/** AI-HQ 对话访谈编排（与 MBTI 的 AgentBOutput 分离） */
export type HQInterviewDirectiveAction = "probe_deep" | "advance_topic";

export interface HQInterviewDirective {
  action: HQInterviewDirectiveAction;
  /** 给 Agent A 的中文提示，≤60 字 */
  hint?: string;
}

export interface HQOrchestratorOutput {
  analysis: {
    reasoning: string;
    /** 当前主题下用户要点摘要，供下一轮参考 */
    topic_summary?: string;
  };
  directive: HQInterviewDirective;
}
