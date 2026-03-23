# 场景数据（当前：仅 v2 蓝图）

本仓库**已移除**旧版四场景 JSON（`data/scenarios/`）与五维评测链路。运行时代码**只加载**：

- **蓝图文件**：`data/scenario-blueprints/*.json`
- **注册表**：`lib/scenario-v2/loader.ts`（静态 import 数组顺序决定默认入口）
- **API**：`GET /api/scenarios/[scenarioId]` → `{ kind: "blueprint", blueprint }` 或 404

产品设计、探针与 debrief 字段说明见 [09_identity_and_scenario_v2.md](./09_identity_and_scenario_v2.md)。若需「文档中的旧四场景」叙事，仅作研究对照，**不再与当前二进制/JSON 路径对应**。
