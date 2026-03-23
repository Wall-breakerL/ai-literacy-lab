import type { V2DimensionKey } from "./weights";

export const V2_DIMENSION_LABELS: Record<V2DimensionKey, string> = {
  taskFraming: "任务框定",
  dialogSteering: "对话推进",
  evidenceSeeking: "证据与核验",
  modelMentalModel: "模型心智",
  failureAwareness: "失效觉察",
  trustBoundaryCalibration: "信任与边界",
  reflectiveTransfer: "反思迁移",
};

export const V2_LAYER_LABELS = {
  A: "协作行为层",
  B: "AI 理解能力层",
} as const;
