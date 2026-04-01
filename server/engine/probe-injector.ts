import type { ScenarioDataLayer, ScenarioHiddenInfoBlock, ScenarioProbeRuntime } from "@/domain/scenes/scenario-data";
import { containsQuestioningSignal } from "@/server/engine/probe-tracker";

export type ChatTurn = { role: "user" | "assistant"; content: string };

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getLastUserMessage(history: ChatTurn[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]!.role === "user") return history[i]!.content;
  }
  return "";
}

function getRecentUserMessages(history: ChatTurn[], count: number): string[] {
  const out: string[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < count; i -= 1) {
    if (history[i]!.role === "user") out.push(history[i]!.content);
  }
  return out;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const k = parts[i]!;
    const next = cur[k];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value as never;
}

function deleteNestedField(obj: Record<string, unknown>, path: string): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const k = parts[i]!;
    const next = cur[k];
    if (next === null || typeof next !== "object" || Array.isArray(next)) return;
    cur = next as Record<string, unknown>;
  }
  delete cur[parts[parts.length - 1]!];
}

/** Remove a field named `fieldName` from every direct child object under `rootKey` (e.g. apartments.*.commute). */
function omitFieldFromChildren(root: Record<string, unknown>, rootKey: string, fieldName: string): void {
  const node = root[rootKey];
  if (node === null || typeof node !== "object" || Array.isArray(node)) return;
  for (const key of Object.keys(node as Record<string, unknown>)) {
    const child = (node as Record<string, unknown>)[key];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      delete (child as Record<string, unknown>)[fieldName];
    }
  }
}

function mergeHiddenUnlocked(
  base: Record<string, unknown>,
  hiddenBlocks: ScenarioHiddenInfoBlock[],
  lastUserMessage: string,
): Record<string, unknown> {
  const lower = lastUserMessage.toLowerCase();
  const merged = { ...base };
  for (const block of hiddenBlocks) {
    const hit = block.triggerKeywords.some((kw) => lower.includes(kw.toLowerCase()));
    if (!hit) continue;
    for (const [k, v] of Object.entries(block.data)) {
      setNestedValue(merged, k, v);
    }
  }
  return merged;
}

function shouldTriggerProbe(probe: ScenarioProbeRuntime, history: ChatTurn[], currentTurn: number): boolean {
  const { trigger } = probe;
  if (currentTurn < trigger.minTurnCount) return false;

  if (trigger.highTrustSignals?.length) {
    const last = getLastUserMessage(history);
    if (trigger.highTrustSignals.some((s) => last.includes(s))) return true;
  }

  if (trigger.consecutiveAcceptanceTurns) {
    const recent = getRecentUserMessages(history, trigger.consecutiveAcceptanceTurns);
    if (recent.length < trigger.consecutiveAcceptanceTurns) return false;
    const allAccepting = recent.every((msg) => !containsQuestioningSignal(msg));
    if (allAccepting) return true;
  }

  return false;
}

function applyProbeToScenario(scenarioData: Record<string, unknown>, probe: ScenarioProbeRuntime): void {
  switch (probe.type) {
    case "distortion": {
      const path = probe.payload.fieldPath;
      if (path) setNestedValue(scenarioData, path, probe.payload.falsifiedValue);
      break;
    }
    case "omission": {
      const dim = probe.payload.omitDimension;
      if (!dim) break;
      if (dim.includes(".")) {
        deleteNestedField(scenarioData, dim);
      } else if (scenarioData.apartments && typeof scenarioData.apartments === "object") {
        omitFieldFromChildren(scenarioData, "apartments", dim);
      } else {
        deleteNestedField(scenarioData, dim);
      }
      break;
    }
    case "fabrication": {
      const fact = probe.payload.fabricatedFact;
      if (!fact) break;
      const existing = scenarioData._additionalFacts;
      const list = Array.isArray(existing) ? [...existing] : [];
      list.push(fact);
      scenarioData._additionalFacts = list;
      break;
    }
    default:
      break;
  }
}

export class ProbeInjector {
  /**
   * Before each Agent A LLM call: unlock hidden facts, optionally apply one pending probe override.
   * Mutates `probes` in place for triggered probes.
   */
  processBeforeLLMCall(input: {
    layer: ScenarioDataLayer;
    conversationHistory: ChatTurn[];
    currentTurn: number;
    probes: ScenarioProbeRuntime[];
  }): {
    scenarioDataForLLM: Record<string, unknown>;
    triggeredProbeId: string | null;
    unlockedHiddenKeys: string[];
  } {
    const lastUser = getLastUserMessage(input.conversationHistory);
    const unlockedKeys: string[] = [];
    for (const block of input.layer.hiddenInfo) {
      const hit = block.triggerKeywords.some((kw) => lastUser.toLowerCase().includes(kw.toLowerCase()));
      if (hit) unlockedKeys.push(...Object.keys(block.data));
    }

    const scenarioData = mergeHiddenUnlocked(deepClone(input.layer.publicInfo), input.layer.hiddenInfo, lastUser);

    const pending = input.probes.filter((p) => p.status === "pending");
    let triggeredProbeId: string | null = null;

    for (const probe of pending) {
      if (!shouldTriggerProbe(probe, input.conversationHistory, input.currentTurn)) continue;
      applyProbeToScenario(scenarioData, probe);
      probe.status = "triggered";
      probe.triggeredAtTurn = input.currentTurn;
      triggeredProbeId = probe.id;
      break;
    }

    return { scenarioDataForLLM: scenarioData, triggeredProbeId, unlockedHiddenKeys: unlockedKeys };
  }
}
