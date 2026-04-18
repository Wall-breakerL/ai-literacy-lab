import { NextRequest, NextResponse } from "next/server";
import { buildHQAgentBPromptFromMessages, HQ_AGENT_B_SYSTEM } from "@/lib/hqAgents";
import { withLlmRetry } from "@/lib/llmRetry";
import client, {
  AGENT_B_MODEL,
  assertQwenApiKey,
  getUpstreamErrorMessage,
} from "@/lib/minimax";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { HQReport, Message } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const missing = assertQwenApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  try {
    const { messages } = await req.json() as { messages: Message[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "bad_request", detail: "messages 必须为非空数组" }, { status: 400 });
    }
    if (!messages.some((m) => m.role === "user")) {
      return NextResponse.json({ error: "bad_request", detail: "对话中需至少包含一条用户发言" }, { status: 400 });
    }

    const prompt = buildHQAgentBPromptFromMessages(messages);

    const response = await withLlmRetry(() =>
      client.chat.completions.create({
        model: AGENT_B_MODEL,
        messages: [
          { role: "system", content: HQ_AGENT_B_SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      })
    );

    const raw = stripHiddenReasoning(response.choices[0].message.content ?? "{}");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const reportStr = jsonMatch ? jsonMatch[0] : raw;

    try {
      const report: HQReport = JSON.parse(reportStr);
      return NextResponse.json(report);
    } catch {
      return NextResponse.json({ error: "Failed to parse report JSON", raw: reportStr }, { status: 500 });
    }
  } catch (error) {
    console.error("HQ Report API error:", error);
    const detail = getUpstreamErrorMessage(error);
    return NextResponse.json(
      { error: "Internal server error", detail: detail ?? "请查看 Vercel Function Logs。" },
      { status: 502 }
    );
  }
}
