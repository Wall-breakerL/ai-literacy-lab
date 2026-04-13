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
      const bResponse = await client.chat.completions.create({
        model: AGENT_B_MODEL,
        messages: [
          { role: "system", content: AGENT_B_SYSTEM },
          { role: "user", content: buildAgentBPrompt(messages, roundCount) },
        ],
        temperature: 0.3,
      });
      const raw = stripHiddenReasoning(bResponse.choices[0].message.content ?? "{}");
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      agentBOutput = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      // Fallback directive if B fails
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

    const aResponse = await client.chat.completions.create({
      model: AGENT_A_MODEL,
      messages: aMessages,
      temperature: 0.7,
    });

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
