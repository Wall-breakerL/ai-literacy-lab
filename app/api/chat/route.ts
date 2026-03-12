import { NextRequest, NextResponse } from "next/server";
import { getScenarioById } from "@/lib/scenario-loader";
import { callChatApi } from "@/lib/llm/chat";
import { parseAssistantResponse } from "@/lib/parse-think";

const MOCK_REPLIES = [
  "好的，我根据你的需求整理了一下，你可以看看这样写是否合适。",
  "这里有几个要点可以再补充，比如时间、具体事由，对方会更清楚。",
  "如果你愿意，我可以按更正式/更口语的风格再改一版。",
  "你这边有没有特别在意的限制或偏好？可以说一下，我帮你一起筛。",
];

function getMockReply(turnIndex: number): string {
  return MOCK_REPLIES[turnIndex % MOCK_REPLIES.length];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, scenarioId } = body as {
      messages: { role: string; content: string }[];
      scenarioId?: string;
    };

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages is required and must be an array" },
        { status: 400 }
      );
    }

    const scenario = scenarioId ? getScenarioById(scenarioId) : null;
    const typedMessages = messages.filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );

    const raw = await callChatApi(typedMessages, scenarioId, scenario);
    const rawContent = raw?.trim() || getMockReply(messages.length);
    const { content, thinking } = parseAssistantResponse(rawContent);

    return NextResponse.json({ content, thinking });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
