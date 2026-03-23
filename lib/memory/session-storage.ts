import type { ChatMessage } from "../types";

export const SESSION_STORAGE_KEY_V2 = "ai-literacy-session-v2";

export type ChatPhase = "main" | "debrief";

export type PersistedSessionV2 = {
  sessionId: string;
  scenarioId: string;
  identityId?: string;
  phase: ChatPhase;
  messages: ChatMessage[];
  debriefIndex: number;
  debriefQuestions: string[];
};
