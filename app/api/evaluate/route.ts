import { NextRequest, NextResponse } from "next/server";
import { runEvaluation } from "@/lib/evaluation/run-evaluation";
import type { UserProfile, ChatMessage } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      scenarioId,
      profile,
      messages,
    } = body as {
      sessionId: string;
      scenarioId: string;
      profile: UserProfile;
      messages: ChatMessage[];
    };

    if (!sessionId || !scenarioId || !profile || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "sessionId, scenarioId, profile, messages required" },
        { status: 400 }
      );
    }

    const result = await runEvaluation({
      sessionId,
      scenarioId,
      profile,
      messages,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
