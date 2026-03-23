import { getDefaultBlueprint } from "./scenario-v2/router";

/**
 * 默认会话入口：loader 中注册的第一个 v2 蓝图。
 * 未注册任何蓝图时抛错（应用仅支持蓝图场景）。
 */
export function getDefaultEntryScenarioId(): string {
  const bp = getDefaultBlueprint();
  if (!bp) {
    throw new Error("No scenario blueprint registered in lib/scenario-v2/loader.ts");
  }
  return bp.id;
}
