import { NextRequest, NextResponse } from "next/server";
import client, { MODEL } from "@/lib/minimax";
import { AGENT_B_REPORT_SYSTEM } from "@/lib/agents";
import { FinalReport, Message } from "@/lib/types";

export async function POST(req: NextRequest) {
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

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: AGENT_B_REPORT_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });

    const raw = response.choices[0].message.content ?? "{}";
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
