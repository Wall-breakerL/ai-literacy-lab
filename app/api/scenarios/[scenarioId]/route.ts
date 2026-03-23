import { NextRequest, NextResponse } from "next/server";
import { resolveBlueprintById } from "@/lib/scenario-v2/resolver";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ scenarioId: string }> | { scenarioId: string } }
) {
  const params = context.params instanceof Promise ? await context.params : context.params;
  const scenarioId = params.scenarioId;
  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
  }

  const blueprint = await resolveBlueprintById(scenarioId);
  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint not found" }, { status: 404 });
  }

  return NextResponse.json({ kind: "blueprint", blueprint });
}
