import { getAllBlueprints } from "./loader";
import type { ScenarioBlueprint } from "./types";

export type ScenarioMatch = {
  scenarioId: string;
  score: number;
  reason: string;
  blueprint: ScenarioBlueprint;
};

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function collectBlueprintText(bp: ScenarioBlueprint): string {
  const fields = [
    bp.id,
    bp.family,
    ...(bp.applicableIdentityTags ?? []),
    bp.version,
  ];
  if (bp.phases?.helper) {
    fields.push(bp.phases.helper.worldState, bp.phases.helper.assistantRolePrompt);
  } else {
    fields.push(bp.worldState, bp.assistantRolePrompt);
  }
  if (bp.phases?.talk) {
    fields.push(
      bp.phases.talk.defaultTalkPrompt ?? "",
      bp.phases.talk.assistantRolePrompt
    );
  }
  return fields.join(" ").toLowerCase();
}

export function matchScenarioBlueprint(taskPrompt: string): ScenarioMatch | null {
  const queryTokens = new Set(tokenize(taskPrompt));
  if (queryTokens.size === 0) return null;

  let best: ScenarioMatch | null = null;
  for (const bp of getAllBlueprints()) {
    const text = collectBlueprintText(bp);
    let hit = 0;
    for (const token of Array.from(queryTokens)) {
      if (text.includes(token)) hit++;
    }
    const score = hit / queryTokens.size;
    if (!best || score > best.score) {
      best = {
        scenarioId: bp.id,
        score,
        reason: `token-hit ${hit}/${queryTokens.size}`,
        blueprint: bp,
      };
    }
  }
  if (!best) return null;

  // Conservative threshold; when only one generic blueprint exists, it won't over-match.
  return best.score >= 0.35 ? best : null;
}
