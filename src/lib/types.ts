export type Dimension = "Relation" | "Workflow" | "Epistemic" | "RepairScope";
export type SignalStrength = "strong" | "weak" | "none";
export type CoverageStatus = "uncovered" | "weak" | "covered";
export type DirectiveAction = "probe_new" | "follow_up" | "conclude";

export interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
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
