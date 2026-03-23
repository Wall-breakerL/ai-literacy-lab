import { getBlueprintById } from "./loader";
import { getRuntimeBlueprintById } from "./runtime-loader";
import type { ScenarioBlueprint } from "./types";

export async function resolveBlueprintById(scenarioId: string): Promise<ScenarioBlueprint | null> {
  const official = getBlueprintById(scenarioId);
  if (official) return official;
  return getRuntimeBlueprintById(scenarioId);
}
