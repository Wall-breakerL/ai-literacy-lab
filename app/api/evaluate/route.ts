import { NextRequest, NextResponse } from "next/server";
import { runEvaluationV2 } from "@/lib/evaluation/run-evaluation-v2";
import type { ChatMessage } from "@/lib/types";
import { resolveBlueprintById } from "@/lib/scenario-v2/resolver";
import type { IdentityDossier } from "@/lib/identity/types";
import { readJsonFile, writeJsonFile } from "@/lib/storage/file-json-storage";
import { buildExperienceCard } from "@/lib/memory/experience-card";
import { emptyUserMemory, mergeUserMemoryWithExperience } from "@/lib/memory/user-memory";
import type { UserMemoryCard } from "@/lib/memory/user-memory";
import { createDefaultDossier } from "@/lib/identity/default-dossier";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, scenarioId, messages, identityId, userId, includeRawJudge, talkPrompt } = body as {
      sessionId: string;
      scenarioId: string;
      messages: ChatMessage[];
      identityId?: string;
      userId?: string;
      includeRawJudge?: boolean;
      talkPrompt?: string;
    };

    if (!sessionId || !scenarioId || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "sessionId, scenarioId, messages required" },
        { status: 400 }
      );
    }

    const blueprint = await resolveBlueprintById(scenarioId);
    if (!blueprint) {
      return NextResponse.json(
        { error: "Unknown scenario blueprint (v2 only)" },
        { status: 404 }
      );
    }

    const dossier = identityId
      ? await readJsonFile<IdentityDossier>(`identities/${identityId}.json`)
      : null;
    const active = dossier ?? createDefaultDossier();
    const identityVersion = active.version;
    const compiled = active.compiledPrompt;

    const v2 = await runEvaluationV2({
      sessionId,
      scenarioId,
      messages,
      identityId: active.identityId,
      identityCompiledPrompt: compiled,
      identityVersion,
      talkPrompt,
    });

    const transcriptHint = messages
      .filter((m: ChatMessage) => m.role === "user")
      .map((m: ChatMessage) => m.content.slice(0, 80))
      .join(" | ");

    const card = buildExperienceCard(v2, {
      sessionId,
      userId,
      identityVersion,
      transcriptHint,
      identitySummary: active.structuredSummary,
    });
    await writeJsonFile(`experiences/${sessionId}.json`, card);

    if (userId) {
      const path = `users/${userId}.json`;
      const prev = (await readJsonFile<UserMemoryCard>(path)) ?? emptyUserMemory(userId);
      await writeJsonFile(path, mergeUserMemoryWithExperience(prev, card));
    }

    const { events: ev, ...rest } = v2;
    const payload = {
      ...rest,
      kind: "v2" as const,
      events: includeRawJudge ? ev : undefined,
      rawJudgeJson: includeRawJudge ? v2 : undefined,
    };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
