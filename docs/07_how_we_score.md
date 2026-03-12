# 如何打分（面向老师 / 汇报用）

本文档是「打分流程 + 模型选型 + Judge 约束」的**最终版本**，可直接用于向老师汇报或写进方案。

---

## 1. 三步流程总览

- **Step 1**：对话过程中记录**可观察行为事件**，不直接判总分。
- **Step 2**：**单 Judge** 读取完整会话与事件摘要，输出**固定 JSON** 的结构化评分（推荐 Structured Outputs）。
- **Step 3**：**规则层**对 Judge 输出做「校正」（封顶/兜底），不重新评分；Judge 负责细腻度，规则层控制底线与上限。

---

## 2. Step 1：对话过程中记录事件

系统不直接判总分，先记录可观察行为，事件类型为：

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

事件来源二选一或组合：

- **简单规则 / 关键词 / 状态机**：从每轮用户输入中匹配。
- **轻量 extractor 模块**：把每轮用户输入转成结构化事件（后续可替换为小模型或规则增强）。

事件序列与完整对话一起作为 Step 2 的输入。

---

## 3. Step 2：单 Judge 输入与输出

### 3.1 Judge 的输入

应包含：

- **用户画像**（role, level）
- **场景 ID**
- **场景 hidden checks**（本场景的隐性考察点）
- **完整 transcript**（对话全文）
- **event summary**（事件列表或摘要）

### 3.2 Judge 的输出（固定 JSON）

输出必须是**固定 schema 的 JSON**，不用自由文本。推荐使用 OpenAI Structured Outputs（或等价机制）保证 schema 一致。

建议结构（与实现对齐时维度 key 保持 clarity / context / steering / judgment / safetyOwnership）：

```json
{
  "rubricVersion": "v1.0",
  "scenarioId": "message_student",
  "profile": { "role": "student", "level": "novice" },
  "dimensions": {
    "clarity": {
      "level": 4,
      "evidence": ["我想给导师发一段消息，说明周三不能到会，150字以内，语气礼貌"],
      "reason": "任务目标、对象、长度和语气都被明确说明"
    },
    "context": {
      "level": 3,
      "evidence": ["因为和课程考试时间冲突"],
      "reason": "补充了部分背景，但还缺少更完整上下文"
    },
    "steering": {
      "level": 2,
      "evidence": ["太正式了，改自然一点"],
      "reason": "有一次修订请求，但推进轮次较少"
    },
    "judgment": {
      "level": 2,
      "evidence": [],
      "reason": "没有明显核验或质疑输出的行为"
    },
    "safetyOwnership": {
      "level": 4,
      "evidence": ["没有提供敏感隐私信息"],
      "reason": "使用边界较好"
    }
  },
  "flags": [],
  "suggestions": [
    "下次可以更早补充对方身份和消息用途",
    "当 AI 给出结论时，可多问一句是否需要核验"
  ]
}
```

- **dimensions**：五维各含 `level`（0–5）、`evidence`（用户原话或行为引用）、`reason`（简短理由）。
- **flags**：可选，用于标记异常或需复核项。
- **suggestions**：面向用户的 1–3 条改进建议。

加权总分可由各维 `level` × 权重在规则层或展示层计算。

---

## 4. Step 3：规则层做「校正」（不重新评分）

规则层**不替代 Judge**，而是防止 Judge 漂得太远，控制底线和上限。例如：

| 情况 | 校正规则 |
|------|----------|
| 用户从未补充背景 | Context 最高只能到 2 |
| 完全没有任何修订、比较、追问 | Steering 最高只能到 2 |
| 出现明显敏感信息裸贴 | Safety 最高只能到 1 |
| 场景存在明确验证机会但用户从未核验 | Judgment 最高只能到 2 |

最终逻辑：**Judge 决定细腻程度，规则层控制底线和上限**。这样比「纯 Judge 打分」更稳定，也更容易向老师解释。

---

## 5. 单模型 / 双模型 / Agent Network 怎么选

三档路线，按阶段选：

| 档位 | 做法 | 适用阶段 |
|------|------|----------|
| **A 档（两天 MVP，最推荐）** | 一个聊天模型 + **同一个**基础模型的**独立** Judge 调用（Chat 一次、Judge 一次，两次分离的 API 请求） | 研究原型、工程最省 |
| **B 档（正式版推荐）** | 一个**便宜快**的聊天模型 + 一个**更稳**的 Judge 模型（如聊天用 mini，评分用更强模型） | 正式上线、成本可控 |
| **C 档（后续研究增强）** | **多 Judge panel / Agent Network 只放在离线校准层**：线上仍单 Judge；每隔一批样本抽 5%–10% 给多 Judge 复核，再与人工小样本比对 | 评估系统校准、模型可进化 |

结论：**不需要一开始上 Agent Network**。它是后续「评估系统校准器」，不是首发「在线打分器」。

---

## 6. Judge Prompt 的设计原则（必须写死）

以下几条必须写进 Judge 的 system/user prompt，作为硬约束，用于对抗 LLM-as-a-judge 的常见偏差（如奖励表面流畅、篇幅等）：

1. **评分对象是用户，不是 assistant 的文采。**
2. **不要奖励单纯的长篇大论。**
3. **证据必须尽量来自用户自己的话（或可观察行为）。**
4. **同一核心 rubric 适用于所有 profile；profile 只影响场景期待，不改变 literacy 的核心定义。**
5. **若 assistant 本身输出很差，要先判断用户有没有机会识别，而不是直接扣用户分。**

实现时：在 `lib/llm/judge.ts`（或等价）的 prompt 模板中显式写入以上 5 条，并在迭代时保持不删减。

---

## 7. 与现有实现的对齐与实施计划

- **事件**：已实现 `lib/event-logger.ts`（规则/关键词），满足 Step 1；后续可插拔「轻量 extractor」。
- **Judge 输出**：当前为简化版（`dimensionScores` + `weightedScore`）；需**扩展**为上述「dimensions.level/evidence/reason + flags + suggestions」的富结构，并在 LLM Judge 与结果页中落地；规则 Judge 可继续输出简化版，由适配层转为富结构或仅填 level。
- **规则校正**：已实现 `lib/rule-corrector.ts`（缺项降级、敏感扣分），满足 Step 3；可补充「Context/Steering/Judgment 无证据时上限为 2」等规则与 4. 中表格一致。
- **模型策略**：先按 **A 档**（同一模型、Chat + Judge 两次独立调用）接入；B/C 仅配置与文档预留，不做复杂实现。
- **Judge 输入**：LLM Judge 的 prompt 中必须包含 profile、scenarioId、场景 hidden checks、完整 transcript、event summary；输出必须走 Structured Outputs 或等价校验，保证 JSON schema 符合 3.2。

具体实施顺序见 [08_implementation_plan_api.md](./08_implementation_plan_api.md)（在下一份文档中给出可执行任务列表）。
