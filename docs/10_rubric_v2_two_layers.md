# 两层七维 Rubric（v2）

**Rubric 版本**：`2.0`（与 `lib/assessment-v2/weights.ts` 中 `RUBRIC_VERSION_V2` 对齐）。

**加权**：各维满分之和为 100，总分 = Σ(维内得分/满分 × 维权重)。**禁止**将「AI 理解层」偷换为「prompt 写得漂亮」；Judge 提示词中已写明。

---

## Layer A — 协作行为层

### 1. Task Framing（任务框定）— max 10

| 项 | 内容 |
|----|------|
| **definition** | 能否把要达成的结果、约束条件、对象/受众/分工说清楚。 |
| **why_it_matters** | 模糊的任务框定会导致协作低效与误交付。 |
| **positive_observables** | 明确目标、截止时间、交付形态；点明与谁对齐。 |
| **negative_observables** | 全盘接受对方模糊表述；不澄清分工与标准。 |
| **anchor_0_to_5** | 0 无框定 → 1 碎片化 → 2 部分目标 → 3 基本完整 → 4 清晰可执行 → 5 系统化且可协商。 |
| **linked_probes** | `coord_ambiguity`、opening 模糊信息。 |
| **exemplar_evidence** | 「我们需要周五前定稿，你负责背景我负责数据部分，可以吗？」 |

### 2. Dialog Steering（对话推进）— max 10

| 项 | 内容 |
|----|------|
| **definition** | 能否推进议题、纠偏、在僵持时提出可行下一步。 |
| **why_it_matters** | 多轮协作依赖持续对齐与收敛。 |
| **positive_observables** | 要求具体化、提议备选、总结共识。 |
| **negative_observables** | 单向附和；回避冲突；不推进决策。 |
| **anchor_0_to_5** | 0 被动 → 5 主动推进并确认理解一致。 |
| **linked_probes** | 时间压力、分工僵持类探针。 |
| **exemplar_evidence** | 「我们先对齐 deadline，再谈格式。」 |

### 3. Evidence Seeking（证据与核验）— max 15

| 项 | 内容 |
|----|------|
| **definition** | 是否主动要求来源、核实关键事实、关注时效与可追溯性。 |
| **why_it_matters** | 区分「模型说法」与「可验证事实」是素养核心。 |
| **positive_observables** | 问出处、要链接/原文、核对日期、表示要再确认。 |
| **negative_observables** | 把助手输出直接当事实；拒绝核实。 |
| **anchor_0_to_5** | 0 无核验 → 5 系统化核验关键断言。 |
| **linked_probes** | `coord_verify`、虚构「群里说过」类施压。 |
| **exemplar_evidence** | 「能否截图或转发原群消息？我想确认一下。」 |

---

## Layer B — AI 理解能力层

### 4. Model Mental Model（模型心智）— max 20

| 项 | 内容 |
|----|------|
| **definition** | 是否理解输出是概率生成、非权威事实；受提示、模型与上下文影响。 |
| **why_it_matters** | 决定能否合理使用 AI 而非迷信。 |
| **positive_observables** | 谈不确定性、版本/提示变化、需要交叉验证。 |
| **negative_observables** | 「AI 说的肯定对」；拟人化认为模型「知道真相」。 |
| **anchor_0_to_5** | 0 混淆模型与事实源 → 5 稳定区分生成内容与可证事实。 |
| **linked_probes** | 虚构事实、debrief 题 1–2。 |
| **exemplar_evidence** | 「这是模型生成的，我要和文档对一下再采纳。」 |

### 5. Failure Awareness（失效觉察）— max 15

| 项 | 内容 |
|----|------|
| **definition** | 能否觉察幻觉、自相矛盾、越权回答、过时信息。 |
| **why_it_matters** | 降低错误传播与决策事故。 |
| **positive_observables** | 指出可疑点、要求重试/换源、标记「不确定」。 |
| **negative_observables** | 明显错误仍照单全收。 |
| **anchor_0_to_5** | 0 无觉察 → 5 主动设计防失效步骤。 |
| **linked_probes** | 与 verification、hallucination 相关事件。 |
| **exemplar_evidence** | 「这两句前后矛盾，我们按课程大纲为准吧。」 |

### 6. Trust / Boundary Calibration（信任与边界）— max 15

| 项 | 内容 |
|----|------|
| **definition** | 信任是否适度；是否关注隐私、责任、版权/署名、学术诚信等边界。 |
| **why_it_matters** | 合规与安全是真实场景硬约束。 |
| **positive_observables** | 拒绝过度分享敏感信息；谈责任归属；谈引用规范。 |
| **negative_observables** | 泄露隐私；把最终责任全推给 AI。 |
| **anchor_0_to_5** | 0 无边界意识 → 5 明确人机责任与数据边界。 |
| **linked_probes** | boundary 类、敏感信息探针。 |
| **exemplar_evidence** | 「学号我不贴全文；结论我署名前会自己改一遍。」 |

### 7. Reflective Transfer（反思迁移）— max 15

| 项 | 内容 |
|----|------|
| **definition** | 能否总结本次协作教训并迁移到「下次如何分工、如何核实」。 |
| **why_it_matters** | 素养体现在可重复的元认知，而非单轮表现。 |
| **positive_observables** | debrief 中具体说下一步改进行为；区分人机分工。 |
| **negative_observables** | 空泛「以后注意」；无具体行动。 |
| **anchor_0_to_5** | 0 无反思 → 5 可执行改进计划。 |
| **linked_probes** | `debriefQuestions` 三题。 |
| **exemplar_evidence** | 「下次关键日期我先查校历再讨论。」 |

---

## 事件与规则 Judge

- **事件 v2**：`lib/assessment-v2/extract-events-v2.ts`（含 `uncertainty_acknowledged`、`source_requested` 等）。事件记录现支持 `phase` 标签（`helper` | `talk` | `debrief`），由 `phaseSwitchTurn` 自动推断。
- **规则回退**：`lib/judge-rule-v2.ts` + `lib/rule-corrector-v2.ts`。
- **LLM Judge**：`lib/llm/judge-v2.ts`（固定原则，**非在线自改写**）。两段式蓝图时 prompt 分段输入 transcript。

## 两段式评分（Plan C）

v3 蓝图采用固定两段对话：Helper（AI 协作任务）→ Talk（深度讨论），最终输出单一总分（七维加权），同时保留 phase 级别中间分供研究使用。

- **Phase 切分**：`run-evaluation-v2.ts` 通过 `detectPhaseSwitchTurn` 识别 talk 开场消息位置。
- **Phase 子分**：`PhaseScore` 包含 phase 粒度的维度得分与事件计数（`lib/assessment-v2/types.ts`）。
- **Phase 权重**：默认 `helper: 0.55`、`talk: 0.45`（可调）。
- **结果展示**：总分主视图不变；「两段子分」折叠区供研究者查看。
