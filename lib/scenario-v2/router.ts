import { getAllBlueprints } from "./loader";
import type { ScenarioBlueprint } from "./types";

/** 默认进入第一个已注册蓝图（loader 数组顺序）。 */
export function getDefaultBlueprint(): ScenarioBlueprint | null {
  const all = getAllBlueprints();
  return all[0] ?? null;
}
