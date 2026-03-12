import { NextRequest, NextResponse } from "next/server";
import { getScenarioById } from "@/lib/scenario-loader";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ scenarioId: string }> | { scenarioId: string } }
) {
  const params = context.params instanceof Promise ? await context.params : context.params;
  const scenarioId = params.scenarioId;
  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
  }

  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  return NextResponse.json(scenario);
}
