/**
 * Shared types for chat / session payloads.
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** 助手回复中的思考过程（如模型思考块），可选展示 */
  thinking?: string;
};

export type Session = {
  sessionId: string;
  scenarioId: string;
  messages: ChatMessage[];
  createdAt: string;
};
