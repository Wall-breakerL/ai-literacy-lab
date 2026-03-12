import type { Scenario } from "./types";

// Static import so bundler includes JSON; works in both server and client.
import messageStudent from "@/data/scenarios/message_student.json";
import messageGeneral from "@/data/scenarios/message_general.json";
import choiceStudent from "@/data/scenarios/choice_student.json";
import choiceGeneral from "@/data/scenarios/choice_general.json";

const scenarios: Scenario[] = [
  messageStudent as Scenario,
  messageGeneral as Scenario,
  choiceStudent as Scenario,
  choiceGeneral as Scenario,
];

export function getScenarioById(id: string): Scenario | null {
  return scenarios.find((s) => s.id === id) ?? null;
}

export function getAllScenarios(): Scenario[] {
  return scenarios;
}
