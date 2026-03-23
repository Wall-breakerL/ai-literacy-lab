import type { ExperienceCard } from "./experience-card";

export type UserMemoryCard = {
  userId: string;
  identityId?: string;
  aggregateStrengths: string[];
  aggregateWeaknesses: string[];
  repeatedFailurePatterns: string[];
  preferredScenarioFamilies: string[];
  recommendedDifficulty: "lower" | "baseline" | "higher";
  lastNExperiences: string[];
  updatedAt: string;
};

export function emptyUserMemory(userId: string): UserMemoryCard {
  return {
    userId,
    aggregateStrengths: [],
    aggregateWeaknesses: [],
    repeatedFailurePatterns: [],
    preferredScenarioFamilies: [],
    recommendedDifficulty: "baseline",
    lastNExperiences: [],
    updatedAt: new Date().toISOString(),
  };
}

/** 极简聚合：把新 experience 的 blindSpots 与低分维并入 user 卡（研究原型） */
export function mergeUserMemoryWithExperience(
  prev: UserMemoryCard,
  card: ExperienceCard
): UserMemoryCard {
  const weakDims = Object.entries(card.dimensionScores)
    .filter(([, v]) => v < 40)
    .map(([k]) => k);
  const weaknesses = Array.from(
    new Set([...prev.aggregateWeaknesses, ...card.blindSpots, ...weakDims])
  ).slice(0, 12);
  const strengths = Object.entries(card.dimensionScores)
    .filter(([, v]) => v >= 70)
    .map(([k]) => k);
  const nextStrengths = Array.from(new Set([...prev.aggregateStrengths, ...strengths])).slice(0, 12);

  return {
    ...prev,
    identityId: card.identityId ?? prev.identityId,
    aggregateStrengths: nextStrengths,
    aggregateWeaknesses: weaknesses,
    repeatedFailurePatterns: prev.repeatedFailurePatterns,
    preferredScenarioFamilies: Array.from(
      new Set([...prev.preferredScenarioFamilies, ...card.nextRecommendedScenarios])
    ).slice(0, 8),
    recommendedDifficulty: weaknesses.length > 4 ? "lower" : prev.recommendedDifficulty,
    lastNExperiences: [card.sessionId, ...prev.lastNExperiences].slice(0, 20),
    updatedAt: new Date().toISOString(),
  };
}
