# 身份层与场景蓝图 v2

## 1. IdentityDossier

评估者预先配置「被测者是谁」，编译为**隐藏 system 上下文**，不逐字展示给被测者。

- **字段**：见 `lib/identity/types.ts`（`identityId`、`source`、`rawPrompt`、`compiledPrompt`、`structuredSummary`、`version`、`createdAt`）。
- **来源 `IdentitySource`**：`manual_prompt` | `structured_form` | `default_profile`（未走 `/setup` 或无有效 `identityId` 时由服务端 `createDefaultDossier()` 占位）。
- **编译**：`lib/identity/compiler.ts`（当前为确定性拼接；后续可加单次 LLM 结构化抽取，**与 Judge 独立**）。
- **持久化**：`POST /api/identity` → `data/runtime/identities/{id}.json`（`lib/storage/file-json-storage.ts`）。

## 2. ScenarioBlueprint（v3 两段式）

蓝图 schema 已升级至 v3，支持固定两段式对话：

1. **Phase 1 — Helper**：AI 助手协助用户完成具体任务（考察协作行为为主）。
2. **Phase 2 — Talk**：用户选话题与 AI 深入讨论（考察 AI 理解能力为主）。

- **Schema**：`lib/scenario-v2/types.ts`（新增 `phases`、`phaseSwitchPolicy`、`talkPromptPolicy`、`TalkSafety`；向后兼容单段蓝图）。
- **数据**：`data/scenario-blueprints/*.json`（`version: "3.0"`）；加载器 `lib/scenario-v2/loader.ts`。
- **路由**：`lib/scenario-v2/router.ts` 的 `getDefaultBlueprint()` 提供默认蓝图；入口场景 id 见 `getDefaultEntryScenarioId()`（`lib/scenario-router.ts`）。
- **API**：`GET /api/scenarios/[id]` 仅返回蓝图：命中则 `{ kind: "blueprint", blueprint }`，否则 **404**。

### 两段式字段

- `phases.helper`（`HelperPhaseSpec`）：`assistantRolePrompt`、`worldState`、`openingMessage`、`hiddenProbes`、`turnPolicies`、`successSignals`、`stopConditions`。
- `phases.talk`（`TalkPhaseSpec`）：`assistantRolePrompt`、`openingMessage`、`hiddenProbes`、`defaultTalkPrompt`、`talkPromptPolicy`（可选）、`talkSafety`、`turnPolicies`。
- `phaseSwitchPolicy`：`trigger`（`user_explicit` | `min_turns_reached` | `stop_condition_met`）、`minPhase1UserTurns`。

## 3. 对话注入

- **Chat**：`lib/llm/chat.ts` 的 `buildChatSystemPrompt` 根据当前 `phase` 注入不同 system prompt。Helper 阶段注入任务 `worldState`；Talk 阶段注入讨论引导（由 `talkPrompt` 或蓝图 `defaultTalkPrompt` 生成）。
- **安全门控**：`/api/chat` 在 Talk 阶段检测用户消息是否命中 `talkSafety.blockedKeywords` / `blockedCategories`，命中则返回 `fallbackMessage`。
- **Judge v2**：`lib/llm/judge-v2.ts` 含身份段、分段探针摘要、phase-segmented transcript + 收尾反思。

## 4. 混合场景选择（匹配优先 + 候选生成）

- **入口**：`/setup` 新增任务 prompt（可选）。
- **选择 API**：`POST /api/scenario-select`。
  - 有 prompt 且命中库：返回 `source: "matched"` + 正式 `scenarioId`。
  - 有 prompt 但不命中：按 prompt 生成 v3 两段式蓝图，写入 `data/runtime/scenario-candidates/`，返回 `source: "generated_candidate"`。
  - 无 prompt 或生成失败：回退默认蓝图入口。
- **读取策略**：`resolveBlueprintById()` 统一解析“正式库 + runtime 候选库”，`/api/scenarios/[id]`、`/api/chat`、`/api/evaluate` 全部走该解析。
- **审核发布**：
  - 列表：`GET /api/scenario-candidates`
  - 发布：`POST /api/scenario-candidates/promote`（把候选写入 `data/scenario-blueprints/{scenarioId}.json`，并将候选标记为 `promoted`）

## 5. UI

- **身份与入场**：`/setup`（粘贴 prompt 或结构化表单 → 保存后直达 `/chat/{scenarioId}`；跳过则清除自定义 `identityId`）。
- **两段状态机**：聊天页根据 `isTwoPhaseBlueprint()` 自动进入 helper→talk→debrief 流程；helper 完成后进入 Talk 过渡页，用户在文本框输入（可留空使用默认引导）后进入 talk。
- **调试**：`/chat/...?debug=1` 展示当前 phase 的探针摘要；结果页「研究者视图」可看事件（含 phase 标签）、phase 子分与原始 JSON。
