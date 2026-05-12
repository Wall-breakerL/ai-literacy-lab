# 问题修复方案：问卷维度偏差导致"董事长"类型过多

## 问题描述

当前 active 流程（hybrid_batch1 + hybrid_batch2 共 16 题）中，所有题目均为 `reverse: false`，即用户选分越高，四个维度得分越高，最终越倾向于 CFAG（董事长）。

题目描述的行为（"先验证再用"、"先定框架"、"主动讨论"）都是听起来正确的好习惯，用户存在社会期望偏差，天然倾向于全选高分，导致大多数人落入 CFAG。

**根本原因：** 每个维度的所有题目高分都指向同一端，没有双向锚定。

---

## 修复目标

每个维度 4 题中，**2 题高分指向高端（reverse: false），2 题高分指向低端（reverse: true）**。

用户如果真实倾向于某一端，该端的正向题会选高分，反向题会选低分，两者叠加后分数才能准确反映真实倾向，而不是被社会期望拉偏。

**重要约束：** `reverse: true` 只是计分层面的翻转，题目措辞上不能出现否定句或绕弯子的表达。两端的题目都应该描述真实、合理的工作方式，让用户感觉是在如实描述自己，而不是在回答"对不对"。

---

## 各维度双向锚定说明

### Relation（关系定位）
- **高端（Collaborative 伙伴型）**：把 AI 当讨论伙伴，期待 AI 主动补充、追问
- **低端（Instrumental 工具型）**：把 AI 当执行工具，直接给指令拿结果，不需要来回讨论

### Workflow（工作流程）
- **高端（Framed 框架型）**：先定框架/目标/步骤，再让 AI 在边界内执行
- **低端（Exploratory 探索型）**：先扔想法给 AI 探索，边试边调整，不需要先想清楚

### Epistemic（认知态度）
- **高端（Auditing 审计型）**：会验证 AI 输出，要求说明依据，核对后再用
- **低端（Trusting 信任型）**：直接采纳 AI 输出，觉得合理就用，不需要额外验证

### RepairScope（修复范围）
- **高端（Global 全局重评型）**：出错时倾向于重新描述问题、换框架重来
- **低端（Local 局部调整型）**：出错时倾向于在现有基础上局部修改、小步迭代

---

## 需要修改的文件

### 1. `src/lib/fallbackQuestionnaire.ts`

**修改内容：** 将 `FALLBACK_QUESTIONNAIRE_BATCHES` 中 hybrid_batch1 和 hybrid_batch2 各 8 题，改为每个维度 1 题 `reverse: false` + 1 题 `reverse: true`，共 4 个维度 × 2 = 8 题，正反各半。

**改写原则：**
- `reverse: true` 的题目描述低端行为，措辞自然，不用否定句
- 题目之间语义互补，不重复
- 保持现有的 `questionType` 分布（batch1: universal + semi_specific；batch2: semi_specific + specific）

**hybrid_batch1 参考改写（每维度第2题改为 reverse: true）：**

```typescript
// Relation - reverse: false（高分=伙伴型）
{ dimension: "Relation", scenario: "通用", question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具。", questionType: "universal", reverse: false }
// Relation - reverse: true（高分=工具型，计分时翻转）
{ dimension: "Relation", scenario: "做事", question: "做事时，我更习惯直接给 AI 明确指令，不需要它主动补充建议。", questionType: "semi_specific", reverse: true }

// Workflow - reverse: false（高分=框架型）
{ dimension: "Workflow", scenario: "通用", question: "用 AI 时，我习惯先明确目标，再开始对话。", questionType: "universal", reverse: false }
// Workflow - reverse: true（高分=探索型，计分时翻转）
{ dimension: "Workflow", scenario: "完成任务", question: "完成任务时，我更喜欢先让 AI 探索几个方向，再决定怎么推进。", questionType: "semi_specific", reverse: true }

// Epistemic - reverse: false（高分=审计型）
{ dimension: "Epistemic", scenario: "通用", question: "AI 给出答案后，我通常会先验证再使用。", questionType: "universal", reverse: false }
// Epistemic - reverse: true（高分=信任型，计分时翻转）
{ dimension: "Epistemic", scenario: "做判断", question: "做判断时，AI 给出的结论我觉得合理就直接采用，不需要它解释依据。", questionType: "semi_specific", reverse: true }

// RepairScope - reverse: false（高分=全局型）
{ dimension: "RepairScope", scenario: "通用", question: "AI 出错时，我更愿意重新描述问题，而不是只改局部。", questionType: "universal", reverse: false }
// RepairScope - reverse: true（高分=局部型，计分时翻转）
{ dimension: "RepairScope", scenario: "出错时", question: "结果偏离预期时，我习惯在现有内容上一点点调整，而不是推倒重来。", questionType: "semi_specific", reverse: true }
```

**hybrid_batch2 同理**，semi_specific + specific 各一题，每维度正反各一。

---

### 2. `src/lib/researcher.ts`

**修改内容：** 更新 `buildQuestionnaireBatchPrompt` 中的出题约束，允许并要求 LLM 生成的题目也包含双向锚定。

**需要修改的两处：**

**（1）`<batch_contract>` 块中的正反向分布说明（当前第384行附近）：**

```
// 改前
正反向分布：全部 reverse=false

// 改后
正反向分布：每个维度 1 题 reverse=false（高分指向高端），1 题 reverse=true（高分指向低端）；每批共 4 题 reverse=false + 4 题 reverse=true
```

**（2）`<direction_contract>` 块（当前第388行附近）：**

```
// 改前
全部正向：认同度高 -> Relation=Collaborative、Workflow=Framed、Epistemic=Auditing、RepairScope=Global。

// 改后
双向锚定：
- reverse=false 题：认同度高 -> Relation=Collaborative、Workflow=Framed、Epistemic=Auditing、RepairScope=Global
- reverse=true 题：认同度高 -> Relation=Instrumental、Workflow=Exploratory、Epistemic=Trusting、RepairScope=Local
每个维度必须各出 1 题 reverse=false 和 1 题 reverse=true，题目措辞均为正向陈述，不用否定句。
```

**（3）`<question_examples>` 块中补充反向题示例：**

```
【反向题示例（reverse=true，措辞正向，描述低端行为）】
✓ dimension=Relation, reverse=true, question="做事时，我更习惯直接给 AI 明确指令，不需要它主动补充建议。"
✓ dimension=Epistemic, reverse=true, question="做判断时，AI 给出的结论我觉得合理就直接采用，不需要它解释依据。"
✗ reverse=true, question="我不会先验证 AI 的答案。"（否定句，不符合要求）
```

---

### 3. `src/lib/types.ts`

**修改内容：** 更新 `QuestionnaireQuestion.reverse` 字段的注释，移除"新 active 流程固定 false"的错误描述。

```typescript
// 改前
/** 旧版兼容字段；新 active 流程固定 false。 */
reverse?: boolean;

// 改后
/** true 表示该题高分指向维度低端（如工具型、探索型、信任型、局部型）；计分时自动翻转。 */
reverse?: boolean;
```

---

### 4. `src/lib/researcher.ts` — `RESEARCHER_TOOL_SYSTEM` 中的注释（第102行）

```typescript
// 改前
active 流程全部 reverse=false：用户越认同，越靠近 Collaborative / Framed / Auditing / Global。

// 改后
active 流程双向锚定：每维度各 1 题 reverse=false（高分=高端）+ 1 题 reverse=true（高分=低端）。
reverse=false：认同度高 -> Collaborative / Framed / Auditing / Global。
reverse=true：认同度高 -> Instrumental / Exploratory / Trusting / Local（计分层自动翻转）。
```

---

### 5. `src/lib/questionnaireValidation.ts` 与 `src/app/api/questionnaire/generate/route.ts`

**修改内容：** 校验器也必须接受并强制新的正反向分布，否则模型输出会被最终校验打回旧 fallback。

- 单批次：每维 2 题，其中 1 题 `reverse: true`
- 合并 16 题：每维 4 题，其中 2 题 `reverse: true`
- 路由错误提示里的“全正向”文案同步改成“每维 1 正 1 反 / 2 正 2 反”

---

### 6. 低区分度结果保护

双向锚定后，如果用户所有题都选同一个分数，每个维度会回到 50 分附近。不能再用 `>= 50` 强行落到 CFAG，而应返回中性画像，例如 `BALANCED / 待观察型`，引导用户看维度明细而不是固定人格名。

---

## 不需要修改的文件

- `src/lib/reportScoring.ts`：`scoreAnswer` 函数已正确处理 `reverse: true`（第73行 `answer.reverse ? LIKERT_MAX - raw : raw`），无需改动。
- 所有 UI 组件：问卷渲染层不感知 `reverse` 字段。

---

## 验证方式

修改完成后，用以下场景手动验证：

1. **全选高分 / 全选低分 / 全选中间分**：应进入中性或低区分度处理，不应强行显示 CFAG
2. **一致性测试**：对某维度的正向题选高分、反向题选低分（表示真实倾向高端），最终该维度应落入高端
3. **反向一致性测试**：对某维度的正向题选低分、反向题选高分（表示真实倾向低端），最终该维度应落入低端
