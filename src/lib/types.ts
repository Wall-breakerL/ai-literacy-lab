export type Dimension = "Relation" | "Workflow" | "Epistemic" | "RepairScope";
export type SignalStrength = "strong" | "weak" | "none";
export type CoverageStatus = "uncovered" | "weak" | "covered";
export type DirectiveAction = "probe_new" | "probe_deep" | "clarify" | "conclude";

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
    signals_detected: SignalDetected[];
    current_status: string;
    coverage: Record<Dimension, CoverageStatus>;
  };
  directive: AgentBDirective;
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
