import {
  QWEN_BASE_URL,
  RESEARCHER_FALLBACK_MODEL,
  RESEARCHER_MAX_TOKENS,
  RESEARCHER_MODEL,
  REPORT_MAX_TOKENS,
  REPORT_MODEL,
  assertQwenApiConfig,
  cacheSystemPrompt,
  createQwenMessage,
  createQwenMessageWithTools,
  createQwenMessageStream,
  getUpstreamErrorMessage,
  type QwenMessage,
  type QwenMessageWithToolsResult,
  type QwenSystemPrompt,
  type QwenTool,
  type QwenToolChoice,
  type QwenToolUse,
} from "@/lib/qwen";

export type LlmMessage = QwenMessage;
export type LlmSystemPrompt = QwenSystemPrompt;
export type LlmTool = QwenTool;
export type LlmToolChoice = QwenToolChoice;
export type LlmToolUse = QwenToolUse;
export type LlmMessageWithToolsResult = QwenMessageWithToolsResult;

export const LLM_BASE_URL = QWEN_BASE_URL;
export const LLM_RESEARCHER_MODEL = RESEARCHER_MODEL;
export const LLM_RESEARCHER_FALLBACK_MODEL = RESEARCHER_FALLBACK_MODEL;
export const LLM_RESEARCHER_MAX_TOKENS = RESEARCHER_MAX_TOKENS;
export const LLM_REPORT_MODEL = REPORT_MODEL;
export const LLM_REPORT_MAX_TOKENS = REPORT_MAX_TOKENS;

export function assertLlmConfig(): string | null {
  return assertQwenApiConfig();
}

export const cacheLlmSystemPrompt = cacheSystemPrompt;
export const createLlmMessage = createQwenMessage;
export const createLlmMessageWithTools = createQwenMessageWithTools;
export const createLlmMessageStream = createQwenMessageStream;

export { getUpstreamErrorMessage };
