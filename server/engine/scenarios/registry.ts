import type { ScenarioDataLayer } from "@/domain/scenes/scenario-data";
import type { SceneId } from "@/domain/scenes/types";
import { apartmentScenarioData } from "@/server/engine/scenarios/apartment-data";
import { brandScenarioData } from "@/server/engine/scenarios/brand-data";

const BY_ID: Record<SceneId, ScenarioDataLayer> = {
  "apartment-tradeoff": apartmentScenarioData,
  "brand-naming-sprint": brandScenarioData,
};

export function getScenarioDataLayer(sceneId: SceneId): ScenarioDataLayer {
  return BY_ID[sceneId];
}

export function cloneScenarioProbeRuntimes(layer: ScenarioDataLayer) {
  return layer.probeOverrides.map((p) => ({
    ...JSON.parse(JSON.stringify(p)),
    status: p.status,
    triggeredAtTurn: p.triggeredAtTurn,
  })) as import("@/domain/scenes/scenario-data").ScenarioProbeRuntime[];
}
