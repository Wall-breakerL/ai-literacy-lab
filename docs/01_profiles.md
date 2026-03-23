# 用户入场（历史说明）

早期原型曾用 `UserProfile`（`role` × `level`）做场景分流与措辞差异。**当前版本已移除**：入场在 **`/setup`** 配置 `IdentityDossier`（或跳过使用 `createDefaultDossier()`），默认进入场景由 **`getDefaultEntryScenarioId()`**（`lib/scenario-router.ts`）决定。旧版 `data/scenarios/` 已删除；场景仅来自 **v2 蓝图**（`data/scenario-blueprints/`）。
