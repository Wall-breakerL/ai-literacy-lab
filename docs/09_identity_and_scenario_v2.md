# 身份层与场景蓝图 v2

## 1. IdentityDossier

评估者预先配置「被测者是谁」，编译为**隐藏 system 上下文**，不逐字展示给被测者。

- **字段**：见 `lib/identity/types.ts`（`identityId`、`source`、`rawPrompt`、`compiledPrompt`、`structuredSummary`、`version`、`createdAt`）。
- **来源 `IdentitySource`**：`manual_prompt` | `structured_form` | `default_profile`（未走 `/setup` 或无有效 `identityId` 时由服务端 `createDefaultDossier()` 占位）。
- **编译**：`lib/identity/compiler.ts`（当前为确定性拼接；后续可加单次 LLM 结构化抽取，**与 Judge 独立**）。
- **持久化**：`POST /api/identity` → `data/runtime/identities/{id}.json`（`lib/storage/file-json-storage.ts`）。

## 2. ScenarioBlueprint

将「可见任务卡」替换为 **Persona + World State + Opening + Hidden Probes + Debrief**。

- **Schema**：`lib/scenario-v2/types.ts`（含 `ProbeSpec`：`probeId`、`targetDimensions`、`injectionTiming`、`assistantMove`、signals、`severity`）。
- **数据**：`data/scenario-blueprints/*.json`；加载器 `lib/scenario-v2/loader.ts`。
- **路由**：`lib/scenario-v2/router.ts` 的 `getDefaultBlueprint()` 提供默认蓝图；入口场景 id 见 `getDefaultEntryScenarioId()`（`lib/scenario-router.ts`）。
- **API**：`GET /api/scenarios/[id]` 仅返回蓝图：命中则 `{ kind: "blueprint", blueprint }`，否则 **404**（已无 legacy 场景）。

## 3. 对话注入

- **Chat**：`lib/llm/chat.ts` 的 `buildChatSystemPrompt` 注入 `compiledPrompt`（服务端经 `identityId` 读盘）、`assistantRolePrompt`、`worldState`；首条 **opening** 由前端插入 assistant 消息。
- **Judge v2**：`lib/llm/judge-v2.ts` 含身份段、探针摘要、全文 + 收尾反思。

## 4. UI

- **身份与入场**：`/setup`（粘贴 prompt 或结构化表单 → 保存后直达 `/chat/{scenarioId}`；跳过则清除自定义 `identityId`，评测侧无 dossier 时用 `createDefaultDossier()`）。
- **调试**：`/chat/...?debug=1` 展示探针摘要；结果页「研究者视图」可看事件与原始 JSON（若请求时 `includeRawJudge`）。
