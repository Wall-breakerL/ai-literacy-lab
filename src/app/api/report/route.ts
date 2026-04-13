import { NextRequest, NextResponse } from "next/server";
import { AGENT_B_REPORT_SYSTEM } from "@/lib/agents";
import { withLlmRetry } from "@/lib/llmRetry";
import client, {
  REPORT_MODEL,
  assertQwenApiKey,
  getUpstreamErrorMessage,
} from "@/lib/minimax";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { FinalReport, Message } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const missing = assertQwenApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  try {
    const { messages, identity } = await req.json() as {
      messages: Message[];
      identity: string;
    };

    const history = messages
      .map((m) => `${m.role === "assistant" ? "访谈官" : "用户"}：${m.content}`)
      .join("\n");

    const prompt = `用户身份：${identity}

完整访谈记录：
${history}

请根据以上记录生成AI-MBTI分析报告。`;

    const response = await withLlmRetry(() =>
      client.chat.completions.create({
        model: REPORT_MODEL,
        messages: [
          { role: "system", content: AGENT_B_REPORT_SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      })
    );

    const raw = stripHiddenReasoning(response.choices[0].message.content ?? "{}");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const reportStr = jsonMatch ? jsonMatch[0] : raw;

    try {
      const report: FinalReport = JSON.parse(reportStr);
      return NextResponse.json(report);
    } catch {
      // Fallback if parsing fails
      return NextResponse.json({ error: "Failed to parse report JSON", raw: reportStr }, { status: 500 });
    }
  } catch (error) {
    console.error("Report API error:", error);
    const detail = getUpstreamErrorMessage(error);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: detail ?? "请查看 Vercel Function Logs。",
      },
      { status: 502 }
    );
  }
}
