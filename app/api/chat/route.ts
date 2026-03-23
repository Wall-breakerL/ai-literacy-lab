import { NextRequest, NextResponse } from "next/server";
import { getBlueprintById } from "@/lib/scenario-v2/loader";
import { callChatApi } from "@/lib/llm/chat";
import { parseAssistantResponse } from "@/lib/parse-think";
import type { IdentityDossier } from "@/lib/identity/types";
import { readJsonFile } from "@/lib/storage/file-json-storage";

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
    const { messages, scenarioId, identityId } = body as {
      messages: { role: string; content: string }[];
      scenarioId?: string;
      identityId?: string;
    };

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages is required and must be an array" },
        { status: 400 }
      );
    }
    if (!scenarioId?.trim()) {
      return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
    }

    const blueprint = getBlueprintById(scenarioId);
    if (!blueprint) {
      return NextResponse.json({ error: "Unknown scenario blueprint" }, { status: 404 });
    }

    let identityCompiledPrompt: string | null = null;
    if (identityId) {
      const dossier = await readJsonFile<IdentityDossier>(`identities/${identityId}.json`);
      identityCompiledPrompt = dossier?.compiledPrompt ?? null;
    }
    const typedMessages = messages.filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );

    const raw = await callChatApi(typedMessages, scenarioId, {
      blueprint,
      identityCompiledPrompt,
    });
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
