# 在线对话与评测 API 接入规划

在「事件记录（v2）+ 规则校正（v2）+ 版本追溯」前提下，接入真实 LLM API 做**在线对话**与 **Judge v2**；无 key 或请求失败时使用 mock / 规则 Judge v2 回退。

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

**现状**：`app/api/chat/route.ts` → `lib/llm/chat.ts` 的 `callChatApi`；需有效 **v2/v3 蓝图 id**。有 `OPENAI_API_KEY` 时用 OpenAI 兼容 `fetch`；返回 `null` 或异常时回退轮换 **mock** 回复。

- System prompt：根据 `phase` 参数（`helper` | `talk`）构建不同提示。Helper 注入任务 `worldState`；Talk 注入讨论引导（由 `talkPrompt` 或蓝图 `defaultTalkPrompt` 生成）。
- **新增参数**：`phase`（可选）、`talkPrompt`（可选，talk 阶段的用户输入）。
- **安全门控**：Talk 阶段检测最新 user 消息是否命中 `talkSafety.blockedKeywords` / `blockedCategories`，命中则返回 `fallbackMessage`，不调用 LLM。

## 2.1 场景选择（/api/scenario-select）

- 入参：`taskPrompt`（可选）、`identityId`（可选）。
- 行为：
  - 命中正式蓝图库：返回 `source: "matched"` + 正式 `scenarioId`。
  - 不命中：生成 v3 两段式候选蓝图，写入 `data/runtime/scenario-candidates/`，返回 `source: "generated_candidate"` + 候选 `scenarioId`。
  - 无 prompt/异常：回退默认蓝图并返回 `source: "default" | "fallback_default"`。
- 目的：平衡“用户表达个体任务意图”与“库场景复用一致性”。

---

## 3. 在线评测（Judge v2）

**现状**：`lib/evaluation/run-evaluation-v2.ts` 调用 `callJudgeApiV2`（`lib/llm/judge-v2.ts`）。未配置 key、请求失败或 JSON 不合法时回退 **`runRuleJudgeV2`**（`lib/judge-rule-v2.ts`），再经 **`applyRuleCorrectionsV2`**（`lib/rule-corrector-v2.ts`）。

- LLM 路径：输出 **JudgeOutputV2**（两层七维），见 `lib/assessment-v2/types.ts`。两段式蓝图时 prompt 分段输入 transcript 与分段事件摘要。
- 回退路径：`judgeModel` 记为 **`rule-based`**。
- **Phase 子分**：`EvaluationResultV2Payload` 新增 `phaseScores`（`PhaseScores`），含 helper/talk 两段的维度得分与事件计数。
- **新增入参**：`talkPrompt`（可选），透传至 experience card。

**输出与标度**：见 [04_eval_spec.md](./04_eval_spec.md) §0 与 [10_rubric_v2_two_layers.md](./10_rubric_v2_two_layers.md)。

---

## 4. 错误与回退策略

| 环节 | 失败时行为 |
|------|------------|
| 对话 API | 网络/4xx/5xx/解析失败 → 返回 mock 回复，不向用户报错 |
| Judge API | 未配置 key / 请求失败 / JSON 不合法 → `runRuleJudgeV2`，`judgeModel` 为 `rule-based` |
| 场景选择 API | 匹配/生成异常 → 回退默认蓝图，保证会话可继续 |

## 4.1 候选审核发布 API

- `GET /api/scenario-candidates`：列出 runtime 候选场景。
- `POST /api/scenario-candidates/promote`：将候选写入 `data/scenario-blueprints/` 并标记为 `promoted`。

---

## 5. 实现顺序建议（历史）

1. 环境变量：README 与 `.env.example`。
2. 对话：`lib/llm/chat.ts` + `app/api/chat/route.ts`。
3. Judge v2：`lib/llm/judge-v2.ts` + `run-evaluation-v2.ts` 中的 LLM / 规则分支。

---

## 6. 与现有设计对齐

- **评估对象**：只评用户行为（v2 事件 + 用户消息），Judge prompt 中明确不评 assistant。
- **核心 Rubric**：两层七维 v2，见 `docs/10_rubric_v2_two_layers.md` 与 `lib/assessment-v2/weights.ts`。
- **规则校正**：`applyRuleCorrectionsV2`。
- **版本追溯**：结果载荷中的 `rubricVersion`、`blueprintVersion`、`eventSchemaVersion`、`judgePromptVersion`、`judgeModel`、`scoredAt` 等。
- **两段式**：v3 蓝图支持 helper→talk 两段对话；评测自动检测 phase 切换点，生成 phase 级子分。详见 `docs/10_rubric_v2_two_layers.md` 底部「两段式评分」。
