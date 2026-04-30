import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  LLM_PROVIDER,
  RESEARCHER_FALLBACK_MODEL,
  RESEARCHER_MAX_TOKENS,
  RESEARCHER_MODEL,
  assertClaudeApiKey,
  createClaudeMessageWithTools,
  getUpstreamErrorMessage,
  type ClaudeMessageWithToolsResult,
} from "@/lib/claude";
import {
  applySessionStatePatch,
  buildSessionStatePatchFromAgentBOutput,
  createInitialSessionState,
  isSessionState,
  pruneOldTranscript,
} from "@/lib/sessionState";
import {
  agentBOutputFromToolUses,
  buildMidDialoguePrompt,
  buildMidDialogueTransitionRepairPrompt,
  buildMidDialogueCompletionText,
  buildResearcherSystemPrompt,
  buildResearcherToolPrompt,
  createOpeningAgentBOutput,
  getMidDialogueToolChoice,
  getResearcherMaxTokens,
  getResearcherTool,
  getResearcherToolChoice,
  INTERVIEW_OPENING_MESSAGE,
  midDialogueTextFromResult,
  midDialogueOutputFromToolUses,
  normalizeInitialInterviewOpening,
  normalizeMidDialogueOutput,
  normalizeMidDialogueTransitionRepairText,
  normalizeQuestionnaireTransitionText,
  QUESTIONNAIRE_ENTRY_ROUND,
  RESEARCHER_TOOL_SYSTEM,
  researcherTextFromResult,
  UPDATE_MID_DIALOGUE_TOOL,
} from "@/lib/researcher";
import { inferTargetContextFromMessages, normalizeTargetContext } from "@/lib/targetContext";
import { AgentBOutput, Message, MidDialogueKey, SessionState } from "@/lib/types";

/** Vercel：连续两次模型调用易超过默认 10s；Pro 可生效至 60s。Hobby 仅 10s 时可能超时，需升级或换更快模型。 */
export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_CHAT_RETRIES = Math.max(
  1,
  Number.parseInt(process.env.CLAUDE_CHAT_MAX_RETRIES ?? "3", 10) || 3
);
const LOCAL_DEBUG_ROOT = path.join(process.cwd(), ".local-debug", "interview-runs");

type ChatRetryEvent = {
  label: "researcher";
  attempt: number;
  maxAttempts: number;
  retryInMs: number;
  error: string;
  at: string;
};

type LocalDebugRoundEntry = {
  round: number;
  requestedAt: string;
  input: { identity: string; messages: Message[] };
  agentB: {
    model: string;
    temperature: number;
    systemPrompt: string;
    userPrompt: string;
    parsedOutput?: AgentBOutput;
    fallbackUsed: boolean;
    rawResponseText?: string;
  };
  agentA: {
    model: string;
    temperature: number;
    systemPrompt: string;
    historyMessages: { role: "user" | "assistant"; content: string }[];
    userPrompt: string;
    outputText?: string;
  };
  retryEvents: ChatRetryEvent[];
  requestError?: string;
};

type LocalDebugSessionLog = {
  savedAt: string;
  sessionId: string;
  identity: string;
  startedAt?: string;
  initialConfig: {
    llmProvider: string;
    llmBaseUrl: string;
    maxChatRetries: number;
    retryDelayMs: number;
    agentBQuestionnaireRetryDelayMs: number;
    researcher: {
      model: string;
      fallbackModel: string;
      temperature: number;
      maxTokens: number;
      systemPrompt: string;
    };
  };
  rounds: LocalDebugRoundEntry[];
  transcript?: Message[];
  finishedAt?: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_CHAT_RETRY_DELAY_MS = 20_000;
/** 问卷生成轮次（Agent B 输出整卷 JSON）较重，重试间隔放宽 */
const QUESTIONNAIRE_AGENT_B_RETRY_DELAY_MS = 60_000;

/** 单次上游调用失败则重试，直至成功或用尽次数（避免无限循环与账单失控）。 */
async function withChatRetries<T>(
  label: "researcher",
  fn: () => Promise<T>,
  options?: { onRetry?: (event: ChatRetryEvent) => void; retryDelayMs?: number }
): Promise<T> {
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_CHAT_RETRY_DELAY_MS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CHAT_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt >= MAX_CHAT_RETRIES) break;
      const delayMs = retryDelayMs;
      options?.onRetry?.({
        label,
        attempt,
        maxAttempts: MAX_CHAT_RETRIES,
        retryInMs: delayMs,
        error: getUpstreamErrorMessage(e) ?? String(e),
        at: new Date().toISOString(),
      });
      console.warn(
        `[chat] ${label} attempt ${attempt}/${MAX_CHAT_RETRIES} failed, retry in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function upsertLocalDebugSession(
  sessionId: string,
  patch: Partial<LocalDebugSessionLog> & { identity: string }
) {
  if (process.env.NODE_ENV === "production") return;
  await mkdir(LOCAL_DEBUG_ROOT, { recursive: true });
  const filePath = path.join(LOCAL_DEBUG_ROOT, `${sessionId}.json`);

  let current: LocalDebugSessionLog | null = null;
  try {
    const raw = await readFile(filePath, "utf8");
    current = JSON.parse(raw) as LocalDebugSessionLog;
  } catch {
    current = null;
  }

  const next: LocalDebugSessionLog = {
    savedAt: new Date().toISOString(),
    sessionId,
    identity: patch.identity,
    startedAt: current?.startedAt ?? patch.startedAt,
    initialConfig:
      current?.initialConfig ?? {
        llmProvider: LLM_PROVIDER,
        llmBaseUrl:
          LLM_PROVIDER === "openai-compatible"
            ? process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() ||
              process.env.OPENAI_BASE_URL?.trim() ||
              "https://api.openai.com/v1"
            : process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com/v1",
        maxChatRetries: MAX_CHAT_RETRIES,
        retryDelayMs: DEFAULT_CHAT_RETRY_DELAY_MS,
        agentBQuestionnaireRetryDelayMs: QUESTIONNAIRE_AGENT_B_RETRY_DELAY_MS,
        researcher: {
          model: RESEARCHER_MODEL,
          fallbackModel: RESEARCHER_FALLBACK_MODEL,
          temperature: 0.3,
          maxTokens: RESEARCHER_MAX_TOKENS,
          systemPrompt: RESEARCHER_TOOL_SYSTEM,
        },
      },
    rounds: [...(current?.rounds ?? []), ...(patch.rounds ?? [])],
    transcript: patch.transcript ?? current?.transcript,
    finishedAt: patch.finishedAt ?? current?.finishedAt,
  };

  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function POST(req: NextRequest) {
  const missing = assertClaudeApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as
    | {
        messages: Message[];
        identity: string;
        roundCount: number;
        sessionState?: SessionState;
        debugSessionId?: string;
        debugStartedAt?: string;
      }
    | null;

  if (!body || !Array.isArray(body.messages) || typeof body.roundCount !== "number") {
    return NextResponse.json({ error: "bad_request", detail: "请求体格式错误" }, { status: 400 });
  }

  const started = performance.now();
  let roundLog: LocalDebugRoundEntry | null = null;
  try {
    const { messages, roundCount, debugSessionId, debugStartedAt } = body;
    const baseSessionState = isSessionState(body.sessionState)
      ? body.sessionState
      : createInitialSessionState(debugSessionId || "server-session");
    const shouldTransition =
      baseSessionState.phase === "interview" && roundCount >= QUESTIONNAIRE_ENTRY_ROUND;
    const midDialogueKey = getMidDialogueKey(baseSessionState.phase);
    const researcherRoundCount = getResearcherRoundCount(roundCount);

    const requestedAt = new Date().toISOString();
    const retryEvents: ChatRetryEvent[] = [];
    roundLog = {
      round: roundCount,
      requestedAt,
      input: { identity: "用户", messages },
      agentB: {
        model: RESEARCHER_MODEL,
        temperature: 0.3,
        systemPrompt: RESEARCHER_TOOL_SYSTEM,
        userPrompt: midDialogueKey
          ? buildMidDialoguePrompt({ messages, sessionState: baseSessionState, dialogKey: midDialogueKey })
          : buildResearcherToolPrompt(messages, researcherRoundCount, baseSessionState),
        fallbackUsed: false,
      },
      agentA: {
        model: RESEARCHER_MODEL,
        temperature: 0.7,
        systemPrompt: RESEARCHER_TOOL_SYSTEM,
        historyMessages: messages.map((m) => ({ role: m.role, content: m.content })),
        userPrompt: "",
      },
      retryEvents,
    };

    let agentBOutput: AgentBOutput;
    let agentAModel = RESEARCHER_MODEL;
    let researcherFailed = false;

    if (roundCount === 0 && messages.length === 0) {
      let openingMessage = INTERVIEW_OPENING_MESSAGE;
      let openingModel = RESEARCHER_MODEL;
      try {
        openingMessage = await createOpusOpeningMessage(baseSessionState);
      } catch {
        openingModel = "deterministic";
      }
      agentBOutput = normalizeAgentBOutput(createOpeningAgentBOutput(), messages);
      const sessionState = nextSessionState(baseSessionState, agentBOutput, roundCount, "interview");
      roundLog.agentB.parsedOutput = agentBOutput;
      roundLog.agentA.model = openingModel;
      roundLog.agentA.outputText = openingMessage;
      if (debugSessionId && roundLog) {
        await upsertLocalDebugSession(debugSessionId, {
          identity: "用户",
          startedAt: debugStartedAt,
          rounds: [roundLog],
        });
      }
      return NextResponse.json({
        agentAMessage: openingMessage,
        agentAModel: openingModel,
        agentBOutput,
        sessionState,
        isComplete: false,
        thinkDurationSec: (performance.now() - started) / 1000,
      });
    }

    const agentBRetryDelayMs =
      shouldTransition
        ? QUESTIONNAIRE_AGENT_B_RETRY_DELAY_MS
        : DEFAULT_CHAT_RETRY_DELAY_MS;
    let researcherMessage = "";
    let researcherModel = RESEARCHER_MODEL;

    // Researcher updates state and, in interview rounds, writes the user-facing reply in the same model call.
    try {
      const toolResult = await withChatRetries(
        "researcher",
        async () => {
          return midDialogueKey
            ? createMidDialogueMessageWithFallback(messages, roundCount, baseSessionState, midDialogueKey)
            : createResearcherMessageWithFallback(messages, researcherRoundCount, baseSessionState);
        },
        {
          onRetry: (event) => retryEvents.push(event),
          retryDelayMs: agentBRetryDelayMs,
        }
      );
      researcherModel = toolResult.model;
      agentAModel = researcherModel;
      roundLog!.agentB.model = researcherModel;
      roundLog!.agentA.model = agentAModel;
      roundLog!.agentB.rawResponseText = JSON.stringify({
        stopReason: toolResult.stopReason,
        toolUses: toolResult.toolUses,
        textBlocks: toolResult.textBlocks,
      });
      const parsed = midDialogueKey
        ? midDialogueOutputFromToolUses(toolResult.toolUses, roundCount)
        : agentBOutputFromToolUses(toolResult.toolUses, researcherRoundCount);
      if (!parsed) throw new Error("Researcher tool call did not return a valid AgentBOutput");
      agentBOutput = midDialogueKey
        ? normalizeMidDialogueOutput({
            agentBOutput: parsed,
            messages,
            sessionState: baseSessionState,
            dialogKey: midDialogueKey,
          })
        : parsed;
      researcherMessage = midDialogueKey
        ? midDialogueTextFromResult({
            textBlocks: toolResult.textBlocks,
            agentBOutput,
            messages,
            sessionState: baseSessionState,
            dialogKey: midDialogueKey,
          })
        : researcherTextFromResult(toolResult.textBlocks, agentBOutput, researcherRoundCount);
      if (midDialogueKey && !researcherMessage && shouldGenerateAfterMidDialogue(agentBOutput)) {
        try {
          const repair = await createMidDialogueTransitionRepairMessageWithFallback(
            messages,
            baseSessionState,
            midDialogueKey,
            agentBOutput
          );
          researcherMessage = repair.message;
          agentAModel = repair.model;
          roundLog!.agentA.model = agentAModel;
        } catch {
          researcherMessage = buildMidDialogueCompletionText(midDialogueKey);
          agentAModel = "deterministic";
          roundLog!.agentA.model = agentAModel;
        }
      }
      if (
        !researcherMessage &&
        !shouldTransition &&
        !(midDialogueKey && shouldGenerateAfterMidDialogue(agentBOutput))
      ) {
        throw new Error("Researcher omitted required user-facing text");
      }
      roundLog!.agentB.parsedOutput = agentBOutput;
      roundLog!.agentA.outputText = researcherMessage;
    } catch {
      // Fallback directive if researcher fails after all retries
      roundLog!.agentB.fallbackUsed = true;
      researcherFailed = true;
      agentAModel = "deterministic";
      roundLog!.agentA.model = agentAModel;
      agentBOutput = buildFallbackAgentBOutput(baseSessionState, shouldTransition, Boolean(midDialogueKey));
    }
    if (roundLog) {
      agentBOutput = normalizeAgentBOutput(agentBOutput, messages);
      roundLog.agentB.parsedOutput = agentBOutput;
    }

    // Check if we should transition to questionnaire phase
    // Transition to questionnaire after 2 rounds of background collection
    if (shouldTransition) {
      agentBOutput = { ...agentBOutput, nextQuestions: [] };
      const sessionState = nextSessionState(baseSessionState, agentBOutput, roundCount, "questionnaire_batch1");

      if (debugSessionId && roundLog) {
        roundLog.agentB.parsedOutput = agentBOutput;
        await upsertLocalDebugSession(debugSessionId, {
          identity: "用户",
          startedAt: debugStartedAt,
          rounds: [roundLog],
        });
      }

      return NextResponse.json({
        agentAMessage: researcherFailed
          ? "好的，让我根据你的背景为你生成一套专属问卷。"
          : normalizeQuestionnaireTransitionText(researcherMessage),
        agentAModel,
        agentBOutput,
        sessionState,
        isComplete: false,
        nextPhase: "questionnaire" as const,
        thinkDurationSec: (performance.now() - started) / 1000,
      });
    }

    const isComplete =
      agentBOutput.directive.action === "conclude" || roundCount >= 8;
    const sessionState = nextSessionState(baseSessionState, agentBOutput, roundCount, getChatContinuationPhase(baseSessionState));

    const agentAMessage = researcherFailed
      ? (midDialogueKey
          ? buildMidDialogueCompletionText(midDialogueKey)
          : "可以再说一个你最近实际使用 AI 的具体场景吗？")
      : researcherMessage.trim();
    roundLog!.agentA.outputText = agentAMessage;

    if (debugSessionId && roundLog) {
      await upsertLocalDebugSession(debugSessionId, {
        identity: "用户",
        startedAt: debugStartedAt,
        rounds: [roundLog],
      });
    }

    return NextResponse.json({
      agentAMessage,
      agentAModel,
      agentBOutput,
      sessionState,
      isComplete,
      thinkDurationSec: (performance.now() - started) / 1000,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    if (body.debugSessionId) {
      if (roundLog) {
        roundLog.requestError = getUpstreamErrorMessage(error) ?? String(error);
      }
      await upsertLocalDebugSession(body.debugSessionId, {
        identity: "用户",
        startedAt: body.debugStartedAt,
        rounds: [
          roundLog ?? {
            round: body.roundCount ?? -1,
            requestedAt: new Date().toISOString(),
            input: { identity: "用户", messages: body.messages ?? [] },
            agentB: {
              model: RESEARCHER_MODEL,
              temperature: 0.3,
              systemPrompt: RESEARCHER_TOOL_SYSTEM,
              userPrompt: buildResearcherToolPrompt(
                body.messages ?? [],
                getResearcherRoundCount(body.roundCount ?? 0)
              ),
              fallbackUsed: false,
            },
            agentA: {
              model: RESEARCHER_MODEL,
              temperature: 0.7,
              systemPrompt: RESEARCHER_TOOL_SYSTEM,
              historyMessages: (body.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
              userPrompt: "",
            },
            retryEvents: [],
            requestError: getUpstreamErrorMessage(error) ?? String(error),
          },
        ],
      });
    }
    const detail = getUpstreamErrorMessage(error);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: detail ?? "请打开 Vercel → 该项目 → Logs / Functions 查看服务端报错。",
      },
      { status: 502 }
    );
  }
}

type ResearcherToolResult = ClaudeMessageWithToolsResult & { model: string };

function getResearcherRoundCount(roundCount: number): number {
  return Math.min(roundCount, QUESTIONNAIRE_ENTRY_ROUND - 1);
}

function getMidDialogueKey(phase: SessionState["phase"]): MidDialogueKey | undefined {
  if (phase === "mid_dialog1") return "dialog1";
  if (phase === "mid_dialog2") return "dialog2";
  return undefined;
}

function getChatContinuationPhase(sessionState: SessionState): SessionState["phase"] {
  if (sessionState.phase === "mid_dialog1" || sessionState.phase === "mid_dialog2") {
    return sessionState.phase;
  }
  return "interview";
}

function shouldGenerateAfterMidDialogue(agentBOutput: AgentBOutput): boolean {
  return Boolean(
    agentBOutput.shouldGenerateNextBatch ||
      agentBOutput.directive.action === "finish_mid_dialog"
  );
}

async function createOpusOpeningMessage(baseSessionState: SessionState): Promise<string> {
  const result = await createClaudeMessageWithTools({
    model: RESEARCHER_MODEL,
    system: buildResearcherSystemPrompt(baseSessionState),
    messages: [
      {
        role: "user",
        content:
          "这是 AI-MBTI 访谈第 0 轮。请用中文输出第一句自然开场。唯一任务：用轻松开放的语气询问用户的职业或身份，例如“嗨，欢迎！先聊聊你是做什么的吧？”。不要询问 AI 使用方式，不要询问目标，不要列表，不要 Markdown，不超过 40 字。",
      },
    ],
    tools: [],
    toolChoice: "none",
    temperature: 0.3,
    maxTokens: 512,
  });
  const normalized = normalizeInitialInterviewOpening(result.textBlocks.join("\n"));
  if (!normalized) throw new Error("Researcher omitted valid opening text");
  return normalized;
}

async function createResearcherMessageWithFallback(
  messages: Message[],
  roundCount: number,
  baseSessionState: SessionState
): Promise<ResearcherToolResult> {
  const params = {
    system: buildResearcherSystemPrompt(baseSessionState),
    messages: [{ role: "user" as const, content: buildResearcherToolPrompt(pruneOldTranscript(messages), roundCount, baseSessionState) }],
    tools: [getResearcherTool(roundCount)],
    toolChoice: getResearcherToolChoice(roundCount),
    temperature: 0.3,
    maxTokens: getResearcherMaxTokens(roundCount, RESEARCHER_MAX_TOKENS),
  };
  try {
    return {
      ...(await createClaudeMessageWithTools({
        ...params,
        model: RESEARCHER_MODEL,
      })),
      model: RESEARCHER_MODEL,
    };
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    return {
      ...(await createClaudeMessageWithTools({
        ...params,
        model: RESEARCHER_FALLBACK_MODEL,
      })),
      model: RESEARCHER_FALLBACK_MODEL,
    };
  }
}

async function createMidDialogueMessageWithFallback(
  messages: Message[],
  roundCount: number,
  baseSessionState: SessionState,
  dialogKey: MidDialogueKey
): Promise<ResearcherToolResult> {
  const params = {
    system: buildResearcherSystemPrompt(baseSessionState),
    messages: [
      {
        role: "user" as const,
        content: buildMidDialoguePrompt({
          messages: pruneOldTranscript(messages, 4),
          sessionState: baseSessionState,
          dialogKey,
        }),
      },
    ],
    tools: [UPDATE_MID_DIALOGUE_TOOL],
    toolChoice: getMidDialogueToolChoice(),
    temperature: 0.25,
    maxTokens: Math.min(RESEARCHER_MAX_TOKENS, 1024),
  };
  try {
    return {
      ...(await createClaudeMessageWithTools({
        ...params,
        model: RESEARCHER_MODEL,
      })),
      model: RESEARCHER_MODEL,
    };
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    return {
      ...(await createClaudeMessageWithTools({
        ...params,
        model: RESEARCHER_FALLBACK_MODEL,
      })),
      model: RESEARCHER_FALLBACK_MODEL,
    };
  }
}

async function createMidDialogueTransitionRepairMessageWithFallback(
  messages: Message[],
  baseSessionState: SessionState,
  dialogKey: MidDialogueKey,
  agentBOutput: AgentBOutput
): Promise<{ message: string; model: string }> {
  const params = {
    system: buildResearcherSystemPrompt(baseSessionState),
    messages: [
      {
        role: "user" as const,
        content: buildMidDialogueTransitionRepairPrompt({
          messages: pruneOldTranscript(messages, 4),
          sessionState: baseSessionState,
          dialogKey,
          agentBOutput,
        }),
      },
    ],
    tools: [],
    toolChoice: "none" as const,
    temperature: 0.2,
    maxTokens: 256,
  };
  const callModel = async (model: string) => {
    const result = await createClaudeMessageWithTools({
      ...params,
      model,
    });
    const message = normalizeMidDialogueTransitionRepairText(result.textBlocks.join("\n"));
    if (!message) throw new Error("Researcher repair omitted valid mid-dialogue transition text");
    return { message, model };
  };

  try {
    return await callModel(RESEARCHER_MODEL);
  } catch (error) {
    if (RESEARCHER_FALLBACK_MODEL === RESEARCHER_MODEL) throw error;
    return callModel(RESEARCHER_FALLBACK_MODEL);
  }
}

function buildFallbackAgentBOutput(
  state: SessionState,
  shouldTransition: boolean,
  isMidDialogue: boolean
): AgentBOutput {
  const targetContext = {
    role: state.background.role,
    recentUse: state.refinedTargetContext?.recentUse ?? state.background.recentUse,
    goal: state.refinedTargetContext?.goal ?? state.background.goal,
    goalStatus: state.refinedTargetContext?.goalStatus ?? state.background.goalStatus,
    goalType: state.refinedTargetContext?.goalType ?? state.background.goalType,
  };
  if (isMidDialogue) {
    return {
      analysis: {
        reasoning: "中途对话解析失败，按当前场景继续生成下一批题目。",
        background_summary: state.background.summary ?? "用户背景已记录。",
      },
      directive: {
        action: "finish_mid_dialog",
        hint: "好的，我会按你当前的场景继续调整下一批题目。",
      },
      targetContext,
      nextQuestions: [],
      scenarioGuidance: {
        status: "confirmed",
        scenarioSummary: targetContext.goal || targetContext.recentUse,
        granularity: "balanced",
        avoidTopics: [],
        includeTopics: [targetContext.recentUse, targetContext.goal].filter(Boolean),
      },
      shouldGenerateNextBatch: true,
    };
  }
  return {
    analysis: {
      reasoning: shouldTransition
        ? "访谈阶段已达到问卷入口，交由批次问卷生成接口继续。"
        : "访谈分析失败，使用保守提示继续收集背景。",
      background_summary: state.background.summary ?? "用户背景收集中",
    },
    directive: {
      action: shouldTransition ? "start_questionnaire" : "probe_new",
      hint: shouldTransition ? "进入第一批问卷。" : "继续了解用户的 AI 使用背景。",
    },
    targetContext,
    nextQuestions: [],
  };
}

function normalizeAgentBOutput(agentBOutput: AgentBOutput, messages: Message[]): AgentBOutput {
  return {
    ...agentBOutput,
    targetContext: normalizeTargetContext(
      agentBOutput.targetContext,
      inferTargetContextFromMessages(messages)
    ),
  };
}

function nextSessionState(
  state: SessionState,
  agentBOutput: AgentBOutput,
  roundCount: number,
  phase: SessionState["phase"]
): SessionState {
  return applySessionStatePatch(
    state,
    buildSessionStatePatchFromAgentBOutput(agentBOutput, roundCount),
    {
      turn: roundCount + 1,
      phase,
    }
  );
}
