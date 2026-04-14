import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AGENT_A_SYSTEM,
  AGENT_B_SYSTEM,
  buildAgentAPrompt,
  buildAgentBPrompt,
} from "@/lib/agents";
import client, {
  AGENT_A_MODEL,
  AGENT_B_MODEL,
  assertQwenApiKey,
  getUpstreamErrorMessage,
} from "@/lib/minimax";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { AgentBOutput, Message } from "@/lib/types";

/** Vercel：连续两次模型调用易超过默认 10s；Pro 可生效至 60s。Hobby 仅 10s 时可能超时，需升级或换更快模型。 */
export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_CHAT_RETRIES = Math.max(
  1,
  Number.parseInt(process.env.QWEN_CHAT_MAX_RETRIES ?? "3", 10) || 3
);
const LOCAL_DEBUG_ROOT = path.join(process.cwd(), ".local-debug", "interview-runs");

type ChatRetryEvent = {
  label: "agent-a" | "agent-b";
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
    qwenBaseUrl: string;
    maxChatRetries: number;
    retryDelayMs: number;
    agentA: { model: string; temperature: number; systemPrompt: string };
    agentB: { model: string; temperature: number; systemPrompt: string };
  };
  rounds: LocalDebugRoundEntry[];
  transcript?: Message[];
  finishedAt?: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 单次上游调用失败则重试，直至成功或用尽次数（避免无限循环与账单失控）。 */
async function withChatRetries<T>(
  label: "agent-a" | "agent-b",
  fn: () => Promise<T>,
  options?: { onRetry?: (event: ChatRetryEvent) => void }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CHAT_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt >= MAX_CHAT_RETRIES) break;
      const delayMs = 20_000;
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
        qwenBaseUrl:
          process.env.QWEN_BASE_URL?.trim() || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        maxChatRetries: MAX_CHAT_RETRIES,
        retryDelayMs: 20_000,
        agentA: { model: AGENT_A_MODEL, temperature: 0.7, systemPrompt: AGENT_A_SYSTEM },
        agentB: { model: AGENT_B_MODEL, temperature: 0.3, systemPrompt: AGENT_B_SYSTEM },
      },
    rounds: [...(current?.rounds ?? []), ...(patch.rounds ?? [])],
    transcript: patch.transcript ?? current?.transcript,
    finishedAt: patch.finishedAt ?? current?.finishedAt,
  };

  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function POST(req: NextRequest) {
  const missing = assertQwenApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as
    | {
        messages: Message[];
        identity: string;
        roundCount: number;
        debugSessionId?: string;
        debugStartedAt?: string;
      }
    | null;

  if (!body || !Array.isArray(body.messages) || typeof body.identity !== "string" || typeof body.roundCount !== "number") {
    return NextResponse.json({ error: "bad_request", detail: "请求体格式错误" }, { status: 400 });
  }

  let roundLog: LocalDebugRoundEntry | null = null;
  try {
    const { messages, identity, roundCount, debugSessionId, debugStartedAt } = body;

    const requestedAt = new Date().toISOString();
    const retryEvents: ChatRetryEvent[] = [];
    roundLog = {
      round: roundCount,
      requestedAt,
      input: { identity, messages },
      agentB: {
        model: AGENT_B_MODEL,
        temperature: 0.3,
        systemPrompt: AGENT_B_SYSTEM,
        userPrompt: buildAgentBPrompt(messages, roundCount),
        fallbackUsed: false,
      },
      agentA: {
        model: AGENT_A_MODEL,
        temperature: 0.7,
        systemPrompt: AGENT_A_SYSTEM,
        historyMessages: messages.map((m) => ({ role: m.role, content: m.content })),
        userPrompt: "",
      },
      retryEvents,
    };

    // Step 1: Agent B analyzes conversation and issues directive
    let agentBOutput: AgentBOutput;
    try {
      agentBOutput = await withChatRetries("agent-b", async () => {
        const bResponse = await client.chat.completions.create({
          model: AGENT_B_MODEL,
          messages: [
            { role: "system", content: AGENT_B_SYSTEM },
            { role: "user", content: buildAgentBPrompt(messages, roundCount) },
          ],
          temperature: 0.3,
        });
        const raw = stripHiddenReasoning(bResponse.choices[0].message.content ?? "{}");
        roundLog!.agentB.rawResponseText = raw;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : raw) as AgentBOutput;
      }, { onRetry: (event) => retryEvents.push(event) });
      roundLog!.agentB.parsedOutput = agentBOutput;
    } catch {
      // Fallback directive if B fails after all retries
      roundLog!.agentB.fallbackUsed = true;
      agentBOutput = {
        analysis: {
          reasoning: "Agent B 在重试上限内未返回可解析结果，使用兜底策略继续访谈流程。",
          signals_detected: [],
          current_status: "分析失败，继续访谈",
          coverage: {
            Relation: "uncovered",
            Workflow: "uncovered",
            Epistemic: "uncovered",
            RepairScope: "uncovered",
          },
        },
        directive: {
          action: roundCount >= 8 ? "conclude" : "probe_new",
          target_dimension: "Relation",
          hint: "继续了解用户的AI使用习惯",
        },
      };
    }

    const isComplete =
      agentBOutput.directive.action === "conclude" || roundCount >= 8;

    // Step 2: Agent A generates natural response based on directive
    const aMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: AGENT_A_SYSTEM },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: buildAgentAPrompt(agentBOutput.directive, identity),
      },
    ];
    roundLog!.agentA.userPrompt = buildAgentAPrompt(agentBOutput.directive, identity);

    const aResponse = await withChatRetries(
      "agent-a",
      () =>
        client.chat.completions.create({
          model: AGENT_A_MODEL,
          messages: aMessages,
          temperature: 0.7,
        }),
      { onRetry: (event) => retryEvents.push(event) }
    );

    const agentAMessage = stripHiddenReasoning(
      aResponse.choices[0].message.content ?? "感谢你的分享。"
    );
    roundLog!.agentA.outputText = agentAMessage;

    if (debugSessionId && roundLog) {
      await upsertLocalDebugSession(debugSessionId, {
        identity,
        startedAt: debugStartedAt,
        rounds: [roundLog],
      });
    }

    return NextResponse.json({
      agentAMessage,
      agentAModel: AGENT_A_MODEL,
      agentBOutput,
      isComplete,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    if (body.debugSessionId && body.identity) {
      if (roundLog) {
        roundLog.requestError = getUpstreamErrorMessage(error) ?? String(error);
      }
      await upsertLocalDebugSession(body.debugSessionId, {
        identity: body.identity,
        startedAt: body.debugStartedAt,
        rounds: [
          roundLog ?? {
            round: body.roundCount ?? -1,
            requestedAt: new Date().toISOString(),
            input: { identity: body.identity, messages: body.messages ?? [] },
            agentB: {
              model: AGENT_B_MODEL,
              temperature: 0.3,
              systemPrompt: AGENT_B_SYSTEM,
              userPrompt: buildAgentBPrompt(body.messages ?? [], body.roundCount ?? 0),
              fallbackUsed: false,
            },
            agentA: {
              model: AGENT_A_MODEL,
              temperature: 0.7,
              systemPrompt: AGENT_A_SYSTEM,
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
