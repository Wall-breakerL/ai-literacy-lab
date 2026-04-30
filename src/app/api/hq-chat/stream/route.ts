// [archived] AI-HQ v0.1 — pending rework as an AI-MBTI report sub-module.
import { NextRequest, NextResponse } from "next/server";
import {
  buildHQInterviewAgentAPrompt,
  getHQRoundState,
  HQ_INTERVIEW_AGENT_A_SYSTEM,
} from "@/lib/hqAgents";
import {
  AGENT_A_MAX_TOKENS,
  AGENT_A_MODEL,
  assertClaudeApiKey,
  createClaudeMessageStream,
  getUpstreamErrorMessage,
} from "@/lib/claude";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { createSseStream, encodeStreamEvent, encodeText, SSE_HEADERS } from "@/lib/streamResponse";
import type { Message } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const missing = assertClaudeApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { messages: Message[] } | null;
  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "bad_request", detail: "请求体需包含 messages 数组" }, { status: 400 });
  }

  const roundState = getHQRoundState(body.messages);
  if (roundState.isComplete) {
    return NextResponse.json({
      agentAMessage: "谢谢你完成这 5 段访谈。我已经有足够信息生成《AI-HQ 报告》，你可以点击下方按钮查看结果。",
      agentAModel: "deterministic",
      isComplete: true,
    });
  }

  const prompt = buildHQInterviewAgentAPrompt({
    messages: body.messages,
    roundState,
  });

  const stream = createSseStream(async (controller) => {
    const started = performance.now();
    let fullText = "";
    try {
      controller.enqueue(
        encodeText(
          encodeStreamEvent("meta", {
            agentAModel: AGENT_A_MODEL,
            roundIndex: roundState.roundIndex,
            roundId: roundState.round?.id,
          })
        )
      );

      for await (const chunk of createClaudeMessageStream({
        model: AGENT_A_MODEL,
        system: HQ_INTERVIEW_AGENT_A_SYSTEM,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.65,
        maxTokens: AGENT_A_MAX_TOKENS,
      })) {
        fullText += chunk;
        controller.enqueue(encodeText(encodeStreamEvent("delta", { text: chunk })));
      }

      const cleanMessage = stripHiddenReasoning(fullText || "感谢你的回答，请点击下方按钮生成报告。")
        .replace("__INTERVIEW_COMPLETE__", "")
        .trim();
      controller.enqueue(
        encodeText(
          encodeStreamEvent("done", {
            agentAMessage: cleanMessage,
            agentAModel: AGENT_A_MODEL,
            isComplete: false,
            roundIndex: roundState.roundIndex,
            roundId: roundState.round?.id,
            thinkDurationSec: (performance.now() - started) / 1000,
          })
        )
      );
    } catch (error) {
      controller.enqueue(
        encodeText(
          encodeStreamEvent("error", {
            message: getUpstreamErrorMessage(error) ?? String(error),
          })
        )
      );
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
