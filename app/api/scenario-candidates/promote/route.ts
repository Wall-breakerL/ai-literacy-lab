import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getProjectRoot } from "@/lib/storage/paths";
import { getRuntimeCandidateById, saveRuntimeCandidate } from "@/lib/scenario-v2/runtime-loader";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { scenarioId?: string };
    const scenarioId = body.scenarioId?.trim();
    if (!scenarioId) {
      return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
    }

    const candidate = await getRuntimeCandidateById(scenarioId);
    if (!candidate) {
      return NextResponse.json({ error: "candidate not found" }, { status: 404 });
    }

    const full = path.join(getProjectRoot(), "data", "scenario-blueprints", `${scenarioId}.json`);
    await fs.writeFile(full, JSON.stringify(candidate.blueprint, null, 2), "utf-8");

    await saveRuntimeCandidate({ ...candidate, status: "promoted" });

    return NextResponse.json({ ok: true, scenarioId, promotedPath: full });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
