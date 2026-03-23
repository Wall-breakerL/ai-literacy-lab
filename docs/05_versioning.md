# 版本与离线校准

## 版本字段

所有与评估相关的**可复现产物**都带版本，便于对齐文档、规则与数据。

约定字段（可在配置或数据头里体现）：

```typescript
type EvalVersion = {
  rubricVersion: string   // 当前产物多为 "2.0"（两层七维），见 10_rubric_v2
  scenarioVersion: string // 全局场景包版本
  blueprintVersion?: string // v2 单蓝图 JSON 的 version 字段
  eventSchemaVersion: string // v2 事件集合，见 04 与 assessment-v2
  identityVersion?: string   // IdentityDossier.version
  memorySchemaVersion?: string // UserMemory / Experience 结构版本
  judgePromptVersion: string
  judgeModel: string        // 或 "rule-based"
  scoredAt: string          // ISO 时间
  judgeVersion?: string     // 兼容旧字段
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
