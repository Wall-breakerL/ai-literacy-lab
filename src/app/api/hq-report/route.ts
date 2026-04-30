// [archived] AI-HQ v0.1 — pending rework as MBTI capability sub-module. See docs/codex-next-iteration.md §Phase 3.
import { NextRequest, NextResponse } from "next/server";
import { buildHQAgentBPromptFromMessages, HQ_AGENT_B_SYSTEM } from "@/lib/hqAgents";
import { withLlmRetry } from "@/lib/llmRetry";
import {
  AGENT_B_MAX_TOKENS,
  AGENT_B_MODEL,
  assertClaudeApiKey,
  createClaudeMessage,
  getUpstreamErrorMessage,
} from "@/lib/claude";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import {
  buildHQReportFromDraft,
  HQReportDraft,
  validateHQReportDraft,
} from "@/lib/hqScoring";
import { parseJsonObjectFromModel } from "@/lib/jsonResponse";
import type { Message } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const missing = assertClaudeApiKey();
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

    const responseText = await withLlmRetry(() =>
      createClaudeMessage({
        model: AGENT_B_MODEL,
        system: HQ_AGENT_B_SYSTEM,
        messages: [
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        maxTokens: AGENT_B_MAX_TOKENS,
      })
    );

    const raw = stripHiddenReasoning(responseText || "{}");

    try {
      const draft = parseJsonObjectFromModel<HQReportDraft>(raw, validateHQReportDraft);
      if (!validateHQReportDraft(draft)) {
        return NextResponse.json({ error: "Invalid HQ report draft", raw }, { status: 500 });
      }
      const report = buildHQReportFromDraft(draft);
      return NextResponse.json(report);
    } catch {
      return NextResponse.json({ error: "Failed to parse report JSON", raw }, { status: 500 });
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
