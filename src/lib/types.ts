export type Dimension = "Relation" | "Workflow" | "Epistemic" | "RepairScope";
export type SignalStrength = "strong" | "weak" | "none";
export type CoverageStatus = "uncovered" | "weak" | "covered";
export type DirectiveAction =
  | "probe_new"
  | "probe_deep"
  | "clarify"
  | "conclude"
  | "start_questionnaire"
  | "finish_mid_dialog"
  | "exit_requested";
export type GoalStatus = "specific" | "generic" | "missing";
export type GoalType =
  | "product_building"
  | "research_writing"
  | "learning"
  | "coding_system"
  | "business_decision"
  | "daily_efficiency"
  | "creative_work"
  | "other";
export type DimensionConfidence = "high" | "medium" | "low";
/** Active AI-MBTI 两段式问卷仅两批 */
export type QuestionnaireBatchKey = "batch1" | "batch2";
/** 旧会话 / 报告展开可能仍含第三批次 */
export type LegacyQuestionnaireBatchKey = QuestionnaireBatchKey | "batch3";
export type QuestionnaireBatchMode = "hybrid_batch1" | "hybrid_batch2";
export type MidDialogueKey = "dialog1" | "dialog2";
export type MidDialogueStatus =
  | "confirmed"
  | "refined"
  | "abstract_scenarios"
  | "needs_more_context"
  | "exit_requested";

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
  targetContext?: TargetContext;
  nextQuestions?: QuestionnaireQuestion[];
  newEvidence?: SessionEvidence[];
  scenarioGuidance?: ScenarioGuidance;
  shouldGenerateNextBatch?: boolean;
  userFacingMessage?: string;
}

export type SessionPhase =
  | "interview"
  | "questionnaire_batch1"
  | "mid_dialog1"
  | "questionnaire_batch2"
  | "mid_dialog2"
  | "questionnaire_batch3"
  | "questionnaire"
  | "recovery_interview"
  | "recovery_questionnaire"
  | "report";

export interface SessionEvidence {
  turn: number;
  dimension?: Dimension;
  quote: string;
  signal: "strong" | "weak";
  evidenceKind: "quote" | "summary";
}

export interface SessionState {
  sessionId: string;
  turn: number;
  phase: SessionPhase;
  background: {
    role: string;
    tools: string[];
    recentUse: string;
    goal: string;
    goalStatus: GoalStatus;
    goalType: GoalType;
    summary?: string;
  };
  evidence: SessionEvidence[];
  openProbes: string[];
  questionnaire?: QuestionnaireQuestion[];
  answers?: QuestionnaireAnswer[];
  questionnaireBatches?: Partial<Record<LegacyQuestionnaireBatchKey, QuestionnaireQuestion[]>>;
  batchAnswers?: Partial<Record<LegacyQuestionnaireBatchKey, QuestionnaireAnswer[]>>;
  midDialogues?: Partial<Record<MidDialogueKey, Message[]>>;
  refinedTargetContext?: TargetContext;
  scenarioGuidance?: ScenarioGuidance;
}

export type SessionStatePatch = {
  background?: Partial<SessionState["background"]>;
  newEvidence?: SessionEvidence[];
  openProbes?: string[];
  questionnaire?: QuestionnaireQuestion[];
  answers?: QuestionnaireAnswer[];
  questionnaireBatches?: Partial<Record<LegacyQuestionnaireBatchKey, QuestionnaireQuestion[]>>;
  batchAnswers?: Partial<Record<LegacyQuestionnaireBatchKey, QuestionnaireAnswer[]>>;
  midDialogues?: Partial<Record<MidDialogueKey, Message[]>>;
  refinedTargetContext?: TargetContext;
  scenarioGuidance?: ScenarioGuidance;
  phase?: SessionPhase;
};

export interface DimensionReport {
  dimension: Dimension;
  label: string;
  tendency: string;
  tendencyLabel: string;
  score: number;
  evidence: string[];
  analysis: string;
  advice: string;
  answeredCount?: number;
  skippedCount?: number;
  confidence?: DimensionConfidence;
}

export interface TargetContext {
  role: string;
  recentUse: string;
  goal: string;
  goalStatus: GoalStatus;
  goalType: GoalType;
}

export interface ScenarioGuidance {
  status: MidDialogueStatus;
  scenarioSummary: string;
  granularity: "specific" | "balanced" | "abstract";
  avoidTopics: string[];
  includeTopics: string[];
  userCorrectionQuote?: string;
}

export interface PersonalityProfile {
  code: string;
  name: string;
  tagline: string;
  signatureHeadline: string;
  avatarPrompt: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface ReportRecommendation {
  title: string;
  detail: string;
}

export interface PromptTemplate {
  title: string;
  useCase: string;
  prompt: string;
}

export interface ReportStyleOverview {
  corePattern: string;
  strengthArea: string;
  growthDirection: string;
}

export interface CollaborationSignature {
  headline: string;
  detail: string;
}

export type FeedbackSentiment = "positive" | "mixed" | "negative";
export type FeedbackPriority = "low" | "medium" | "high";
export type FeedbackType =
  | "question_issue"
  | "report_issue"
  | "prompt_template"
  | "flow_issue"
  | "positive_signal";
export type FeedbackDialogueAction = "ask_followup" | "ready_to_save";

export interface FeedbackDialogueMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FeedbackContext {
  sessionId: string;
  identity?: string;
  personalityCode?: string;
  personalityName?: string;
  role: string;
  recentUse: string;
  goal: string;
  totalQuestions: number;
  answeredQuestions: number;
  skipRate: number;
  reportSummary?: string;
  reportTags?: string[];
  collaborationManifesto?: string;
  promptTemplateTitles?: string[];
}

export interface StructuredFeedback {
  sessionId: string;
  personalityCode: string;
  role: string;
  recentUse: string;
  goal: string;
  totalQuestions: number;
  answeredQuestions: number;
  skipRate: number;
  summary: string;
  usefulParts: string[];
  inaccurateParts: string[];
  questionIssues: string[];
  reportIssues: string[];
  improvementSuggestions: string[];
  sentiment: FeedbackSentiment;
  priority: FeedbackPriority;
  feedbackTypes: FeedbackType[];
  rawDialogue: FeedbackDialogueMessage[];
  createdAt?: string;
}

export interface FeedbackChatResponse {
  action: FeedbackDialogueAction;
  assistantMessage: string;
  draft?: StructuredFeedback;
  model?: string;
}

export interface FinalReport {
  summary: string;
  tags: string[];
  targetContext?: TargetContext;
  personality?: PersonalityProfile;
  styleOverview?: ReportStyleOverview;
  collaborationManifesto?: string;
  collaborationSignature?: CollaborationSignature;
  overallAdvice?: string;
  recommendations?: ReportRecommendation[];
  promptTemplates?: PromptTemplate[];
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
  score: number | null;
  question: string;
  scenario: string;
  reverse?: boolean;
  skipped?: boolean;
  skipReason?: "unsure_or_not_applicable";
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
    evidence: string[];
    analysis: string;
    advice?: string;
  }[];
  recommendations: string[];
  promptTemplates: {
    title: string;
    prompt: string;
  }[];
}
