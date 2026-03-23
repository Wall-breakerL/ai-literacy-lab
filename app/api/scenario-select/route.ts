import { NextRequest, NextResponse } from "next/server";
import { getDefaultEntryScenarioId } from "@/lib/scenario-router";
import { matchScenarioBlueprint } from "@/lib/scenario-v2/matcher";
import { buildGeneratedBlueprint } from "@/lib/scenario-v2/generator";
import { isScenarioBlueprint } from "@/lib/scenario-v2/types";
import { saveRuntimeCandidate } from "@/lib/scenario-v2/runtime-loader";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { taskPrompt?: string; identityId?: string };
    const taskPrompt = (body.taskPrompt ?? "").trim();

    if (!taskPrompt) {
      return NextResponse.json({
        scenarioId: getDefaultEntryScenarioId(),
        source: "default",
      });
    }

    const matched = matchScenarioBlueprint(taskPrompt);
    if (matched) {
      return NextResponse.json({
        scenarioId: matched.scenarioId,
        source: "matched",
        score: matched.score,
        reason: matched.reason,
      });
    }

    const generated = buildGeneratedBlueprint({ taskPrompt });
    if (!isScenarioBlueprint(generated)) {
      return NextResponse.json({
        scenarioId: getDefaultEntryScenarioId(),
        source: "fallback_default",
      });
    }

    await saveRuntimeCandidate({
      scenarioId: generated.id,
      source: "generated_candidate",
      taskPrompt,
      createdAt: new Date().toISOString(),
      status: "candidate",
      blueprint: generated,
    });

    return NextResponse.json({
      scenarioId: generated.id,
      source: "generated_candidate",
    });
  } catch (e) {
    return NextResponse.json(
      {
        scenarioId: getDefaultEntryScenarioId(),
        source: "fallback_default",
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
