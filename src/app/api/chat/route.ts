import { NextRequest, NextResponse } from "next/server";
import client, { MODEL } from "@/lib/minimax";
import {
  AGENT_A_SYSTEM,
  AGENT_B_SYSTEM,
  buildAgentAPrompt,
  buildAgentBPrompt,
} from "@/lib/agents";
import { AgentBOutput, Message } from "@/lib/types";

export async function POST(req: NextRequest) {
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
        model: MODEL,
        messages: [
          { role: "system", content: AGENT_B_SYSTEM },
          { role: "user", content: buildAgentBPrompt(messages, roundCount) },
        ],
        temperature: 0.3,
      });
      const raw = bResponse.choices[0].message.content ?? "{}";
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
      model: MODEL,
      messages: aMessages,
      temperature: 0.7,
    });

    const agentAMessage = aResponse.choices[0].message.content ?? "感谢你的分享。";

    return NextResponse.json({
      agentAMessage,
      agentBOutput,
      isComplete,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
