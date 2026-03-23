# 评估工作流与规范 (Evaluation Spec)

**当前代码**：仅 **v2 蓝图** 流水线 — `extractEventsV2` → `callJudgeApiV2` / `runRuleJudgeV2` → `applyRuleCorrectionsV2`（`lib/evaluation/run-evaluation-v2.ts`）。五维 legacy 与 `lib/llm/judge.ts` 等已从仓库移除。

下文 **§1–§3** 保留早期「五维 + 旧事件类型」叙述，便于对照文献与 `docs/03_rubric.md`；**实现请以 v2 文档与代码为准**。

---

## 0. 标度约定（canonical，v2）

- **结果页与 API**：两层七维，每维为 **score / max**（整数），加权总分 0–100；细节见 [10_rubric_v2_two_layers.md](./10_rubric_v2_two_layers.md)。
- **LLM Judge v2**：`lib/llm/judge-v2.ts` 要求输出符合 `JudgeOutputV2` 的 JSON。
- **规则回退**：`lib/judge-rule-v2.ts`；校正：`lib/rule-corrector-v2.ts`。
- **v2 事件**：`lib/assessment-v2/extract-events-v2.ts`。

---

## 1. 事件类型 (EvalEvent) — 历史五维管线用语

> **v2 实现不使用下列枚举**；当前事件 ID 见 `extract-events-v2.ts`。

用规则/状态机从对话中识别可观察行为，记为事件流：

```typescript
type EvalEvent =
  | "goal_specified"
  | "constraint_specified"
  | "recipient_specified"
  | "context_added"
  | "example_added"
  | "revision_requested"
  | "comparison_requested"
  | "verification_requested"
  | "risk_noticed"
  | "sensitive_info_shared"
```

- 每条对话回合可产出 0 个或多个事件。
- 事件序列 + 原始对话作为 Judge 的输入。

---

## 2. Judge 输出 Schema — 历史五维示例

> **当前运行时代码**输出为 **JudgeOutputV2**（七维），非下列类型。

单 Judge（规则或模型）根据事件序列与对话内容，按 Rubric 五维度输出原始评分与可选理由。**推荐使用富结构**（每维 level + evidence + reason，以及 flags、suggestions），便于向老师解释与结果页展示；详见 [07_how_we_score.md](./07_how_we_score.md) 第 3.2 节（其中文件路径描述多为历史状态）。

**简化版**（规则 Judge 或兼容层可用）：

```typescript
type JudgeOutput = {
  scenarioId: string
  sessionId: string
  dimensionScores: {
    clarity: 0 | 1 | 2 | 3 | 4 | 5
    context: 0 | 1 | 2 | 3 | 4 | 5
    steering: 0 | 1 | 2 | 3 | 4 | 5
    judgment: 0 | 1 | 2 | 3 | 4 | 5
    safetyOwnership: 0 | 1 | 2 | 3 | 4 | 5
  }
  weightedScore: number
  evidence?: Record<string, string[]>
}
```

- `dimensionScores`：五维 0–5 原始分。
- `weightedScore`：按 03_rubric 权重换算后的总分（0–100 或 0–5 依实现约定）。
- `evidence`：可选，按维度或事件列出支撑该分数的片段/事件 ID。

---

## 3. 规则校正

**v2 实现**：`lib/rule-corrector-v2.ts`（`applyRuleCorrectionsV2`）。

历史五维管线的校正原则（缺项降级、敏感行为扣分等）曾落在已删除的 `rule-corrector.ts`；若需在 v2 侧对齐同类规则，应在 `rule-corrector-v2.ts` 与 `docs/10_rubric_v2_two_layers.md` 中维护。
