import { NextResponse } from "next/server";
import { listRuntimeCandidates } from "@/lib/scenario-v2/runtime-loader";

export async function GET() {
  try {
    const candidates = await listRuntimeCandidates();
    return NextResponse.json({
      items: candidates.map((c) => ({
        scenarioId: c.scenarioId,
        status: c.status,
        taskPrompt: c.taskPrompt,
        createdAt: c.createdAt,
        source: c.source,
        version: c.blueprint.version,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
