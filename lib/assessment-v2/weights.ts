/** 两层七维满分与权重（加权总分 0–100） */
export const V2_DIMENSION_MAX = {
  taskFraming: 10,
  dialogSteering: 10,
  evidenceSeeking: 15,
  modelMentalModel: 20,
  failureAwareness: 15,
  trustBoundaryCalibration: 15,
  reflectiveTransfer: 15,
} as const;

export type V2DimensionKey = keyof typeof V2_DIMENSION_MAX;

export const V2_DIMENSION_KEYS = Object.keys(V2_DIMENSION_MAX) as V2DimensionKey[];

/** 权重 = max（总和 100） */
export const V2_RUBRIC_WEIGHTS: Record<V2DimensionKey, number> = {
  taskFraming: 10,
  dialogSteering: 10,
  evidenceSeeking: 15,
  modelMentalModel: 20,
  failureAwareness: 15,
  trustBoundaryCalibration: 15,
  reflectiveTransfer: 15,
};

export const RUBRIC_VERSION_V2 = "2.0";
export const EVENT_SCHEMA_VERSION_V2 = "2.0";
