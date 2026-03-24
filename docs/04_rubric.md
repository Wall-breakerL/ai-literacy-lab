# 两层七维评分体系（Rubric v2）

版本：`2.0`（`lib/assessment-v2/weights.ts` 中 `RUBRIC_VERSION_V2`）

---

## Layer A — 协作行为层

### 1. Task Framing（任务框定）— max 10

能否把目标、约束、对象/分工说清楚。

- **正面信号**：明确目标、截止时间、交付形态；点明与谁对齐
- **负面信号**：全盘接受对方模糊表述；不澄清分工与标准

### 2. Dialog Steering（对话推进）— max 10

能否推进议题、纠偏、在僵持时提出可行下一步。

- **正面信号**：要求具体化、提议备选、总结共识
- **负面信号**：单向附和；回避冲突；不推进决策

### 3. Evidence Seeking（证据与核验）— max 15

是否主动要求来源、核实关键事实、关注时效与可追溯性。

- **正面信号**：问出处、要链接/原文、核对日期、表示要再确认
- **负面信号**：把助手输出直接当事实；拒绝核实

---

## Layer B — AI 理解能力层

### 4. Model Mental Model（模型心智）— max 20

是否理解输出是概率生成、非权威事实；受提示、模型与上下文影响。

- **正面信号**：谈不确定性、版本/提示变化、需要交叉验证
- **负面信号**：「AI 说的肯定对」；拟人化认为模型「知道真相」

### 5. Failure Awareness（失效觉察）— max 15

能否觉察幻觉、自相矛盾、越权回答、过时信息。

- **正面信号**：指出可疑点、要求重试/换源、标记「不确定」
- **负面信号**：明显错误仍照单全收

### 6. Trust / Boundary Calibration（信任与边界）— max 15

信任是否适度；是否关注隐私、责任、版权/署名、学术诚信等边界。

- **正面信号**：拒绝过度分享敏感信息；谈责任归属；谈引用规范
- **负面信号**：泄露隐私；把最终责任全推给 AI

### 7. Reflective Transfer（反思迁移）— max 15

能否总结本次协作教训并迁移到「下次如何分工、如何核实」。

- **正面信号**：debrief 中具体说下一步改进行为；区分人机分工
- **负面信号**：空泛「以后注意」；无具体行动

---

## 权重

各维满分之和为 100，总分 = Σ(维内得分/满分 × 维权重)。

| 维度 | 满分 | 权重 |
|------|------|------|
| Task Framing | 10 | 10% |
| Dialog Steering | 10 | 10% |
| Evidence Seeking | 15 | 15% |
| Model Mental Model | 20 | 20% |
| Failure Awareness | 15 | 15% |
| Trust / Boundary Calibration | 15 | 15% |
| Reflective Transfer | 15 | 15% |

**禁止**将 Layer B 维度偷换为「prompt 写得漂亮」；Judge 提示词中已写明。

---

## Judge 输出结构（JudgeOutputV2）

```typescript
type JudgeOutputV2 = {
  rubricVersion: string;                              // "2.0"
  scenarioId: string;
  identityId?: string;
  dimensions: Record<V2DimensionKey, V2DimResult>;   // 每维含 score/max/evidence/reason
  flags: string[];                                     // 异常标记
  suggestions: string[];                                // 改进建议（1–3 条）
  blindSpots: string[];                               // 盲点（1–4 条）
  nextRecommendedScenarios: string[];
  nextRecommendedProbes: string[];
};

type V2DimResult = {
  score: number;       // 0 到 max，带一位小数
  max: number;
  evidence: string[];  // 用户原话摘录
  reason: string;      // 简短理由
};
```

---

## 两段式评分

v2 蓝图采用 Helper → Talk 两段对话，最终输出单一总分（七维加权），同时保留 phase 级别中间分供研究使用。

- **Phase 切分**：`lib/evaluation/run-evaluation-v2.ts` 通过 `detectPhaseSwitchTurn` 识别 talk 开场消息位置
- **Phase 子分**：`PhaseScore` 包含 phase 粒度的维度得分与事件计数
- **Phase 权重**：默认 `helper: 0.55`、`talk: 0.45`（可调）
- **结果展示**：总分主视图不变；「两段子分」折叠区供研究者查看
