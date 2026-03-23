import fs from "fs/promises";
import path from "path";
import { getRuntimeDir } from "@/lib/storage/paths";
import type { ScenarioBlueprint } from "./types";
import { isScenarioBlueprint } from "./types";

const CANDIDATE_DIR = "scenario-candidates";

export type ScenarioCandidateRecord = {
  scenarioId: string;
  source: "generated_candidate";
  taskPrompt: string;
  matchInfo?: { matchedScenarioId?: string; score?: number; reason?: string };
  createdAt: string;
  status: "candidate" | "promoted";
  blueprint: ScenarioBlueprint;
};

function candidatePath(scenarioId: string): string {
  return path.join(getRuntimeDir(), CANDIDATE_DIR, `${scenarioId}.json`);
}

export async function getRuntimeCandidateById(scenarioId: string): Promise<ScenarioCandidateRecord | null> {
  try {
    const raw = await fs.readFile(candidatePath(scenarioId), "utf-8");
    const parsed = JSON.parse(raw) as ScenarioCandidateRecord;
    if (!parsed?.blueprint || !isScenarioBlueprint(parsed.blueprint)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getRuntimeBlueprintById(scenarioId: string): Promise<ScenarioBlueprint | null> {
  const rec = await getRuntimeCandidateById(scenarioId);
  return rec?.blueprint ?? null;
}

export async function saveRuntimeCandidate(record: ScenarioCandidateRecord): Promise<void> {
  const full = candidatePath(record.scenarioId);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(record, null, 2), "utf-8");
}

export async function listRuntimeCandidates(): Promise<ScenarioCandidateRecord[]> {
  const dir = path.join(getRuntimeDir(), CANDIDATE_DIR);
  try {
    const names = await fs.readdir(dir);
    const jsonFiles = names.filter((n) => n.endsWith(".json"));
    const all = await Promise.all(
      jsonFiles.map(async (name) => {
        try {
          const raw = await fs.readFile(path.join(dir, name), "utf-8");
          return JSON.parse(raw) as ScenarioCandidateRecord;
        } catch {
          return null;
        }
      })
    );
    return all.filter((x): x is ScenarioCandidateRecord => Boolean(x)).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
  } catch {
    return [];
  }
}
