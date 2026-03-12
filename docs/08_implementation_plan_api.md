# API 接入与「如何打分」落地 — 实施计划

在 [07_how_we_score.md](./07_how_we_score.md) 的流程与约束下，将在线对话、富结构 Judge、规则校正和模型选型落到代码与配置的可执行计划。

---

## 一、目标状态（对齐 07）

- **Step 1**：沿用现有事件记录（规则/关键词），Judge 输入中增加「场景 hidden checks + event summary」。
- **Step 2**：Judge 输出从「简化 dimensionScores」扩展为**富结构**（每维 level + evidence + reason，flags，suggestions）；LLM 使用 Structured Outputs 或强校验保证 schema。
- **Step 3**：规则校正与 07 中表格一致（Context/Steering/Judgment 无证据上限 2、敏感信息裸贴 Safety 上限 1 等）。
- **模型**：先做 **A 档**（同一模型，Chat 与 Judge 两次独立调用）；环境变量支持后续 B 档（不同模型）。
- **Judge prompt**：写死 07 中 5 条反偏差原则，且输入包含 profile、scenarioId、hidden checks、transcript、event summary。

---

## 二、任务列表（建议顺序）

### 阶段 1：类型与 schema 扩展

| 序号 | 任务 | 说明 |
|------|------|------|
| 1.1 | 扩展 Judge 输出类型 | 在 `lib/types.ts` 中增加富结构：`DimensionResult { level, evidence: string[], reason }`，`JudgeOutputRich { rubricVersion, scenarioId, profile, dimensions, flags, suggestions }`；保留现有 `JudgeOutput` 供规则 Judge 与校正层输入。 |
| 1.2 | 适配层：富结构 ↔ 校正层 | 规则校正仍接收「五维 0–5」；从 `JudgeOutputRich` 提取 `dimensions[*].level` 得到 `DimensionScores`，再交给 `applyRuleCorrections`；校正后的 level 可再写回富结构用于展示。 |

### 阶段 2：规则校正与 07 对齐

| 序号 | 任务 | 说明 |
|------|------|------|
| 2.1 | 补全校正规则 | 在 `lib/rule-corrector.ts` 中显式实现 07 第 4 节：无背景补充 → Context 上限 2；无修订/比较/追问 → Steering 上限 2；敏感信息裸贴 → Safety 上限 1；有验证机会但从未核验 → Judgment 上限 2。与现有「缺项降级」「敏感扣分」合并，便于解释与迭代。 |
| 2.2 | 校正后写回 suggestions | 若 Judge 已输出 suggestions，校正层可保留或按规则覆盖部分条（如 Safety 被压时追加一条建议）；最终结果页展示「校正后 suggestions」。 |

### 阶段 3：在线对话（Chat API）

| 序号 | 任务 | 说明 |
|------|------|------|
| 3.1 | 环境变量与 .env.example | 增加 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_CHAT_MODEL`；README 说明「有 key 则真实对话，否则 mock」。 |
| 3.2 | lib/llm/chat.ts | 封装 Chat Completions：读 baseUrl + model，system prompt 注入场景 `visibleTask`，约束不泄露探针、不教刷分；返回 assistant content；异常时返回 null 由 route 回退 mock。 |
| 3.3 | /api/chat 分支 | 有 key 时调 `lib/llm/chat`，失败或 null 时用现有 mock。 |

### 阶段 4：Judge 输入与 prompt 原则

| 序号 | 任务 | 说明 |
|------|------|------|
| 4.1 | Judge 输入构造 | 在调用 LLM Judge 前组装：profile、scenarioId、场景的 `hiddenChecks`（或 hiddenProbes 文案）、完整 transcript、event summary（事件列表或简短摘要）。 |
| 4.2 | Judge prompt 模板 | 在 `lib/llm/judge.ts` 中写死 07 第 6 节 5 条原则；明确「只评用户」「证据来自用户」「同一 rubric 全 profile」「不奖励篇幅」「assistant 差时看用户是否有机会识别」。 |
| 4.3 | 五维定义与 0–5 锚定 | Prompt 中写入 03_rubric 的五维定义与 0–5 锚定（或引用简短版），要求输出 dimensions 的 level/evidence/reason、flags、suggestions。 |

### 阶段 5：Judge 输出与 LLM 调用

| 序号 | 任务 | 说明 |
|------|------|------|
| 5.1 | 富结构 JSON 校验 | 定义 `JudgeOutputRich` 的校验（zod 或手写）：五维 key、level 0–5、evidence/reason 数组/字符串、flags/suggestions 数组。 |
| 5.2 | Structured Outputs 或等价 | 若用 OpenAI：response_format 指定 JSON schema 对应 `JudgeOutputRich`；否则在解析后做校验，不通过则视为失败，回退规则 Judge。 |
| 5.3 | lib/llm/judge.ts | 输入：sessionId, scenarioId, profile, scenario (含 hiddenChecks), messages, events。构造 prompt → 调用 Chat Completions（或 Judge 专用 endpoint）→ 解析并校验 → 返回 `JudgeOutputRich | null`。 |
| 5.4 | run-evaluation 分支 | 若有 Judge 用 key：调 `lib/llm/judge`；得到非 null 则从富结构取 level 转 `DimensionScores`，送 `applyRuleCorrections`，再写回富结构（校正后 level/suggestions）与 rubricVersion、judgeModel、scoredAt。若为 null 则用 `runRuleJudge`，并生成最小富结构（仅 level）供结果页统一展示。 |

### 阶段 6：结果页与版本

| 序号 | 任务 | 说明 |
|------|------|------|
| 6.1 | 结果页展示富结构 | 结果页支持展示 dimensions 每维的 level、evidence、reason，以及 flags、suggestions；若无富结构则退化为当前「五维分 + 建议」展示。 |
| 6.2 | 版本与模型信息 | 结果与 API 响应中保留 rubricVersion、scenarioVersion、judgePromptVersion、judgeModel、scoredAt；B 档时 judgeModel 与 chat 模型可不同（由环境变量区分）。 |

### 阶段 7：文档与 Cursor 约束

| 序号 | 任务 | 说明 |
|------|------|------|
| 7.1 | 更新 04_eval_spec | 在 04 中增加「Judge 输出（推荐富结构）」一节，引用 07 的 JSON 示例与 08 的 schema；保留简化版说明用于规则 Judge 兼容。 |
| 7.2 | Cursor 规则 | 在 `.cursor/rules` 中补充：Judge 实现必须遵守 07 第 6 节 5 条 prompt 原则；Judge 输出须为固定 JSON，推荐富结构；规则校正须与 07 第 4 节一致。 |
| 7.3 | README 与 06 | README 简要说明「如何打分」三步与无 key 时的 mock/规则 Judge；06 中补充 A/B 档模型配置说明及 Judge 输入/输出与 07 的对齐。 |

---

## 三、依赖与优先级

- **阶段 1–2**：与是否接 LLM 无关，可先做（类型扩展 + 规则校正补全），便于后续 LLM Judge 与结果页统一。
- **阶段 3**：可独立交付「在线对话」，不依赖 Judge 富结构。
- **阶段 4–5**：实现 LLM Judge 与富结构输出，依赖 1.1、1.2、2.1。
- **阶段 6–7**：结果页与文档，可与 4–5 并行或紧随其后。

建议实施顺序：**1 → 2 → 3 → 4 → 5 → 6 → 7**；若时间紧，可先 3（对话）+ 5（Judge 仍输出简化版并校验），再补 1、2、6 的富结构与规则细化。
