# 评估工作流与规范 (Evaluation Spec)

最终流水线：**事件记录 → 单 Judge 评分 → 规则校正**。

---

## 1. 事件类型 (EvalEvent)

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

## 2. Judge 输出 Schema

单 Judge（规则或模型）根据事件序列与对话内容，按 Rubric 五维度输出原始评分与可选理由。**推荐使用富结构**（每维 level + evidence + reason，以及 flags、suggestions），便于向老师解释与结果页展示；详见 [07_how_we_score.md](./07_how_we_score.md) 第 3.2 节。

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

在 Judge 原始输出之上做确定性校正，再产出最终评估与反馈：

- **缺项降级**：某维度完全无事件支撑时，该维分数上限封顶（如不超过 2）。
- **敏感行为扣分**：出现 `sensitive_info_shared` 且无 `risk_noticed` 时，对 Safety & Ownership 或总分做扣分/降级。
- **输出**：校正后的五维分、最终加权分、以及面向用户的反馈措辞（可按 UserProfile 选版）。

校正规则需在代码/配置中明确定义，便于后续迭代与离线校准。
