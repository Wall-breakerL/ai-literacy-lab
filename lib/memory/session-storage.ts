import type { ChatMessage } from "../types";

export const SESSION_STORAGE_KEY_V2 = "ai-literacy-session-v2";

/** "main" is legacy single-phase; two-phase uses "helper" | "talk". */
export type ChatPhase = "main" | "helper" | "talk" | "debrief";

export type PersistedSessionV2 = {
  sessionId: string;
  scenarioId: string;
  identityId?: string;
  phase: ChatPhase;
  messages: ChatMessage[];
  debriefIndex: number;
  debriefQuestions: string[];
  /** User-provided talk prompt for talk phase (two-phase only) */
  talkPrompt?: string;
  /** Timestamp when helper→talk switch occurred */
  phaseSwitchedAt?: string;
};
