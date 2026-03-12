# 版本与离线校准

## 版本字段

所有与评估相关的**可复现产物**都带版本，便于对齐文档、规则与数据。

约定字段（可在配置或数据头里体现）：

```typescript
type EvalVersion = {
  rubricVersion: string   // 如 "1.0"，对应 03_rubric 的维度与权重
  scenarioVersion: string // 如 "1.0"，对应 02 中 4 个场景的 id 与文案
  eventSchemaVersion: string // 如 "1.0"，对应 04 中 EvalEvent 集合
  judgeVersion?: string  // 规则 judge 或模型 judge 的版本标识
}
```

- 任意一次评估会话应能追溯到上述版本，便于日后「同一 rubric / 同一场景」下的对比与校准。

---

## 离线校准计划

- **目的**：在不上线的前提下，用历史或合成对话数据验证事件识别、Judge 分数与规则校正是否合理、一致。
- **输入**：带 `EvalVersion` 的对话日志（含事件序列与 Judge 原始输出）。
- **动作**：
  - 人工或专家对一批样本打 0–5 维分，作为标答；
  - 对比 Judge 输出与标答，算维度级与总分级一致性（如相关系数、偏差分布）；
  - 根据结果调整事件规则、Judge 逻辑或规则校正阈值。
- **节奏**：MVP 后可每迭代一轮 rubric/场景/事件后跑一轮小规模离线校准，再推上线或 A/B。
