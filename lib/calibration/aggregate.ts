/**
 * 离线聚合逻辑与 CLI 共享说明。
 * 可执行入口：项目根目录 `npm run calibrate`（实现于 `scripts/calibrate.mjs`，避免 Next 打包依赖 fs 路径）。
 */
export const CALIBRATION_REPORT_JSON = "reports/calibration_aggregate.json";
export const CALIBRATION_REPORT_MD = "reports/rubric_drift_summary.md";
