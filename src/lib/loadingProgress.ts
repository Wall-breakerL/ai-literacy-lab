export const QUESTIONNAIRE_EXPECTED_MS = 60_000;
export const QUESTIONNAIRE_READY_MIN_PROGRESS = 55;
export const REPORT_EXPECTED_MS = 60_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function easeOutQuad(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) * (1 - x);
}

export function getQuestionnaireLoadingProgress(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed === 0) return 0;
  if (elapsed <= 30_000) {
    return Math.round(easeOutCubic(elapsed / 30_000) * 55);
  }
  if (elapsed <= 60_000) {
    return Math.round(55 + easeOutQuad((elapsed - 30_000) / 30_000) * 35);
  }
  return Math.round(90 + Math.min(4, ((elapsed - 60_000) / 60_000) * 4));
}

export function getReportLoadingProgress(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed === 0) return 0;
  if (elapsed <= 40_000) {
    return Math.round(easeOutCubic(elapsed / 40_000) * 72);
  }
  if (elapsed <= 60_000) {
    return Math.round(72 + easeOutQuad((elapsed - 40_000) / 20_000) * 20);
  }
  return Math.round(92 + Math.min(3, ((elapsed - 60_000) / 45_000) * 3));
}

export function getLoadingPhaseIndex(progress: number, phaseCount: number): number {
  if (phaseCount <= 1) return 0;
  const segmentSize = 100 / phaseCount;
  return clamp(Math.floor(progress / segmentSize), 0, phaseCount - 1);
}
