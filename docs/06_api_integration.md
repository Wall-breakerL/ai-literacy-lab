# 在线对话与评测 API 接入规划

在保留现有「事件记录 + 规则校正 + 版本追溯」的前提下，接入真实 LLM API 做**在线对话**与**评测 Judge**；无 key 或请求失败时继续使用 mock / 规则 Judge 回退。

---

## 1. 环境变量与配置

| 变量 | 用途 | 必填 |
|------|------|------|
| `OPENAI_API_KEY` | 对话与 Judge 共用（或仅对话） | 否，无则走 mock |
| `OPENAI_BASE_URL` | 兼容 Azure/第三方（默认 `https://api.openai.com/v1`） | 否 |
| `OPENAI_CHAT_MODEL` | 对话用模型，如 `gpt-4o-mini` | 否，可写死默认 |
| `OPENAI_JUDGE_MODEL` | Judge 用模型，如 `gpt-4o` | 否，可写死默认 |
| `OPENAI_JUDGE_API_KEY` | 若希望对话与 Judge 用不同 key | 否 |

约定：**有 `OPENAI_API_KEY` 则尝试真实对话；Judge 可单独用 `OPENAI_JUDGE_API_KEY`，若未设则复用 `OPENAI_API_KEY`**。

---

## 2. 在线对话（/api/chat）

**现状**：POST 收到 `messages`、`scenarioId`，始终返回 mock 轮换句。

**目标**：

- 若配置了 `OPENAI_API_KEY`：调用 OpenAI 兼容接口（Chat Completions），生成助手回复。
- System prompt：注入当前场景的 `visibleTask`，并约束「扮演任务助手、不泄露探针意图、不主动教用户如何得高分」。
- 请求体：`messages` 转为 API 的 `messages`（user/assistant 角色），取最后一条 assistant 的 `content` 作为响应。
- 失败或未配置 key：回退到现有 mock 回复，不报错。

**实现要点**：

- 新增 `lib/llm/chat.ts`（或 `lib/openai-chat.ts`）：封装「调用 Chat Completions、返回 content」；内部读 `OPENAI_BASE_URL`、`OPENAI_CHAT_MODEL`。
- `app/api/chat/route.ts`：若有 key 则调该封装，否则 `getMockReply(...)`；捕获异常时同样回退 mock。

**依赖**：可用 `openai` 官方包，或直接用 `fetch` 调 `POST ${baseUrl}/chat/completions`，避免锁死 SDK 版本。

---

## 3. 在线评测（Judge 接入）

**现状**：`runEvaluation` 内固定调用 `runRuleJudge(scenarioId, sessionId, events)`，无 LLM 参与。

**目标**：

- 若配置了 Judge 用 API key（`OPENAI_JUDGE_API_KEY` 或 `OPENAI_API_KEY`）：将「对话全文 + 事件列表」作为上下文，调用 LLM 输出**严格符合 JudgeOutput schema 的 JSON**（五维 0–5、weightedScore、可选 evidence）。
- Prompt：明确说明只评**用户**行为、五维定义与权重、0–5 锚定、要求返回且仅返回合法 JSON。
- 解析响应：JSON.parse + 校验维度 key 与 0–5 范围；不合法或抛错则回退 `runRuleJudge`。
- **规则校正不变**：LLM 输出视为「原始 Judge 输出」，照常经 `applyRuleCorrections(raw, events)` 再做缺项降级、敏感扣分，并写回 `judgeModel`、`judgePromptVersion`、`scoredAt`。

**实现要点**：

- 新增 `lib/llm/judge.ts`（或 `lib/openai-judge.ts`）：输入 `sessionId, scenarioId, messages, events`，构造 prompt，调用 Chat Completions（或专用 endpoint），解析并校验为 `JudgeOutput`；失败返回 `null`。
- `lib/evaluation/run-evaluation.ts`：先尝试 LLM Judge（若配置了 key），得到 `rawOutput`；若为 `null` 则 `runRuleJudge(...)`。后续 `applyRuleCorrections`、附加版本字段的逻辑不变。
- 版本：`judgeModel` 写实际模型名（如 `gpt-4o`），`judgePromptVersion` 在 `constants` 中保留，便于离线校准时对齐 prompt。

**输出约束**：与 [04_eval_spec.md](./04_eval_spec.md) 一致，强制 `dimensionScores` 五维、0–5 整数、`weightedScore` 数字；可选用 zod 或手写校验。

---

## 4. 错误与回退策略

| 环节 | 失败时行为 |
|------|------------|
| 对话 API | 网络/4xx/5xx/解析失败 → 返回 mock 回复，不向用户报错 |
| Judge API | 未配置 key / 请求失败 / JSON 不合法 → 使用 `runRuleJudge`，`judgeModel` 记为 `rule-based` |

保证无 key 或单点故障时，流程仍可跑通，结果页仍可展示（规则 Judge + 规则校正）。

---

## 5. 实现顺序建议

1. **环境变量**：在 README 与 `.env.example` 中列出 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_CHAT_MODEL`、`OPENAI_JUDGE_MODEL`（可选 `OPENAI_JUDGE_API_KEY`）。
2. **对话**：实现 `lib/llm/chat.ts` + 修改 `app/api/chat/route.ts`，有 key 时调真实 API，否则 mock。
3. **Judge**：实现 `lib/llm/judge.ts`（prompt 模板 + 调用 + JSON 校验），再在 `run-evaluation.ts` 中做「先 LLM Judge，失败则规则 Judge」的分支。
4. **README**：补充「配置 API key 后为在线对话与 LLM 评测；未配置则为 mock + 规则 Judge」。

---

## 6. 与现有设计对齐

- **评估对象**：仍只评用户行为（事件 + 用户消息），Judge prompt 中明确不评 assistant。
- **核心 Rubric**：不变，五维与权重与 [03_rubric.md](./03_rubric.md) 一致，仅 Judge 由规则改为可选的 LLM。
- **规则校正**：保留，LLM 输出必须经过 `applyRuleCorrections` 再写入结果与版本信息。
- **版本追溯**：`rubricVersion`、`scenarioVersion`、`eventSchemaVersion`、`judgePromptVersion`、`judgeModel`、`scoredAt` 照常写入，便于离线校准与复现。
