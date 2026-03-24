# 评测流程

## 三步总览

```
Step 1  对话过程中记录可观察行为事件
Step 2  Judge（API 或规则回退）读取完整会话，输出结构化评分
Step 3  规则层对 Judge 输出做校正（封顶/兜底），不重新评分
```

**Judge 负责细腻度，规则层控制底线与上限。**

---

## Step 1：事件提取

文件：`lib/assessment-v2/extract-events-v2.ts`

系统从每轮用户消息中匹配关键词，生成 `EvalEventRecordV2` 序列：

```typescript
type EvalEventV2 =
  | "goal_specified" | "constraint_specified" | "recipient_specified"
  | "context_added" | "example_added"
  | "revision_requested" | "comparison_requested"
  | "verification_requested"
  | "risk_noticed" | "sensitive_info_shared"
  | "uncertainty_acknowledged" | "source_requested" | "freshness_checked"
  | "model_variability_noted" | "hallucination_detected"
  | "human_review_required" | "delegation_boundary_set"
  | "reflection_articulated"
  | "overtrust_signal" | "anthropomorphism_signal"
  | "debrief_meta_awareness";
```

事件记录支持 `phase` 标签（`helper` | `talk` | `debrief`），由 `phaseSwitchTurn` 自动推断。

---

## Step 2：Judge 评分

### LLM Judge（主要）

文件：`lib/llm/judge-v2.ts`

- **API**：调用 `callJudgeApiV2()`，通过 OpenAI 兼容接口
- **环境变量**：`OPENAI_API_KEY`、`OPENAI_JUDGE_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_JUDGE_MODEL`
- **未配置 key**：直接返回 `null`（不降级到规则 Judge，v2.0 已关闭规则回退）

### Judge 输入

1. 身份上下文（`identityCompiled`，隐藏）
2. 场景 id + world state + 探针摘要
3. 完整对话 transcript（两段式时按 phase 分段）
4. 事件摘要（带 phase 标签）

### Judge 约束原则（硬编码，不可删减）

1. 评分对象是**用户**，不是 assistant 的表演或文采
2. 禁止把「prompt 写得好不好」当作 AI 理解能力
3. 证据优先来自**用户原话**与可观察行为
4. assistant 表现差时，先判断用户是否有机会识别再决定是否扣用户分
5. 输出必须是合法 JSON，无其他文字

### Judge 输出

`JudgeOutputV2`（七维 score/max/evidence/reason + flags + suggestions + blindSpots + next*）

---

## Step 3：规则校正

文件：`lib/rule-corrector-v2.ts`

**不替代 Judge**，而是防止 Judge 漂得太远，控制底线和上限。

### 维度事件映射

| 维度 | 关键事件 |
|------|----------|
| Task Framing | goal_specified, constraint_specified, recipient_specified |
| Dialog Steering | revision_requested, comparison_requested |
| Evidence Seeking | verification_requested, source_requested, freshness_checked |
| Model Mental Model | uncertainty_acknowledged, model_variability_noted, hallucination_detected, overtrust_signal |
| Failure Awareness | hallucination_detected, verification_requested |
| Trust / Boundary Calibration | risk_noticed, delegation_boundary_set, human_review_required |
| Reflective Transfer | reflection_articulated, debrief_meta_awareness |

### 校正规则

| 情况 | 校正 |
|------|------|
| 该维无任何关键事件 | 该维得分上限为 `max × 0.55` |
| 暴露敏感信息但未意识到风险 | `trustBoundaryCalibration` 得分上限为 `max × 0.25` |

### 加权总分计算

`lib/rule-corrector-v2.ts` 的 `computeWeightedScoreV2()`：

```typescript
总分 = Σ(维得分/维满分 × 维权重)，四舍五入到整数
```

---

## 规则 Judge 回退（已关闭）

v2.0.0 已移除基于 `judge-rule-v2.ts` 的规则 Judge 回退。若无 API Judge key，评测直接报错，不再降级到规则 Judge。

---

## 结果持久化

评测完成后，写入 `data/runtime/experiences/{sessionId}.json`（ExperienceCard），同时可选更新 `data/runtime/users/{userId}.json`（UserMemoryCard）。
