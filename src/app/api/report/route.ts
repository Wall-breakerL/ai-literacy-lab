import { NextRequest, NextResponse } from "next/server";
import { AGENT_B_REPORT_SYSTEM } from "@/lib/agents";
import { withLlmRetry } from "@/lib/llmRetry";
import client, {
  REPORT_MODEL,
  assertQwenApiKey,
  getUpstreamErrorMessage,
} from "@/lib/minimax";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { FinalReport, QuestionnaireAnswer } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const missing = assertQwenApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  try {
    const { identity, questionnaireAnswers } = await req.json() as {
      identity: string;
      questionnaireAnswers?: QuestionnaireAnswer[];
    };

    const answersText = questionnaireAnswers && questionnaireAnswers.length > 0
      ? questionnaireAnswers
          .map(
            (a, i) =>
              `【题目${i + 1}】\n维度：${a.dimension}\n场景：${a.scenario}\n题目：${a.question}\n回答：${a.score}分${a.reverse ? "（反向题）" : ""}`
          )
          .join("\n\n")
      : "无问卷回答";

    const prompt = `用户身份：${identity}

问卷回答：
${answersText}

请根据以上问卷回答生成AI-MBTI分析报告。`;

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
