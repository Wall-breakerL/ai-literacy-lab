import { NextRequest, NextResponse } from "next/server";
import { resolveBlueprintById } from "@/lib/scenario-v2/resolver";
import { isTwoPhaseBlueprint } from "@/lib/scenario-v2/types";
import type { PhaseId } from "@/lib/scenario-v2/types";
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

/**
 * Check whether a user-supplied talk prompt hits the safety blocklist.
 */
function isTalkPromptBlocked(
  blueprint: Awaited<ReturnType<typeof resolveBlueprintById>>,
  promptText: string
): { blocked: boolean; fallbackMessage?: string } {
  if (!blueprint || !isTwoPhaseBlueprint(blueprint)) return { blocked: false };
  const safety = blueprint.phases!.talk.talkSafety;
  if (!safety) return { blocked: false };
  const lower = promptText.toLowerCase();
  for (const kw of safety.blockedKeywords) {
    if (lower.includes(kw.toLowerCase())) {
      return { blocked: true, fallbackMessage: safety.fallbackMessage };
    }
  }
  for (const cat of safety.blockedCategories) {
    if (lower.includes(cat.toLowerCase())) {
      return { blocked: true, fallbackMessage: safety.fallbackMessage };
    }
  }
  return { blocked: false };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, scenarioId, identityId, phase, talkPrompt } = body as {
      messages: { role: string; content: string }[];
      scenarioId?: string;
      identityId?: string;
      phase?: PhaseId;
      talkPrompt?: string;
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

    const blueprint = await resolveBlueprintById(scenarioId);
    if (!blueprint) {
      return NextResponse.json({ error: "Unknown scenario blueprint" }, { status: 404 });
    }

    // Talk safety gate: check user-provided talk prompt and last user message.
    if (phase === "talk" && isTwoPhaseBlueprint(blueprint)) {
      if (talkPrompt?.trim()) {
        const promptCheck = isTalkPromptBlocked(blueprint, talkPrompt);
        if (promptCheck.blocked) {
          return NextResponse.json({
            content: promptCheck.fallbackMessage ?? "请换一个讨论方向。",
            thinking: undefined,
          });
        }
      }
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const check = isTalkPromptBlocked(blueprint, lastUserMsg.content);
        if (check.blocked) {
          return NextResponse.json({
            content: check.fallbackMessage ?? "请换一个话题方向。",
            thinking: undefined,
          });
        }
      }
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
      phase: phase ?? undefined,
      talkPrompt: talkPrompt?.trim() || undefined,
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
