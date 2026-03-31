import { ProbeTriggerContextSchema, type ProbeDefinition, type ProbeId } from "@/domain/probes/types";

export function selectTriggeredProbes(
  probeDefinitions: ProbeDefinition[],
  contextInput: Parameters<typeof ProbeTriggerContextSchema.parse>[0],
  firedHighWeightProbeIds: ProbeId[],
): ProbeDefinition[] {
  const context = ProbeTriggerContextSchema.parse(contextInput);
  const signals = new Set(context.ruleSignals);

  return probeDefinitions.filter((probe) => {
    if (!probe.triggerStageIds.includes(context.stageId)) return false;
    const signalHit = probe.triggerOnSignalsAny.length === 0 || probe.triggerOnSignalsAny.some((signal) => signals.has(signal));
    if (!signalHit) return false;
    if (probe.weight === "high" && firedHighWeightProbeIds.includes(probe.id)) return false;
    return true;
  });
}
