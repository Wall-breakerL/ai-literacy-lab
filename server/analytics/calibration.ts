import type { SessionEvent, SessionState } from "@/domain";
import { aggregateFaaFromEvents } from "@/domain/faa/aggregate";
import { aggregateMbtiFromEvents } from "@/domain/mbti/aggregate";

export interface SessionPack {
  sessionId: string;
  snapshot: SessionState;
  events: SessionEvent[];
}

export interface CalibrationReport {
  totalSessions: number;
  probeHitRate: Array<{
    probeId: string;
    overallHitRate: number;
    apartmentHitRate: number;
    brandHitRate: number;
    scoreVariance: number;
  }>;
  dimensionCoverage: Array<{ dimensionId: string; apartmentCoverage: number; brandCoverage: number }>;
  oneSceneDominantDimensions: string[];
  evidenceInsufficientSessions: string[];
  largeDirectionShiftSessions: string[];
  lowDiscriminativeProbes: string[];
}

function safeRate(hit: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((hit / total) * 1000) / 10;
}

export function buildCalibrationReport(sessions: SessionPack[]): CalibrationReport {
  const totalSessions = sessions.length;
  const probeMap = new Map<string, { total: number; apartment: number; brand: number; scoreSignals: number[] }>();
  const dimensionMap = new Map<string, { apartment: number; brand: number }>();
  const evidenceInsufficientSessions: string[] = [];
  const largeDirectionShiftSessions: string[] = [];

  for (const session of sessions) {
    const mbti = aggregateMbtiFromEvents(session.events);
    const faa = aggregateFaaFromEvents(session.events);
    const lowEvidence = mbti.some((axis) => axis.lowConfidence) || faa.dimensions.some((dimension) => dimension.lowConfidence);
    if (lowEvidence) evidenceInsufficientSessions.push(session.sessionId);

    const directionShift = mbti.some((axis) => {
      const apartment = axis.sceneContribution["apartment-tradeoff"];
      const brand = axis.sceneContribution["brand-naming-sprint"];
      return Math.abs(apartment - brand) > 45;
    });
    if (directionShift) largeDirectionShiftSessions.push(session.sessionId);

    for (const event of session.events) {
      if (event.type === "PROBE_FIRED") {
        const current = probeMap.get(event.payload.probeId) ?? { total: 0, apartment: 0, brand: 0, scoreSignals: [] };
        current.total += 1;
        if (event.payload.sceneId === "apartment-tradeoff") current.apartment += 1;
        if (event.payload.sceneId === "brand-naming-sprint") current.brand += 1;
        probeMap.set(event.payload.probeId, current);
      } else if (event.type === "PROBE_SCORED") {
        const current = probeMap.get(event.payload.probeId) ?? { total: 0, apartment: 0, brand: 0, scoreSignals: [] };
        const sum = Object.values(event.payload.mbtiDeltas).reduce((acc, value) => acc + (value ?? 0), 0);
        const faaSum = Object.values(event.payload.faaScores).reduce((acc, value) => acc + (value ?? 0), 0);
        current.scoreSignals.push(sum + faaSum);
        probeMap.set(event.payload.probeId, current);
      }
    }

    for (const dimension of faa.dimensions) {
      const current = dimensionMap.get(dimension.dimensionId) ?? { apartment: 0, brand: 0 };
      if (dimension.sceneContribution["apartment-tradeoff"] !== 50) current.apartment += 1;
      if (dimension.sceneContribution["brand-naming-sprint"] !== 50) current.brand += 1;
      dimensionMap.set(dimension.dimensionId, current);
    }
  }

  const probeHitRate = [...probeMap.entries()].map(([probeId, values]) => {
    const mean = values.scoreSignals.reduce((sum, value) => sum + value, 0) / (values.scoreSignals.length || 1);
    const variance =
      values.scoreSignals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.scoreSignals.length || 1);
    return {
      probeId,
      overallHitRate: safeRate(values.total, totalSessions),
      apartmentHitRate: safeRate(values.apartment, totalSessions),
      brandHitRate: safeRate(values.brand, totalSessions),
      scoreVariance: Math.round(variance * 1000) / 1000,
    };
  });

  const dimensionCoverage = [...dimensionMap.entries()].map(([dimensionId, values]) => ({
    dimensionId,
    apartmentCoverage: safeRate(values.apartment, totalSessions),
    brandCoverage: safeRate(values.brand, totalSessions),
  }));

  const oneSceneDominantDimensions = dimensionCoverage
    .filter((item) => Math.abs(item.apartmentCoverage - item.brandCoverage) >= 35)
    .map((item) => item.dimensionId);

  const lowDiscriminativeProbes = probeHitRate
    .filter((probe) => probe.overallHitRate < 10 || probe.overallHitRate > 95 || probe.scoreVariance < 0.003)
    .map((probe) => probe.probeId);

  return {
    totalSessions,
    probeHitRate,
    dimensionCoverage,
    oneSceneDominantDimensions,
    evidenceInsufficientSessions,
    largeDirectionShiftSessions,
    lowDiscriminativeProbes,
  };
}

