import { NextRequest, NextResponse } from "next/server";
import {
  RESEARCHER_FALLBACK_MODEL,
  RESEARCHER_MAX_TOKENS,
  RESEARCHER_MODEL,
  assertClaudeApiKey,
  createClaudeMessageWithTools,
  getUpstreamErrorMessage,
  type ClaudeMessageWithToolsResult,
} from "@/lib/claude";
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
  researcherTextFromResult,
  UPDATE_MID_DIALOGUE_TOOL,
} from "@/lib/researcher";
import {
  applySessionStatePatch,
  buildSessionStatePatchFromAgentBOutput,
  createInitialSessionState,
  isSessionState,
  pruneOldTranscript,
} from "@/lib/sessionState";
import { createSseStream, encodeStreamEvent, encodeText, SSE_HEADERS } from "@/lib/streamResponse";
import { inferTargetContextFromMessages, normalizeTargetContext } from "@/lib/targetContext";
import type { AgentBOutput, Message, MidDialogueKey, SessionState } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const STREAM_CHUNK_DELAY_MS = 18;
const STREAM_CHUNK_SIZE = 2;

export async function POST(req: NextRequest) {
  const missing = assertClaudeApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        messages: Message[];
        roundCount: number;
        sessionState?: SessionState;
      }
    | null;

  if (!body || !Array.isArray(body.messages) || typeof body.roundCount !== "number") {
    return NextResponse.json({ error: "bad_request", detail: "请求体格式错误" }, { status: 400 });
  }

  const stream = createSseStream(async (controller) => {
    const started = performance.now();
    const { messages, roundCount } = body;
    const baseSessionState = isSessionState(body.sessionState)
      ? body.sessionState
      : createInitialSessionState("server-session");
    let agentBOutput: AgentBOutput;
    let researcherMessage = "";
    let researcherModel = RESEARCHER_MODEL;
    let agentAModel = RESEARCHER_MODEL;

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
      controller.enqueue(encodeText(encodeStreamEvent("meta", { agentAModel: openingModel })));
      await enqueueTextDeltas(controller, openingMessage);
      controller.enqueue(
        encodeText(
          encodeStreamEvent("done", {
            agentAMessage: openingMessage,
            agentAModel: openingModel,
            agentBOutput,
            sessionState,
            isComplete: false,
            thinkDurationSec: (performance.now() - started) / 1000,
          })
        )
      );
      return;
    }

    const shouldTransition =
      baseSessionState.phase === "interview" && roundCount >= QUESTIONNAIRE_ENTRY_ROUND;
    const midDialogueKey = getMidDialogueKey(baseSessionState.phase);
    const shouldShowQuestionnaireGenerationStatus = shouldTransition || Boolean(midDialogueKey);

    try {
      controller.enqueue(
        encodeText(
          encodeStreamEvent("status", {
            label: shouldShowQuestionnaireGenerationStatus ? "个性化生成问卷中…" : "分析对话中…",
          })
        )
      );

      if (midDialogueKey) {
        const toolResult = await createMidDialogueMessageWithFallback(messages, roundCount, baseSessionState, midDialogueKey);
        const parsed = midDialogueOutputFromToolUses(toolResult.toolUses, roundCount);
        if (!parsed) throw new Error("Researcher tool call did not return a valid mid-dialogue output");
        agentBOutput = normalizeMidDialogueOutput({
          agentBOutput: parsed,
          messages,
          sessionState: baseSessionState,
          dialogKey: midDialogueKey,
        });
        researcherModel = toolResult.model;
        agentAModel = researcherModel;
        researcherMessage = midDialogueTextFromResult({
          textBlocks: toolResult.textBlocks,
          agentBOutput,
          messages,
          sessionState: baseSessionState,
          dialogKey: midDialogueKey,
        });
        if (!researcherMessage && shouldGenerateAfterMidDialogue(agentBOutput)) {
          try {
            const repair = await createMidDialogueTransitionRepairMessageWithFallback(
              messages,
              baseSessionState,
              midDialogueKey,
              agentBOutput
            );
            researcherMessage = repair.message;
            agentAModel = repair.model;
          } catch {
            researcherMessage = buildMidDialogueCompletionText(midDialogueKey);
            // 工具已成功解析；仅补写可见句失败，仍标注本轮已调用的上游模型（勿用 deterministic，否则前端隐藏模型名）
            agentAModel = researcherModel;
          }
        }
        if (!researcherMessage && !shouldGenerateAfterMidDialogue(agentBOutput)) {
          throw new Error("Researcher omitted required user-facing mid-dialogue text");
        }
        if (researcherMessage) {
          controller.enqueue(encodeText(encodeStreamEvent("meta", { agentAModel })));
          await enqueueTextDeltas(controller, researcherMessage);
        }
      } else {
        const researcherRoundCount = getResearcherRoundCount(roundCount);
        const toolResult = await createResearcherMessageWithFallback(messages, researcherRoundCount, baseSessionState);
        const parsed = agentBOutputFromToolUses(toolResult.toolUses, researcherRoundCount);
        if (!parsed) throw new Error("Researcher tool call did not return a valid AgentBOutput");
        agentBOutput = parsed;
        researcherModel = toolResult.model;
        agentAModel = researcherModel;
        researcherMessage = researcherTextFromResult(toolResult.textBlocks, agentBOutput, researcherRoundCount);
        if (!researcherMessage && !shouldTransition) {
          throw new Error("Researcher omitted required user-facing interview text");
        }
        if (!shouldTransition && researcherRoundCount < QUESTIONNAIRE_ENTRY_ROUND && researcherMessage) {
          controller.enqueue(encodeText(encodeStreamEvent("meta", { agentAModel })));
          await enqueueTextDeltas(controller, researcherMessage);
        }
      }
    } catch (error) {
      controller.enqueue(
        encodeText(
          encodeStreamEvent("error", {
            message: getUpstreamErrorMessage(error) ?? "流式分析失败，切换到稳定模式重试。",
          })
        )
      );
      return;
    }

    agentBOutput = normalizeAgentBOutput(agentBOutput, messages);

    if (shouldTransition) {
      const transitionMessage = normalizeQuestionnaireTransitionText(researcherMessage);
      agentBOutput = { ...agentBOutput, nextQuestions: [] };
      const sessionState = nextSessionState(baseSessionState, agentBOutput, roundCount, "questionnaire_batch1");
      if (transitionMessage) {
        controller.enqueue(encodeText(encodeStreamEvent("meta", { agentAModel })));
        await enqueueTextDeltas(controller, transitionMessage);
      }
      controller.enqueue(
        encodeText(
          encodeStreamEvent("done", {
            agentAMessage: transitionMessage,
            agentAModel,
            agentBOutput,
            sessionState,
            isComplete: false,
            nextPhase: "questionnaire",
            thinkDurationSec: (performance.now() - started) / 1000,
          })
        )
      );
      return;
    }

    const isComplete = agentBOutput.directive.action === "conclude" || roundCount >= 8;
    const sessionState = nextSessionState(baseSessionState, agentBOutput, roundCount, getChatContinuationPhase(baseSessionState));
    const agentAMessage = researcherMessage.trim();
    controller.enqueue(
      encodeText(
        encodeStreamEvent("done", {
          agentAMessage,
          agentAModel,
          agentBOutput,
          sessionState,
          isComplete,
          thinkDurationSec: (performance.now() - started) / 1000,
        })
      )
    );
  });

  return new Response(stream, { headers: SSE_HEADERS });
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

async function enqueueTextDeltas(
  controller: ReadableStreamDefaultController<Uint8Array>,
  text: string
) {
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += STREAM_CHUNK_SIZE) {
    const chunk = chars.slice(i, i + STREAM_CHUNK_SIZE).join("");
    controller.enqueue(encodeText(encodeStreamEvent("delta", { text: chunk })));
    if (i + STREAM_CHUNK_SIZE < chars.length) {
      await sleep(STREAM_CHUNK_DELAY_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
