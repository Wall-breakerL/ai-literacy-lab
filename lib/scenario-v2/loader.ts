import type { ScenarioBlueprint } from "./types";
import { isScenarioBlueprint } from "./types";

import coordinationStudent from "@/data/scenario-blueprints/coordination_student_v1.json";

const blueprints: ScenarioBlueprint[] = [coordinationStudent as ScenarioBlueprint].filter(
  isScenarioBlueprint
);

export const BLUEPRINT_IDS = blueprints.map((b) => b.id) as readonly string[];

export function getBlueprintById(id: string): ScenarioBlueprint | null {
  return blueprints.find((b) => b.id === id) ?? null;
}

export function getAllBlueprints(): ScenarioBlueprint[] {
  return blueprints;
}
