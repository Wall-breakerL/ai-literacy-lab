import { NextRequest, NextResponse } from "next/server";
import { HQ_INTERVIEW_AGENT_A_SYSTEM } from "@/lib/hqAgents";
import client, {
  AGENT_A_MODEL,
  assertQwenApiKey,
  getUpstreamErrorMessage,
} from "@/lib/minimax";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { withLlmRetry } from "@/lib/llmRetry";
import type { Message } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const missing = assertQwenApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { messages: Message[] } | null;

  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "bad_request", detail: "请求体需包含 messages 数组" }, { status: 400 });
  }

  try {
    const response = await withLlmRetry(() =>
      client.chat.completions.create({
        model: AGENT_A_MODEL,
        messages: [
          { role: "system", content: HQ_INTERVIEW_AGENT_A_SYSTEM },
          ...body.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        temperature: 0.65,
      })
    );

    const agentAMessage = stripHiddenReasoning(
      response.choices[0].message.content ?? "感谢你的回答，请点击下方按钮生成报告。"
    );

    const isComplete = agentAMessage.includes("__INTERVIEW_COMPLETE__");
    const cleanMessage = agentAMessage.replace("__INTERVIEW_COMPLETE__", "").trim();

    return NextResponse.json({
      agentAMessage: cleanMessage,
      agentAModel: AGENT_A_MODEL,
      isComplete,
    });
  } catch (error) {
    console.error("HQ chat API error:", error);
    const detail = getUpstreamErrorMessage(error);
    return NextResponse.json(
      { error: "Internal server error", detail: detail ?? "请查看服务端日志。" },
      { status: 502 }
    );
  }
}
