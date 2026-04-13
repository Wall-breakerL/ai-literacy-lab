import { NextRequest, NextResponse } from "next/server";
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
  Number.parseInt(process.env.QWEN_CHAT_MAX_RETRIES ?? "5", 10) || 5
);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 单次上游调用失败则重试，直至成功或用尽次数（避免无限循环与账单失控）。 */
async function withChatRetries<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CHAT_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt >= MAX_CHAT_RETRIES) break;
      const delayMs = Math.min(500 * 2 ** (attempt - 1), 4000);
      console.warn(
        `[chat] ${label} attempt ${attempt}/${MAX_CHAT_RETRIES} failed, retry in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

export async function POST(req: NextRequest) {
  const missing = assertQwenApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  try {
    const { messages, identity, roundCount } = await req.json() as {
      messages: Message[];
      identity: string;
      roundCount: number;
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
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : raw) as AgentBOutput;
      });
    } catch {
      // Fallback directive if B fails after all retries
      agentBOutput = {
        analysis: {
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

    const aResponse = await withChatRetries("agent-a", () =>
      client.chat.completions.create({
        model: AGENT_A_MODEL,
        messages: aMessages,
        temperature: 0.7,
      })
    );

    const agentAMessage = stripHiddenReasoning(
      aResponse.choices[0].message.content ?? "感谢你的分享。"
    );

    return NextResponse.json({
      agentAMessage,
      agentAModel: AGENT_A_MODEL,
      agentBOutput,
      isComplete,
    });
  } catch (error) {
    console.error("Chat API error:", error);
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
