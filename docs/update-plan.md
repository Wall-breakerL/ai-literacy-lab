# AI-MBTI 流程重构实施计划

## 当前状态

本文档记录新流程的设计讨论与实施进度。

---

## 步骤 1：信息收集页 (/intake)

### 设计决策（2026-05-05）

#### 1. 页面路由
- **新建** `/intake` 作为流程入口
- Landing page (/) → Intake page (/intake) → 第一轮问卷生成页
- **旧流程清除**：不保留 `/interview` 的访谈业务逻辑

#### 2. 表单字段

```typescript
interface IntakeForm {
  role: string;           // 职业/身份（必填）
  recentUse: string;      // 具体AI使用经历（必填）
  tools: string[];        // 常用的AI工具（必填，可多选）
}
```

**字段说明：**

| 字段 | 类型 | 说明 | UI 形式 |
|------|------|------|---------|
| role | string | 职业/身份 | 单行文本框 |
| recentUse | string | 具体AI使用经历 | 多行文本框（3-5行） |
| tools | string[] | 常用的AI工具 | 多选框或标签选择器 |

**表单验证：**
- 不设置字数限制
- 只验证必填字段非空
- 具体内容质量由后续问卷生成 prompt 处理

**AI工具选项：**
- ChatGPT
- Claude
- Gemini
- 文心一言
- 通义千问
- 豆包
- Kimi
- Copilot
- Cursor
- 其他（自定义输入）

**表单提示文案：**
- 职业/身份：`"例如：产品经理、前端工程师、材料系研究生"`
- AI 使用经历：`"请描述一个具体场景，比如你用 AI 做了什么、遇到了什么问题"`
- AI 工具：`"选择你最常用的 AI 工具（可多选）"`

**UI 形式：**
- 职业/身份：单行文本框
- AI 使用经历：多行文本框（3-5行）
- AI 工具：标签选择器（炫酷的悬浮标签，点击高亮）

#### 3. UI 设计风格

**保持与 landing page 一致：**
- 深色渐变背景 (`bg-gradient-to-br from-[#07080a] via-[#0a0d14] to-[#0c0f15]`)
- 粒子动画背景
- 光晕效果
- 卡片式表单，带毛玻璃效果 (`backdrop-blur-sm`)
- 渐变色强调（红-蓝-绿）

**新增元素：**
- 进度指示器："第 1/4 步"或"信息收集 → 第一轮问卷 → 中途反馈 → 第二轮问卷"
- 表单卡片悬浮动画
- 提交按钮渐变发光效果

#### 4. 数据结构重新设计

**问题：现有 goal/goalStatus/goalType 结构的局限性**

当前 `TargetContext` 结构：
```typescript
interface TargetContext {
  role: string;
  recentUse: string;
  goal: string;           // ← 问题：用户的 goal 基本只有两种
  goalStatus: GoalStatus; // ← "specific" | "generic" | "missing"
  goalType: GoalType;     // ← 8种枚举，过于细分
}
```

**观察：**
- 用户的 goal 本质上只有两类：
  1. **提高效率**：让 AI 帮我快速完成任务
  2. **获得灵感**：希望 AI 提供更多 idea/思路/选择/灵感
- goalStatus (specific/generic/missing) 区分度低
- goalType 的 8 种枚举（product_building, research_writing, learning, coding_system, business_decision, daily_efficiency, creative_work, other）过于细分，且与实际协作风格关联不强

**重新设计方案（已确定）：**

**最终方案：统一 goal，简化数据结构**

```typescript
interface TargetContext {
  role: string;
  recentUse: string;
  tools: string[];
  goal: string;  // 固定值："提高效率，并获得更多 idea/思路/选择/灵感"
}
```

**设计理由：**
- 所有 AI 用户的目标本质上都是这两点：提高效率 + 获得灵感
- 没必要做无意义的细分（goalType 8种枚举、goalStatus 3种状态）
- AI-MBTI 要测的不是"用户想要什么"，而是"用户如何实现这个目标"
- 简化数据结构，减少表单负担

**移除的字段：**
- `goalStatus: GoalStatus` - 不再需要区分 specific/generic/missing
- `goalType: GoalType` - 不再需要 8 种任务类型枚举

**保留的字段：**
- `goal: string` - 固定值，用于报告生成时的上下文一致性

#### 5. 本地规则：从表单生成 SessionState

```typescript
const UNIFIED_GOAL = "提高效率，并获得更多 idea/思路/选择/灵感";

function createSessionStateFromIntake(form: IntakeForm): SessionState {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  return {
    sessionId,
    turn: 0,
    phase: "questionnaire_batch1",
    background: {
      role: form.role.trim(),
      tools: form.tools,
      recentUse: form.recentUse.trim(),
      goal: UNIFIED_GOAL,
    },
    evidence: [],
    openProbes: [],
    questionnaireBatches: {},
    batchAnswers: {},
  };
}
```

#### 6. 数据流转

```
用户提交表单
  ↓
本地验证（必填字段非空）
  ↓
createSessionStateFromIntake(form)
  ↓
存储到 sessionStorage:
  - ai_mbti_session_state
  - ai_mbti_identity
  ↓
router.push('/interview?phase=generating&batch=1')
```

---

## 问卷设计重构（2026-05-05）

### 核心决策

经过讨论，我们对问卷设计做出以下根本性调整：

#### 1. 取消反向题
- **决策**：全部使用正向题
- **理由**：
  - 降低用户认知负担
  - 提高题面质量（模型只需写一种逻辑）
  - 避免反向题导致的困惑和数据污染
  - AI-MBTI 是自愿测评，作弊动机低

#### 2. 简化计分方式
- **用户选择**：0（完全不符合）、1、2、3、4、5（完全符合）
- **跳过处理**：跳过题按中位数 2.5 分计算
- **维度分数**：直接求和，不映射到 0-100

**计分示例：**
```typescript
// Relation 维度有 4 道题
// 用户答：5, 4, 5, 3
// Relation 分数 = 17（满分 20）

// 倾向判断：
// Relation 分数 ≥ 10 → Collaborative
// Relation 分数 < 10 → Instrumental

// 置信度判断：
// |分数 - 10| 越大，置信度越高
// 17 分 → 强 Collaborative（high confidence）
// 11 分 → 弱 Collaborative（medium confidence）
// 9.5 分 → 弱 Instrumental（medium confidence）
```

#### 3. 优化题目数量
- **总题数**：16 题（8 + 8 两轮）
- **第一轮**：8 题（轻量采样）
- **第二轮**：8 题（深入探测）
- **维度分布**：每个维度 4 题（第一轮 2 题，第二轮 2 题）

**为什么保留两轮？**
- 8 题完成快（3-5 分钟），用户不会疲劳
- 中途反馈页可以收集用户对题目质量的反馈
- 第二轮可以根据第一轮结果和反馈调整
- 两轮 8 题比一轮 16 题的生成质量更稳定

#### 4. 题目类型重新设计

**取消"习惯题 vs 场景题"的二分法，改为"通用-半具体-具体"光谱：**

| 类型 | 数量 | 特点 | 示例 |
|------|------|------|------|
| 通用题 | 4 题 | 任何人都能理解和回答，不依赖职业或工具 | "我倾向于把 AI 当成讨论伙伴，而不只是执行工具" |
| 半具体题 | 8 题 | 结合用户职业/工具，但不过度具体 | "写文档时，我更愿意让 AI 提供多个方向，而不是直接给答案" |
| 具体题 | 4 题 | 直接来自用户的 recentUse，高度个性化 | "写产品需求时，我会让 AI 主动指出我可能遗漏的边界情况" |

**灵活适配原则：**
- 如果用户的 recentUse 很具体 → 多出具体题
- 如果用户的 recentUse 很泛 → 多出通用题
- 模型根据输入质量自动调整比例

---

## 新问卷设计方案

### 第一轮问卷（8 题）

**目标：轻量风格采样**

**题目分布：**
```typescript
{
  totalQuestions: 8,
  dimensions: {
    Relation: 2,      // 人机关系
    Workflow: 2,      // 工作流程
    Epistemic: 2,     // 认知信任
    RepairScope: 2    // 修正范围
  },
  questionTypes: {
    universal: 4,     // 通用题（每维度 1 题）
    semiSpecific: 4   // 半具体题（每维度 1 题）
  },
  allForward: true,   // 全部正向题
  scoreOptions: [0, 1, 2, 3, 4, 5]
}
```

**题目特点：**
- 题干简短（≤25 字）
- 易于理解和回答
- 快速覆盖四个维度
- 为第二轮提供初步方向

**示例题目：**

**Relation 维度（通用题）：**
- "我倾向于把 AI 当成讨论伙伴，而不只是执行工具"
- 0 分 → Instrumental（工具型）
- 10 分 → Collaborative（伙伴型）

**Workflow 维度（半具体题）：**
- "用 AI 做事时，我习惯先明确目标，再开始对话"
- 0 分 → Exploratory（探索型）
- 10 分 → Framed（框架型）

**Epistemic 维度（通用题）：**
- "AI 给出答案后，我通常会先验证再使用"
- 0 分 → Trusting（信任型）
- 10 分 → Auditing（审查型）

**RepairScope 维度（半具体题）：**
- "AI 出错时，我更愿意重新描述问题，而不是只改局部"
- 0 分 → Local（局部修正）
- 10 分 → Global（全局重构）

---

### 第二轮问卷（8 题）

**目标：深入探测 + 场景适配**

**题目分布：**
```typescript
{
  totalQuestions: 8,
  dimensions: {
    Relation: 2,
    Workflow: 2,
    Epistemic: 2,
    RepairScope: 2
  },
  questionTypes: {
    semiSpecific: 4,  // 半具体题（每维度 1 题）
    specific: 4       // 具体题（每维度 1 题，基于 recentUse 和中途反馈）
  },
  allForward: true,
  scoreOptions: [0, 1, 2, 3, 4, 5]
}
```

**题目特点：**
- 题干可以更长（≤35 字）
- 更贴近用户真实场景
- 回应中途反馈的问题和期望
- 深入探测第一轮的模糊区域

**生成策略：**
1. 读取第一轮答案，识别哪些维度接近中位数（需要深入探测）
2. 读取中途反馈，了解用户希望聚焦的场景
3. 从 recentUse 和中途反馈中提取具体场景
4. 生成更贴近用户真实工作方式的题目

**示例题目（基于用户反馈）：**

假设用户在中途反馈中说：
> "我最近主要用 Claude 写产品需求文档，希望第二轮更贴近这个场景"

**Relation 维度（具体题）：**
- "写需求文档时，我会让 AI 主动指出我可能遗漏的边界情况"
- 0 分 → Instrumental（只让 AI 执行指令）
- 10 分 → Collaborative（期待 AI 主动补充）

**Workflow 维度（具体题）：**
- "写需求时，我倾向于先写完整体框架，再让 AI 帮我细化每个部分"
- 0 分 → Exploratory（边写边探索）
- 10 分 → Framed（先定框架）

---

### 完整问卷结构

**完整问卷结构**

**总计：16 题**

| 维度 | 第一轮 | 第二轮 | 总计 | 满分 |
|------|--------|--------|------|------|
| Relation | 1 通用 + 1 半具体 | 1 半具体 + 1 具体 | 4 题 | 20 |
| Workflow | 1 通用 + 1 半具体 | 1 半具体 + 1 具体 | 4 题 | 20 |
| Epistemic | 1 通用 + 1 半具体 | 1 半具体 + 1 具体 | 4 题 | 20 |
| RepairScope | 1 通用 + 1 半具体 | 1 半具体 + 1 具体 | 4 题 | 20 |
| **总计** | **8 题** | **8 题** | **16 题** | **80** |

**题目类型分布（固定）：**
- 通用题：4 题（第一轮，每维度 1 题）
- 半具体题：8 题（第一轮 4 题 + 第二轮 4 题，每维度各 1 题）
- 具体题：4 题（第二轮，每维度 1 题）

---

### 计分与倾向判断

**维度分数计算：**
```typescript
function calculateDimensionScore(answers: Answer[]): number {
  let totalScore = 0;
  for (const answer of answers) {
    if (answer.skipped) {
      totalScore += 2.5;  // 跳过题按中位数计算
    } else {
      totalScore += answer.score;  // 0, 1, 2, 3, 4, 5
    }
  }
  return totalScore;
}

// 例如：Relation 维度 4 题
// 答案：5, 4, skip, 3
// 分数：5 + 4 + 2.5 + 3 = 14.5
```

**倾向判断：**
```typescript
function getTendency(score: number, maxScore: number): Tendency {
  const midpoint = maxScore / 2;  // 4 题满分 20，中点 10
  
  if (score >= midpoint) {
    return "Collaborative" | "Framed" | "Auditing" | "Global";
  } else {
    return "Instrumental" | "Exploratory" | "Trusting" | "Local";
  }
}
```

**置信度判断：**
```typescript
function getConfidence(score: number, maxScore: number): Confidence {
  const midpoint = maxScore / 2;
  const distance = Math.abs(score - midpoint);
  const maxDistance = maxScore / 2;
  const ratio = distance / maxDistance;
  
  if (ratio >= 0.6) return "high";      // 距离中点 60% 以上
  if (ratio >= 0.3) return "medium";    // 距离中点 30-60%
  return "low";                          // 距离中点 30% 以内
}

// 例如：Relation 维度
// 分数 17，满分 20，中点 10
// 距离 = |17 - 10| = 7
// 比例 = 7 / 10 = 0.7
// 置信度 = high

// 置信度的作用：
// - 报告页可以用不同颜色/样式展示高/中/低置信度的维度
// - 低置信度维度可以提示"这个维度的结果不够明确，可能需要更多题目"
// - 高置信度维度可以作为报告的重点展示
```

---

### 题面质量标准

**所有题目必须满足：**

1. **语法正确**
   - 无病句、无主谓不一致
   - 无机器翻译腔（"进行...的操作"、"实现...的目标"）

2. **长度适中**
   - 第一轮：≤25 字
   - 第二轮：≤35 字

3. **自然表达**
   - 像用户自己会说的话
   - 不像测评题或学术问卷

4. **避免模板化**
   - 禁止连续 3 题使用相同句式开头
   - 禁止"当我...时，我会..."的过度使用

5. **场景真实**
   - 具体题必须来自用户的 recentUse
   - 不编造用户没提到的场景

**正反例对比：**

❌ **差的题目：**
- "当我在使用 AI 进行代码编写的过程中，我倾向于先进行整体架构的规划"
  - 问题：长句堆叠、机器翻译腔、过度具体

✅ **好的题目：**
- "写代码时，我习惯先想好整体结构，再开始写"
  - 优点：简短、自然、易懂

❌ **差的题目：**
- "在与 AI 协作完成任务的场景下，我会期待它提供多样化的解决方案"
  - 问题：抽象、不像人话

✅ **好的题目：**
- "用 AI 做事时，我更希望它给我多个选择，而不是一个答案"
  - 优点：具体、自然、有对比

---

## 流程更新

基于新的问卷设计，流程调整为：

```
信息收集页（/intake）
  ↓
第一轮问卷生成页
  ↓
第一轮问卷作答（8 题）
  ↓
中途反馈页
  ↓
第二轮问卷生成页
  ↓
第二轮问卷作答（8 题）
  ↓
报告生成页
  ↓
报告页
```

**保留中途反馈页的理由：**
1. 8 题完成很快，用户不会疲劳
2. 可以收集题目质量反馈（哪些题不清楚、不贴近）
3. 可以让用户明确第二轮希望聚焦的场景
4. 第二轮可以根据反馈调整，提高题目质量

---

## 步骤 2：第一轮问卷生成 Prompt 设计

### 输入数据

**从步骤 1 接收：**
```typescript
{
  sessionState: {
    background: {
      role: string,        // 例如："前端工程师"
      tools: string[],     // 例如：["Claude", "Cursor", "ChatGPT"]
      recentUse: string,   // 例如："我最近用 Claude 写产品需求文档，经常需要它帮我补充边界情况和异常流程"
      goal: "提高效率，并获得更多 idea/思路/选择/灵感"
    }
  },
  batchMode: "hybrid_batch1",
  existingQuestions: []  // 第一轮无已有题目
}
```

### Prompt 结构设计

#### 1. 任务说明

```xml
<task>
你现在要生成 AI-MBTI 第一轮问卷（8 题）。

目标：快速采样用户在四个维度的初步倾向。
特点：通用易答，题干简短（≤25字），为第二轮提供方向。

必须调用 generate_questionnaire_batch 工具，把题目写入 nextQuestions。
</task>
```

#### 2. 问卷约束

```xml
<questionnaire_contract>
batchMode: hybrid_batch1
总题数：8 题
维度分布：Relation / Workflow / Epistemic / RepairScope 各 2 题
题目类型分布：
  - 通用题：4 题（每个维度 1 题）
  - 半具体题：4 题（每个维度 1 题）
正反向分布：每个维度 1 题 reverse=false + 1 题 reverse=true（共 4 正向 + 4 反向）
计分方式：用户选择 0-5 分，跳过按 2.5 分计算
</questionnaire_contract>
```

#### 3. 维度定义与倾向映射

```xml
<dimensions>
四个维度及其倾向（全部正向题，认同度高 → 右侧倾向）：

1. Relation（人机关系）
   0 分 ← Instrumental（工具型）：把 AI 当执行工具
   5 分 → Collaborative（伙伴型）：把 AI 当讨论伙伴

2. Workflow（工作流程）
   0 分 ← Exploratory（探索型）：边做边探索，灵活调整
   5 分 → Framed（框架型）：先定框架，再执行

3. Epistemic（认知信任）
   0 分 ← Trusting（信任型）：倾向于直接使用 AI 输出
   5 分 → Auditing（审查型）：倾向于验证后再使用

4. RepairScope（修正范围）
   0 分 ← Local（局部修正）：AI 出错时只改局部
   5 分 → Global（全局重构）：AI 出错时重新描述问题
</dimensions>
```

#### 4. 题目类型定义（核心）

```xml
<question_types>
第一轮包含两种题目类型：

【通用题】（4 题，每维度 1 题）
定义：任何人都能理解和回答，不依赖职业、工具或具体场景
特点：
- 描述普遍的 AI 使用倾向
- 不提及具体职业、工具名、任务类型
- 像在问"你通常怎么用 AI"
- scenario 字段写 "通用"

示例：
✅ "我倾向于把 AI 当成讨论伙伴，而不只是执行工具"
✅ "用 AI 时，我习惯先明确目标，再开始对话"
✅ "AI 给出答案后，我通常会先验证再使用"
✅ "AI 出错时，我更愿意重新描述问题，而不是只改局部"

❌ "写代码时，我倾向于..."（这是半具体题）
❌ "用 Claude 时，我会..."（不要提工具名）

【半具体题】（4 题，每维度 1 题）
定义：结合用户的职业领域或常见任务，但不过度具体
特点：
- 可以提及任务类型（写文档、调试代码、做分析）
- 不要提及用户的具体项目或细节场景
- 让用户能代入，但不局限于一个场景
- scenario 字段写任务类型（≤10字）

示例（假设用户是前端工程师）：
✅ scenario="写代码"，question="写代码时，我更愿意先自己试一遍，再问 AI 哪里能改进"
✅ scenario="调试问题"，question="调试问题时，我倾向于先定位范围，再让 AI 帮我分析"
✅ scenario="学习新技术"，question="学习新技术时，我习惯让 AI 给我多个学习路径，而不是一个答案"

❌ "写产品需求文档时，我会让 AI 补充边界情况"（太具体，这是第二轮的具体题）
❌ "在使用 AI 协助工作时..."（太抽象，这是通用题）

【如何从用户输入生成半具体题】
1. 读取用户的 role 和 recentUse
2. 提取用户可能做的任务类型（不是具体项目）
3. 用这些任务类型作为半具体题的场景

例如：
- role="前端工程师" → 任务类型：写代码、调试问题、优化性能、学习新框架
- role="产品经理" → 任务类型：写文档、做分析、开会讨论、规划功能
- role="研究生" → 任务类型：读文献、写论文、做实验、整理数据

如果 recentUse 提到具体场景，提取任务类型而不是具体细节：
- recentUse="我最近用 Claude 写产品需求文档，经常需要它帮我补充边界情况"
  → 任务类型：写文档、梳理需求、补充细节
  → 半具体题场景：写文档、梳理需求（不要写"写产品需求文档"）
</question_types>
```

#### 5. 题面质量标准

```xml
<question_quality>
所有题目必须满足：

1. 语法正确
   - 无病句、无主谓不一致
   - 无机器翻译腔（"进行...的操作"、"实现...的目标"、"在...的场景下"）

2. 长度适中
   - 题干 ≤50 字（第一轮可以更简短，≤30字更好）
   - scenario ≤10 字

3. 自然表达
   - 像用户自己会说的话
   - 不像测评题或学术问卷
   - 用"我"开头，第一人称陈述句

4. 避免模板化
   - 禁止连续 3 题使用相同句式开头
   - 禁止"当我...时，我会..."的过度使用
   - 每题的句式要有变化

5. 倾向清晰
   - 题干要让用户能明确判断"认同"或"不认同"
   - 不要写中性或模糊的陈述
   - 认同度高 = 5 分 = 右侧倾向（Collaborative/Framed/Auditing/Global）

正反例对比：

❌ "当我在使用 AI 进行代码编写的过程中，我倾向于先进行整体架构的规划"
   问题：长句堆叠、机器翻译腔、过度具体
✅ "写代码时，我习惯先想好整体结构，再开始写"
   优点：简短、自然、易懂

❌ "在与 AI 协作完成任务的场景下，我会期待它提供多样化的解决方案"
   问题：抽象、不像人话、"在...的场景下"
✅ "用 AI 做事时，我更希望它给我多个选择，而不是一个答案"
   优点：具体、自然、有对比

❌ "我倾向于对 AI 的输出结果进行验证和审查"
   问题：书面语、测评题感
✅ "AI 给出答案后，我通常会先验证再使用"
   优点：口语化、自然
</question_quality>
```

#### 6. 用户上下文与信息质量处理

```xml
<user_context>
用户职业/身份：${role}
常用 AI 工具：${tools.join('、')}
具体 AI 使用经历：
${recentUse}

【信息质量判断】
在生成题目前，先评估用户输入的质量：

1. role 质量判断（二分类）：
   - high：明确的职业、身份或学习方向
     ✅ "前端工程师"、"产品经理"、"材料系研究生"、"自由插画师"
   - low：以下任一情况
     ❌ 无意义字符："asdf"、"123"、"。。。"
     ❌ 拒绝回答："不知道"、"无"、"用户"、"随便"
     ❌ 答非所问：填的不是职业而是其他信息（"黑人"、"美国人"、"22岁"）
     ❌ 与 AI 测评无关的内容

2. recentUse 质量判断（二分类）：
   - high：描述了与 AI 相关的具体使用场景或习惯
     ✅ "用 Claude 写代码，经常让它帮我做 code review"
     ✅ "做研究时用 ChatGPT 整理文献"
     ✅ "偶尔用 AI 翻译和写邮件"
   - low：以下任一情况
     ❌ 无意义字符或拒绝："不知道"、"asdf"、"没用过"
     ❌ 答非所问：和 AI 使用无关（"我喜欢看电影"、"周末去爬山"）
     ❌ 过度抽象："就是用用"、"提高效率"（没有任何具体信息）

【内容相关性筛选规则】
对每个字段，先判断"是否与本测评相关"：
- role 应该是职业、身份或学习方向（不是种族、年龄、性别等）
- recentUse 应该是 AI 使用相关的描述（不是日常生活、爱好等）

如果发现答非所问或不相关：
- 直接判定为 low
- 不要试图从中提取信息
- 走 fallback 策略

【生成策略】
根据信息质量调整题目生成策略：

情况 A：role=high + recentUse=high
- 通用题（4 题）：标准通用题，不使用用户信息
- 半具体题（4 题）：从 role 和 recentUse 提取任务类型，生成贴近用户的题目

情况 B：role=high + recentUse=low
- 通用题（4 题）：标准通用题
- 半具体题（4 题）：只从 role 推断常见任务类型，忽略 recentUse

情况 C：role=low + recentUse=high
- 通用题（4 题）：标准通用题
- 半具体题（4 题）：从 recentUse 提取任务类型，忽略 role

情况 D：role=low + recentUse=low
- 通用题（4 题）：标准通用题
- 半具体题（4 题）：使用通用任务类型（做事、学习、解决问题、创作）

【任务类型词表参考】
如果用户信息质量低，可以使用这些通用任务类型：
- 做事：完成任务、解决问题、做决策
- 学习：学习新知识、理解概念、查资料
- 创作：写内容、做设计、整理想法
- 分析：分析数据、梳理逻辑、找问题

如果用户信息质量高，从以下领域提取任务类型：
- 技术开发：写代码、调试问题、优化性能、学习技术、做架构
- 产品设计：写文档、做分析、规划功能、用户研究、开会讨论
- 研究学术：读文献、写论文、做实验、整理数据、准备答辩
- 内容创作：写文章、做设计、策划内容、编辑修改、找灵感
- 商业运营：做决策、分析数据、写方案、沟通协调、解决问题
- 日常效率：整理信息、翻译内容、总结要点、规划安排、学习新东西

【示例】

示例 1：双高质量
用户输入：role="前端工程师", recentUse="用 Claude 写 React 组件，让它优化性能"
→ 情况 A
→ 提取任务类型：写代码、开发功能、优化性能、做组件设计

示例 2：答非所问
用户输入：role="黑人", recentUse="我喜欢看电影"
→ 都是 low（与 AI 测评无关）
→ 情况 D
→ 半具体题使用通用任务类型：做事、学习、解决问题、创作

示例 3：role 低 recentUse 高
用户输入：role="asdf", recentUse="用 ChatGPT 写邮件和翻译"
→ role=low, recentUse=high
→ 情况 C
→ 提取任务类型：写邮件、翻译、整理文字
</user_context>
```

#### 7. 输出要求

```xml
<output_requirements>
必须调用 generate_questionnaire_batch 工具，输出两个核心字段：

1. analysis: 信息质量判断
   - roleQuality: "high" | "low"
   - recentUseQuality: "high" | "low"
   - extractedTaskTypes: 4 个任务类型（用于半具体题）
   - reasoning: 简短说明（≤80字）

2. nextQuestions: 8 道题
   每题包含：
   {
     dimension: "Relation" | "Workflow" | "Epistemic" | "RepairScope",
     question: string,  // 题干，≤50字（建议 ≤30字）
     scenario: string   // "通用" 或任务类型（≤10字）
   }

【题目分布要求】
- Relation: 1 通用 + 1 半具体
- Workflow: 1 通用 + 1 半具体
- Epistemic: 1 通用 + 1 半具体
- RepairScope: 1 通用 + 1 半具体

【其他字段说明】
- 不需要输出 reverse（服务端自动补 false）
- 不需要输出 userFacingMessage（前端用本地固定文案）
- 不需要输出 targetContext（服务端已有）
- 不需要输出 batchMode（已通过参数指定）
</output_requirements>
```

#### 8. 完整示例

```xml
<example>
假设用户输入：
- role: "前端工程师"
- tools: ["Claude", "Cursor"]
- recentUse: "我最近用 Claude 帮我写 React 组件，经常需要它帮我优化性能和处理边界情况"

生成的 8 题应该是：

【Relation 维度】
1. 通用题
   dimension: "Relation"
   scenario: "通用"
   question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具"
   reverse: false

2. 半具体题
   dimension: "Relation"
   scenario: "写代码"
   question: "写代码时，我期待 AI 主动指出我可能忽略的问题"
   reverse: false

【Workflow 维度】
3. 通用题
   dimension: "Workflow"
   scenario: "通用"
   question: "用 AI 时，我习惯先明确目标，再开始对话"
   reverse: false

4. 半具体题
   dimension: "Workflow"
   scenario: "开发功能"
   question: "开发功能时，我倾向于先定好整体方案，再让 AI 帮我实现"
   reverse: false

【Epistemic 维度】
5. 通用题
   dimension: "Epistemic"
   scenario: "通用"
   question: "AI 给出答案后，我通常会先验证再使用"
   reverse: false

6. 半具体题
   dimension: "Epistemic"
   scenario: "优化性能"
   question: "优化性能时，我会先测试 AI 建议的效果，再决定是否采用"
   reverse: false

【RepairScope 维度】
7. 通用题
   dimension: "RepairScope"
   scenario: "通用"
   question: "AI 出错时，我更愿意重新描述问题，而不是只改局部"
   reverse: false

8. 半具体题
   dimension: "RepairScope"
   scenario: "调试问题"
   question: "调试问题时，AI 给的方案不对，我倾向于换个角度重新问"
   reverse: false

注意：
- 半具体题的 scenario 是任务类型（写代码、开发功能、优化性能、调试问题）
- 不是具体项目（"写 React 组件"、"处理边界情况"）
- 题干自然、简短、易懂
- 没有连续相同句式
</example>
```

---

### 完整 Prompt 模板

```typescript
function buildBatch1Prompt(sessionState: SessionState): string {
  const { role, tools, recentUse } = sessionState.background;
  
  return `<task>
你现在要生成 AI-MBTI 第一轮问卷（8 题）。

目标：快速采样用户在四个维度的初步倾向。
特点：通用易答，题干简短（≤25字），为第二轮提供方向。

必须调用 generate_questionnaire_batch 工具，把题目写入 nextQuestions。
</task>

<questionnaire_contract>
batchMode: hybrid_batch1
总题数：8 题
维度分布：Relation / Workflow / Epistemic / RepairScope 各 2 题
题目类型分布：
  - 通用题：4 题（每个维度 1 题）
  - 半具体题：4 题（每个维度 1 题）
正反向分布：每个维度 1 题 reverse=false + 1 题 reverse=true（共 4 正向 + 4 反向）
计分方式：用户选择 0-5 分，跳过按 2.5 分计算
</questionnaire_contract>

<dimensions>
四个维度及其倾向（正向题认同度高 → 右侧倾向；反向题认同度高 → 左侧倾向）：

1. Relation（人机关系）
   0 分 ← Instrumental（工具型）：把 AI 当执行工具
   5 分 → Collaborative（伙伴型）：把 AI 当讨论伙伴

2. Workflow（工作流程）
   0 分 ← Exploratory（探索型）：边做边探索，灵活调整
   5 分 → Framed（框架型）：先定框架，再执行

3. Epistemic（认知信任）
   0 分 ← Trusting（信任型）：倾向于直接使用 AI 输出
   5 分 → Auditing（审查型）：倾向于验证后再使用

4. RepairScope（修正范围）
   0 分 ← Local（局部修正）：AI 出错时只改局部
   5 分 → Global（全局重构）：AI 出错时重新描述问题
</dimensions>

<question_types>
第一轮包含两种题目类型：

【通用题】（4 题，每维度 1 题）
定义：任何人都能理解和回答，不依赖职业、工具或具体场景
特点：
- 描述普遍的 AI 使用倾向
- 不提及具体职业、工具名、任务类型
- 像在问"你通常怎么用 AI"
- scenario 字段写 "通用"

示例：
✅ "我倾向于把 AI 当成讨论伙伴，而不只是执行工具"
✅ "用 AI 时，我习惯先明确目标，再开始对话"
✅ "AI 给出答案后，我通常会先验证再使用"
✅ "AI 出错时，我更愿意重新描述问题，而不是只改局部"

【半具体题】（4 题，每维度 1 题）
定义：结合用户的职业领域或常见任务，但不过度具体
特点：
- 可以提及任务类型（写文档、调试代码、做分析）
- 不要提及用户的具体项目或细节场景
- 让用户能代入，但不局限于一个场景
- scenario 字段写任务类型（≤10字）

【如何从用户输入生成半具体题】
1. 读取用户的 role 和 recentUse
2. 提取用户可能做的任务类型（不是具体项目）
3. 用这些任务类型作为半具体题的场景
</question_types>

<question_quality>
所有题目必须满足：

1. 语法正确：无病句、无机器翻译腔
2. 长度适中：题干 ≤50 字，scenario ≤10 字
3. 自然表达：像用户自己会说的话
4. 避免模板化：禁止连续 3 题使用相同句式
5. 倾向清晰：reverse=false 时认同度高 = 5 分 = 右侧倾向；reverse=true 时认同度高 = 5 分 = 左侧倾向

正反例：
❌ "当我在使用 AI 进行代码编写的过程中，我倾向于先进行整体架构的规划"
✅ "写代码时，我习惯先想好整体结构，再开始写"
</question_quality>

<user_context>
用户职业/身份：${role}
常用 AI 工具：${tools.join('、')}
具体 AI 使用经历：
${recentUse}

【生成策略】
通用题（4 题）：不使用上述用户信息，写任何人都能回答的题目
半具体题（4 题）：从 role 和 recentUse 提取任务类型，不要直接复述具体细节
</user_context>

<output_requirements>
必须调用 generate_questionnaire_batch 工具：
- batchMode: "hybrid_batch1"
- nextQuestions: 8 题，维度分布 Relation/Workflow/Epistemic/RepairScope 各 2 题
- 每个维度：1 通用题（scenario="通用"）+ 1 半具体题（scenario=任务类型）
- 每个维度 1 题 reverse=false + 1 题 reverse=true
- userFacingMessage: ≤50 字，不解释维度和计分
</output_requirements>`;
}
```

---

---

### 模型调用与返回格式

#### 0. 为什么使用工具调用而不是普通文本回复

**普通文本回复的问题：**
- 模型返回纯文本，需要用正则或分隔符解析
- 模型可能改变格式（"1." vs "①" vs "题目1："）
- 容易出现意外输出（"以下是 8 道题：" 等多余内容）
- 维度名容易写错（写成中文"关系"而不是"Relation"）
- 无法保证字段完整性

**工具调用的优势：**
- **强制结构化输出**：模型必须按 JSON Schema 输出，否则 API 会报错
- **类型安全**：可以直接 TypeScript 解析，无需手写解析器
- **枚举约束**：dimension 只能是 4 个固定值之一
- **数量约束**：minItems/maxItems 强制 8 题
- **必填字段**：required 字段缺失会被模型 API 拒绝

**结论：本场景必须用工具调用**
- 我们需要严格的题目结构（dimension、question、scenario）
- 任何字段错误都会导致问卷无法展示或计分错误
- 工具调用让模型直接产出可用的数据结构，不需要解析层

---


**API 端点：** `/api/questionnaire/generate`

**调用参数：**
```typescript
POST /api/questionnaire/generate
Headers: {
  "Content-Type": "application/json"
}
Body: {
  sessionState: SessionState,
  batchMode: "hybrid_batch1",
  existingQuestions: [],  // 第一轮无已有题目
  scenarioGuidance: undefined  // 第一轮无场景指导
}
```

**模型配置：**
```typescript
{
  model: "qwen-plus",  // 或当前配置的主模型
  temperature: 0.7,     // 保持一定创造性
  max_tokens: 4096,     // 足够生成 8 题 + 分析
  tools: [GENERATE_QUESTIONNAIRE_BATCH_TOOL],  // 强制工具调用
  tool_choice: {
    type: "tool",
    name: "generate_questionnaire_batch"
  }
}
```

**System Prompt：**
```typescript
const systemPrompt = buildResearcherSystemPrompt(sessionState);
// 包含 AI-MBTI 的基础定义和工具使用说明
```

**User Prompt：**
```typescript
const userPrompt = buildBatch1Prompt(sessionState);
// 就是上面设计的完整 prompt
```

#### 2. 工具定义（Tool Schema）

**新版简化 Schema（移除遗留字段）：**

```typescript
const GENERATE_QUESTIONNAIRE_BATCH_TOOL = {
  name: "generate_questionnaire_batch",
  description: "生成 AI-MBTI 问卷批次。第一轮 8 题，每维度 1 通用 + 1 半具体，全部正向题。",
  input_schema: {
    type: "object",
    properties: {
      analysis: {
        type: "object",
        description: "用户信息分析与生成策略",
        properties: {
          roleQuality: { 
            type: "string", 
            enum: ["high", "low"],
            description: "role 是否为有效职业/身份。无意义、答非所问、与AI测评无关都判为 low"
          },
          recentUseQuality: { 
            type: "string", 
            enum: ["high", "low"],
            description: "recentUse 是否为有效的 AI 使用描述。无关内容、过度抽象都判为 low"
          },
          extractedTaskTypes: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
            description: "用于半具体题的 4 个任务类型。质量低时使用通用类型（做事、学习、解决问题、创作）"
          },
          reasoning: { 
            type: "string",
            description: "简短说明：信息质量判断 + 任务类型选择依据，≤80字"
          }
        },
        required: ["roleQuality", "recentUseQuality", "extractedTaskTypes", "reasoning"]
      },
      nextQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dimension: { 
              type: "string", 
              enum: ["Relation", "Workflow", "Epistemic", "RepairScope"] 
            },
            question: { 
              type: "string",
              description: "题干，第一人称陈述句，≤50字（建议 ≤30字）"
            },
            scenario: { 
              type: "string",
              description: "通用题写'通用'，半具体题写任务类型（≤10字）"
            }
          },
          required: ["dimension", "question", "scenario"]
        },
        minItems: 8,
        maxItems: 8
      }
    },
    required: ["analysis", "nextQuestions"],
    additionalProperties: false
  }
};
```

**Schema 设计的简化说明：**

移除的字段（遗留设计）：
- ❌ `targetContext`：服务端已经有，不需要模型重复输出
- ❌ `batchMode`：服务端在调用时已经传入，不需要模型回填
- ❌ `userFacingMessage`：前端可以用本地固定文案（如"问卷已准备好"），不需要模型生成
- ❌ `reverse`：第一轮全部正向题，固定值，不需要模型输出
- ❌ `existingQuestions`：第一轮无已有题目
- ❌ `newEvidence`：信息收集页已经收集，不需要模型再提取

保留的核心字段：
- ✅ `analysis`：信息质量判断 + 任务类型提取（debug 和审计用）
- ✅ `nextQuestions`：题目数组（核心输出）

每题保留的字段：
- ✅ `dimension`：维度（必需，用于计分）
- ✅ `question`：题干（必需，用户看到的内容）
- ✅ `scenario`：场景标签（必需，区分通用/半具体）

#### 3. 模型返回格式

**成功响应（模型调用工具）：**
```typescript
{
  tool_uses: [
    {
      name: "generate_questionnaire_batch",
      input: {
        analysis: {
          roleQuality: "high",
          recentUseQuality: "high",
          extractedTaskTypes: ["写代码", "开发功能", "优化性能", "调试问题"],
          reasoning: "用户是前端工程师，提到写 React 组件和优化性能，信息质量高"
        },
        nextQuestions: [
          {
            dimension: "Relation",
            question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具",
            scenario: "通用"
          },
          {
            dimension: "Relation",
            question: "写代码时，我期待 AI 主动指出我可能忽略的问题",
            scenario: "写代码"
          },
          {
            dimension: "Workflow",
            question: "用 AI 时，我习惯先明确目标，再开始对话",
            scenario: "通用"
          },
          {
            dimension: "Workflow",
            question: "开发功能时，我倾向于先定好方案，再让 AI 帮我实现",
            scenario: "开发功能"
          },
          {
            dimension: "Epistemic",
            question: "AI 给出答案后，我通常会先验证再使用",
            scenario: "通用"
          },
          {
            dimension: "Epistemic",
            question: "优化性能时，我会先测试 AI 建议的效果，再决定采用",
            scenario: "优化性能"
          },
          {
            dimension: "RepairScope",
            question: "AI 出错时，我更愿意重新描述问题，而不是只改局部",
            scenario: "通用"
          },
          {
            dimension: "RepairScope",
            question: "调试问题时，AI 给的方案不对，我会换个角度重新问",
            scenario: "调试问题"
          }
        ]
      }
    }
  ]
}
```

**服务端处理：**
```typescript
// 1. 提取工具调用结果
const toolUse = response.tool_uses[0];
const { analysis, nextQuestions } = toolUse.input;

// 2. 服务端补全题目结构（reverse 字段、scenario 标准化等）
const enrichedQuestions = nextQuestions.map(q => ({
  ...q,
  reverse: false  // 第一轮固定 false
}));

// 3. 验证题目（容错验证）
const validationResult = validateQuestionnaireBatch(enrichedQuestions, "hybrid_batch1");
if (!validationResult.valid && validationResult.severity === "fatal") {
  // 严重错误（题数错误、维度分布错误）→ 重试或 fallback
  throw new Error(validationResult.issues.join('; '));
}
// 轻微错误（个别题目质量问题）→ 警告但继续

// 4. 更新 SessionState
sessionState.questionnaireBatches.batch1 = enrichedQuestions;
sessionState.phase = "questionnaire_batch1";

// 5. 返回给前端（前端用本地固定文案展示）
return {
  questions: enrichedQuestions,
  sessionState: sessionState,
  source: "model",
  model: "qwen-plus",
  thinkDurationSec: elapsedSeconds,
  warnings: validationResult.warnings,
  debug: {
    analysis: analysis  // 包含质量判断和任务类型，用于 debug
  }
};
```

#### 4. 题目验证规则（带容错）

**验证分级：**
- **fatal**（致命）：必须重试或走 fallback，包括题数错误、维度分布错误
- **warning**（警告）：允许通过，但记录日志（最多容忍 1 题质量问题）

```typescript
type ValidationSeverity = "fatal" | "warning" | "ok";

interface ValidationResult {
  valid: boolean;
  severity: ValidationSeverity;
  issues: string[];      // 致命错误
  warnings: string[];    // 轻微问题
}

function validateQuestionnaireBatch(
  questions: QuestionnaireQuestion[], 
  batchMode: "hybrid_batch1"
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // ===== Fatal 检查（结构性，必须重试） =====
  
  // 1. 题目数量
  if (questions.length !== 8) {
    issues.push(`题目数量错误：期望 8 题，实际 ${questions.length} 题`);
  }
  
  // 2. 维度分布
  const dimensionCounts: Record<string, number> = {
    Relation: 0, Workflow: 0, Epistemic: 0, RepairScope: 0
  };
  questions.forEach(q => {
    if (dimensionCounts[q.dimension] !== undefined) {
      dimensionCounts[q.dimension]++;
    }
  });
  
  for (const [dim, count] of Object.entries(dimensionCounts)) {
    if (count !== 2) {
      issues.push(`${dim} 维度题目数量错误：期望 2 题，实际 ${count} 题`);
    }
  }
  
  // 3. 通用题/半具体题分布
  const universalCount = questions.filter(q => q.scenario === "通用").length;
  const semiSpecificCount = questions.filter(q => q.scenario !== "通用").length;
  
  if (universalCount !== 4) {
    issues.push(`通用题数量错误：期望 4 题，实际 ${universalCount} 题`);
  }
  
  // 4. 每个维度必须 1 通用 + 1 半具体
  for (const dim of ["Relation", "Workflow", "Epistemic", "RepairScope"]) {
    const dimQuestions = questions.filter(q => q.dimension === dim);
    const dimUniversal = dimQuestions.filter(q => q.scenario === "通用").length;
    if (dimUniversal !== 1) {
      issues.push(`${dim} 维度通用题数量错误：期望 1 题，实际 ${dimUniversal} 题`);
    }
  }
  
  // ===== Warning 检查（质量问题，允许容忍） =====
  
  let qualityIssueCount = 0;
  
  questions.forEach((q, i) => {
    // 题干长度
    if (q.question.length > 50) {
      warnings.push(`第 ${i+1} 题题干过长：${q.question.length} 字`);
      qualityIssueCount++;
    }
    
    // scenario 长度
    if (q.scenario.length > 10) {
      warnings.push(`第 ${i+1} 题 scenario 过长：${q.scenario.length} 字`);
      qualityIssueCount++;
    }
    
    // 题干非空
    if (!q.question || q.question.trim().length === 0) {
      warnings.push(`第 ${i+1} 题题干为空`);
      qualityIssueCount++;
    }
    
    // 机器翻译腔检测
    const machineTranslationPatterns = [
      /进行.+的操作/,
      /实现.+的目标/,
      /在.+的场景下/,
      /在.+的过程中/
    ];
    if (machineTranslationPatterns.some(p => p.test(q.question))) {
      warnings.push(`第 ${i+1} 题疑似机器翻译腔：${q.question}`);
      qualityIssueCount++;
    }
  });
  
  // ===== 容错策略 =====
  // 容忍最多 1 题质量问题；超过则降级为 fatal
  
  const FATAL_QUALITY_THRESHOLD = 2;
  
  if (issues.length > 0) {
    return {
      valid: false,
      severity: "fatal",
      issues,
      warnings
    };
  }
  
  if (qualityIssueCount >= FATAL_QUALITY_THRESHOLD) {
    return {
      valid: false,
      severity: "fatal",
      issues: [`质量问题过多：${qualityIssueCount} 题（阈值 ${FATAL_QUALITY_THRESHOLD}）`],
      warnings
    };
  }
  
  if (warnings.length > 0) {
    return {
      valid: true,  // 允许通过
      severity: "warning",
      issues: [],
      warnings
    };
  }
  
  return {
    valid: true,
    severity: "ok",
    issues: [],
    warnings: []
  };
}
```

**容错说明：**
- 8 题中允许有 1 题轻微质量问题（题干稍长、轻微句式问题）
- 2 题及以上质量问题 → 降级为 fatal，触发重试
- 结构性错误（题数、维度）永远是 fatal，必须重试

**⚠️ 后续优化（见步骤 5 第 12 节）：**
2026-05-05 决定改用"局部 fallback"策略：
- 不再触发整批重试
- 只要模型返回了合法 JSON，单题不合格就用 fallback 替换那一题
- 保留模型生成的好题，只换坏题
- 节省 10+ 秒重试延迟
- 第一轮和第二轮都使用同样的策略

#### 5. Fallback 策略

如果模型生成失败或验证不通过（重试 3 次后仍失败）：

```typescript
function getFallbackBatch1(): QuestionnaireQuestion[] {
  return [
    // Relation 维度
    {
      dimension: "Relation",
      question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具",
      scenario: "通用",
      reverse: false
    },
    {
      dimension: "Relation",
      question: "做事时，我期待 AI 主动提供补充建议",
      scenario: "做事",
      reverse: false
    },
    // Workflow 维度
    {
      dimension: "Workflow",
      question: "用 AI 时，我习惯先明确目标，再开始对话",
      scenario: "通用",
      reverse: false
    },
    {
      dimension: "Workflow",
      question: "解决问题时，我倾向于先定好方案，再让 AI 帮我实现",
      scenario: "解决问题",
      reverse: false
    },
    // Epistemic 维度
    {
      dimension: "Epistemic",
      question: "AI 给出答案后，我通常会先验证再使用",
      scenario: "通用",
      reverse: false
    },
    {
      dimension: "Epistemic",
      question: "学习新东西时，我会先测试 AI 说的是否正确",
      scenario: "学习",
      reverse: false
    },
    // RepairScope 维度
    {
      dimension: "RepairScope",
      question: "AI 出错时，我更愿意重新描述问题，而不是只改局部",
      scenario: "通用",
      reverse: false
    },
    {
      dimension: "RepairScope",
      question: "做事时，AI 给的方案不对，我倾向于换个角度重新问",
      scenario: "做事",
      reverse: false
    }
  ];
}
```

---

## 步骤 3：第一轮问卷作答页

### 设计决策（2026-05-05）

**UI 设计：直接复用现有 `QuestionnaireCard.tsx`**

当前 `src/components/QuestionnaireCard.tsx` 的设计已经完善，包括：
- 单题模式（一次展示 1 题）
- 圆形按钮评分组
- 进度条 + 题目计数
- 跳过按钮（"不了解 / 没想好"）
- 上一题/下一题导航
- 炫酷的入场动画（旋转 + 缩放）
- 选中后的波纹扩散动画

**最终方案：UI 迁移 + 接口对接**

只做最小改动，不重新设计 UI。

### 必要改动清单

#### 1. 分数方案调整（按新设计）

**当前：1-6 分制**
```typescript
{[1, 2, 3, 4, 5, 6].map((score) => ...)}
```

**新设计：0-5 分制**
```typescript
{[0, 1, 2, 3, 4, 5].map((score) => ...)}
```

**标签保持不变：**
```typescript
const SCALE_LABELS = ["肯定不会", "一般不会", "偶尔会", "经常会", "通常会", "肯定会"];
```

**对应关系：**
- 0 = 肯定不会
- 1 = 一般不会
- 2 = 偶尔会
- 3 = 经常会
- 4 = 通常会
- 5 = 肯定会

**跳过题计分：**
- score: null → 计分时按 2.5 分计算（在 `reportScoring.ts` 处理）

#### 2. 数据接口对接

**输入（从 sessionStorage 读取）：**
```typescript
sessionState.questionnaireBatches.batch1: QuestionnaireQuestion[8]
```

**输出（写入 sessionStorage）：**
```typescript
sessionState.batchAnswers.batch1: QuestionnaireAnswer[8]
```

**完成后跳转：** `/mid-feedback`（中途反馈页）

#### 3. 数据流

```
读取 sessionState.questionnaireBatches.batch1
  ↓
逐题渲染 QuestionnaireCard
  ↓
每题答完保存到 sessionState.batchAnswers.batch1
  ↓
8 题完成 → 跳转到中途反馈页
```

### 不做的事

- 不改 UI 布局
- 不改动画效果
- 不改 6 档语义标签
- 不增加键盘快捷键（暂缓）
- 不增加答题时间记录（暂缓）
- 不增加进度恢复逻辑（暂缓，sessionStorage 自带）

---


## 步骤 4：中途反馈页

### 设计决策（2026-05-05）

#### 1. 核心目标

- **替代当前聊天式 `mid_dialog1`**，改为显式表单
- 用最低的认知负担，收集对第二轮问卷有价值的信息
- 本地结构化为 `ScenarioGuidance`，**不调用模型**
- 用户可以快速跳过（如果没想说的，不强制填写）

#### 2. 页面定位

**用户从第一轮 8 题答完后到达此页：**
- 用户已经答了 3-5 分钟的题
- 用户可能：感到题目贴切 / 一般 / 不贴切
- 用户可能想：让第二轮聚焦某个具体场景 / 没什么意见

**关键原则：**
- 不要让用户写小作文
- 不要让用户感到"又一关"
- 把这一页定位为"快速校准"，不是"深度访谈"

#### 3. 表单字段设计

**收集 3 个字段：**

| 字段 | UI 形式 | 必填 | 说明 |
|------|---------|------|------|
| 第一轮整体感受 | 单选（3 选项） | 必填 | 题目和你的真实情况贴近吗？ |
| 题目问题反馈 | 多行文本框（可选） | 可选 | 哪些题目不清楚或不太贴近？ |
| 第二轮希望聚焦的场景 | 多行文本框（可选） | 可选 | 第二轮你想多看到哪类场景？ |

**字段详细设计：**

##### 字段 1：第一轮整体感受（必填）

**问题文案：** "刚才的题目和你的真实情况贴近吗？"

**单选选项：**
- 🎯 **挺贴近的** - 大部分题目说的就是我
- 🤔 **一般** - 有的贴近有的不太贴近
- 🌀 **不太贴近** - 我的实际场景和这些不太一样

**映射到 ScenarioGuidance.status：**
- 挺贴近的 → `"confirmed"`
- 一般 → `"refined"`
- 不太贴近 → `"abstract_scenarios"` 或 `"needs_more_context"`

##### 字段 2：题目问题反馈（可选）

**问题文案：** "有哪些题目让你觉得不清楚或不太贴近？（可选）"

**Placeholder：** "比如：第 3 题的场景我没遇到过 / 第 5 题问得太抽象了"

**输入：** 多行文本框（2-3 行）

**映射到 ScenarioGuidance：**
- 原文存入 `userCorrectionQuote`
- 通过本地规则提取关键词到 `avoidTopics`

##### 字段 3：第二轮希望聚焦的场景（可选）

**问题文案：** "第二轮你希望多看到哪类场景的题目？（可选）"

**Placeholder：** "比如：写需求文档、调试代码、做数据分析、和客户沟通..."

**输入：** 多行文本框（2-3 行）

**映射到 ScenarioGuidance：**
- 原文存入 `scenarioSummary`
- 通过本地规则提取关键词到 `includeTopics`

#### 4. UI 设计

**风格：** 与 intake 页一致（深色渐变 + 卡片式 + 毛玻璃）

**布局：**

```
┌─────────────────────────────────────┐
│  进度：信息收集 → 第一轮 → 中途反馈 │
│       ✓        ✓       ●           │
├─────────────────────────────────────┤
│                                     │
│  快速校准一下                       │
│  你的反馈会让第二轮题目更贴近你     │
│                                     │
│  ─────────────────────────          │
│                                     │
│  刚才的题目和你的真实情况贴近吗？   │
│  ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │挺贴近的 │ │ 一般     │ │不太贴近││
│  │  🎯     │ │  🤔      │ │  🌀    ││
│  └─────────┘ └─────────┘ └────────┘│
│                                     │
│  有哪些题目让你觉得不清楚？（可选） │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  第二轮希望多看到哪类场景？（可选） │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [跳过反馈]      [继续第二轮 →]    │
│                                     │
└─────────────────────────────────────┘
```

**交互细节：**
- 单选卡片：选中后渐变高亮 + 发光效果
- 文本框：focus 时边框渐变色
- "跳过反馈" 按钮：低对比度，作为可选项
- "继续第二轮" 按钮：必填项满足后才高亮可点击

#### 5. 本地结构化逻辑

**核心函数：**

```typescript
function buildScenarioGuidanceFromForm(
  form: MidFeedbackForm
): ScenarioGuidance {
  const status = mapFeelingToStatus(form.overallFeeling);
  const granularity = inferGranularity(form);
  const avoidTopics = extractKeywords(form.issueText, "avoid");
  const includeTopics = extractKeywords(form.focusScenario, "include");
  
  return {
    status,
    scenarioSummary: form.focusScenario.trim() || "（用户未指定）",
    granularity,
    avoidTopics,
    includeTopics,
    userCorrectionQuote: form.issueText.trim() || undefined,
  };
}
```

**子函数 1：感受映射状态**

```typescript
function mapFeelingToStatus(
  feeling: "close" | "neutral" | "far"
): MidDialogueStatus {
  switch (feeling) {
    case "close":   return "confirmed";        // 题目贴近，沿用方向
    case "neutral": return "refined";          // 一般，需要微调
    case "far":     return "abstract_scenarios"; // 不贴近，需要换方向
  }
}
```

**子函数 2：推断粒度**

```typescript
function inferGranularity(
  form: MidFeedbackForm
): "specific" | "balanced" | "abstract" {
  // 用户提供了具体场景 → specific
  if (form.focusScenario.trim().length >= 10) return "specific";
  // 用户说"不太贴近" + 没填场景 → abstract（生成更通用的题）
  if (form.overallFeeling === "far" && !form.focusScenario.trim()) {
    return "abstract";
  }
  return "balanced";
}
```

**子函数 3：关键词提取（简单实现）**

```typescript
function extractKeywords(
  text: string, 
  type: "avoid" | "include"
): string[] {
  if (!text.trim()) return [];
  
  // 简单实现：按标点和空格切分，过滤太短的词
  const segments = text
    .split(/[，。、,.\s\n;；]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 20);
  
  // 去重，最多保留前 5 个
  return Array.from(new Set(segments)).slice(0, 5);
}
```

**注意：本地关键词提取是简单实现，不追求完美。**
- 模型在生成第二轮问卷时，会同时看到 `userCorrectionQuote` 和 `scenarioSummary` 原文
- 关键词只是辅助，原文才是核心证据

#### 6. 数据流

**输入（从 sessionStorage 读取）：**
```typescript
sessionState.batchAnswers.batch1: QuestionnaireAnswer[8]  // 第一轮答案
sessionState.background: { role, recentUse, tools, goal }
```

**用户在表单填写：**
```typescript
interface MidFeedbackForm {
  overallFeeling: "close" | "neutral" | "far";  // 必填
  issueText: string;                             // 可选
  focusScenario: string;                         // 可选
}
```

**输出（写入 sessionStorage）：**
```typescript
sessionState.scenarioGuidance: ScenarioGuidance
sessionState.refinedTargetContext: TargetContext  // 基于 focusScenario 微调
sessionState.phase: "questionnaire_batch2"
```

**完成后跳转：** 第二轮问卷生成页

#### 7. "跳过反馈"的处理

如果用户点击 "跳过反馈"：

```typescript
const defaultGuidance: ScenarioGuidance = {
  status: "confirmed",       // 默认沿用第一轮方向
  scenarioSummary: sessionState.background.recentUse,
  granularity: "balanced",
  avoidTopics: [],
  includeTopics: [],
  userCorrectionQuote: undefined,
};
```

这样即使用户跳过，第二轮也能正常生成（基于第一轮的 recentUse）。

#### 8. 跳过率分析（轻提示）

如果用户在第一轮跳过题数 ≥3 道，在中途反馈页头部显示一个轻提示：

```
"你跳过了 3 道题，可以告诉我们哪些题不清楚吗？"
```

但不强制填写，让用户自主选择。

#### 9. 待实现模块

按 `docs/process-update.md` 5.3 节的建议：

| 文件 | 责任 |
|------|------|
| `src/app/mid-feedback/page.tsx` | 中途反馈页组件 |
| `src/lib/midFeedbackState.ts` | 本地规则将表单转为 ScenarioGuidance |

#### 10. 不做的事

- 不调用 Qwen 做反馈解析
- 不做复杂的语义关键词提取（用简单切分即可）
- 不要求用户填写所有字段（只 1 个必填）
- 不展示第一轮分数（避免影响第二轮答题）
- 不展示已答题目（不让用户回头修改）


---

### 步骤 4 补充设计：题目回顾功能

#### 11. 用户痛点与解决思路

**痛点：**
用户答完 8 题后想吐槽某道题，但记不清是第几题、题干说了什么，只能模糊反馈"有道题不好"，导致：
- 反馈失去具体性
- 第二轮模型无法精准避开类似问题
- 跳过的题忘了是哪些

**解决方案：题目快速回顾 + 题号引用**

#### 12. 题目回顾 UI 设计

**位置：** 在 "题目问题反馈" 文本框上方

**两个组件：**

##### A. 可展开的题目列表（默认折叠）

```
▼ 查看刚才的 8 道题
┌─────────────────────────────────────────┐
│  1. 我倾向于把 AI 当成讨论伙伴，         │
│     而不只是执行工具                     │
│     你的回答：4分（通常会）              │
│  ─────────────────────────              │
│  2. 写代码时，我期待 AI 主动指出         │
│     我可能忽略的问题                     │
│     你的回答：5分（肯定会）              │
│  ─────────────────────────              │
│  3. 用 AI 时，我习惯先明确目标，         │
│     再开始对话                           │
│     你的回答：⊘ 已跳过                   │
│  ─────────────────────────              │
│  ...                                     │
└─────────────────────────────────────────┘
```

**展示规则：**
- 显示：题号 + 题干（完整显示，超长自动换行）+ 用户答案
- **不显示场景标签**（保持简洁）
- 用户答案展示形式：
  - 已答：`你的回答：N分（语义标签）`，例如"4分（通常会）"
  - 跳过：`你的回答：⊘ 已跳过`
- **不展示**：各维度累计得分、倾向（避免锚定第二轮）

**完整题干显示设计：**
- 题干可能 ≤50 字，直接全部显示
- 用 `leading-relaxed` 类确保行距舒适
- 题干用稍大字号（14px），用户答案用小字号（12px，灰色）
- 题目之间用细分隔线分隔

**布局示意：**
```html
<div class="question-review-list">
  {questions.map((q, i) => (
    <div class="question-item" key={i}>
      <div class="question-number">{i + 1}.</div>
      <div class="question-content">
        <p class="question-stem">{q.question}</p>
        <p class="user-answer">
          {answers[i].skipped 
            ? "你的回答：⊘ 已跳过" 
            : `你的回答：${answers[i].score}分（${SCALE_LABELS[answers[i].score]}）`
          }
        </p>
      </div>
    </div>
  ))}
</div>
```

##### B. 题号快捷引用按钮

```
有哪些题目让你觉得不清楚？（可选）

引用题号：
[1] [2] [3] [4] [5] [6] [7] [8]

[文本框：第 4 题...]
💡 点击题号可以快速引用
```

**交互规则：**
- 点击题号 → 在文本框光标位置插入"第 X 题"
- 不区分跳过题和已答题（按用户要求）
- 移动端 hover 显示完整题干（tooltip）

#### 13. 自动展开规则

**默认折叠**，但在以下情况自动展开题目列表：

- 用户跳过 ≥3 题：自动展开 + 显示提示"你跳过了 N 道题，看看是哪些？"
- 用户选择"不太贴近"：自动展开（用户大概率会想找具体例子）

#### 14. 数据传递

题目数据从 sessionStorage 读取：

```typescript
// 读取第一轮题目和答案
const batch1Questions = sessionState.questionnaireBatches.batch1;
const batch1Answers = sessionState.batchAnswers.batch1;

// 6 档语义标签（与 QuestionnaireCard 保持一致）
const SCALE_LABELS = ["肯定不会", "一般不会", "偶尔会", "经常会", "通常会", "肯定会"];

// 构建题目回顾数据
const reviewItems = batch1Questions.map((q, index) => {
  const answer = batch1Answers[index];
  return {
    index: index + 1,
    question: q.question,
    skipped: answer?.skipped ?? false,
    score: answer?.score ?? null,
    scoreLabel: answer?.skipped 
      ? null 
      : SCALE_LABELS[answer?.score ?? 0],
    // 注意：不传 dimension（不展示场景标签）
    // 注意：不传维度累计得分（避免锚定第二轮）
  };
});
```

**展示策略说明：**
- 展示单题答案：`4 分（通常会）` ✓
- 展示是否跳过：`⊘ 已跳过` ✓
- **不展示**：场景标签（`[写代码]`、`[通用]`）
- **不展示**：维度累计得分（`Relation 维度：17 分`）
- **不展示**：倾向判断（`偏向 Collaborative`）

#### 15. 反馈文本的处理

如果用户在反馈中提到了题号（如"第 3 题"），可以在本地结构化时：

```typescript
function extractQuestionReferences(
  text: string,
  questions: QuestionnaireQuestion[]
): Array<{ index: number; question: string }> {
  // 匹配 "第 X 题" 模式
  const regex = /第\s*(\d+)\s*题/g;
  const refs: Array<{ index: number; question: string }> = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const index = parseInt(match[1]) - 1;
    if (index >= 0 && index < questions.length) {
      refs.push({
        index: index + 1,
        question: questions[index].question,
      });
    }
  }
  return refs;
}
```

提取出的题目引用可以加入 `ScenarioGuidance.userCorrectionQuote`，让模型生成第二轮时能精准避开：

```typescript
// 在 ScenarioGuidance 中保留更多上下文
const guidance: ScenarioGuidance = {
  ...baseGuidance,
  userCorrectionQuote: text,
  // 可以扩展字段
  questionReferences: extractQuestionReferences(text, batch1Questions),
};
```

#### 16. 视觉细节

- 题目列表卡片：浅色背景（与表单区分），缩进显示
- 题号按钮：圆形小按钮，hover 放大
- 折叠/展开：向下/向上箭头 + 平滑动画
- 单题答案：小字号灰色文字（不抢眼）
- 题目之间：细分隔线分隔（`border-b border-white/5`）
- 题号引用按钮位置：反馈输入框**上方**

**关键视觉原则：**
- 答案展示要"轻"，不要让用户觉得这是分数表
- 不区分跳过题和已答题的按钮样式
- 整体视觉重心在反馈输入框上，题目回顾是辅助参考


---

## 步骤 5：第二轮问卷生成

### 设计决策（2026-05-05）

#### 1. 输入数据

**从前面步骤接收：**

```typescript
{
  sessionState: {
    background: {
      role: string,        // 用户填写的职业
      tools: string[],     // AI 工具
      recentUse: string,   // 具体使用经历
      goal: "提高效率，并获得更多 idea/思路/选择/灵感"
    },
    questionnaireBatches: {
      batch1: QuestionnaireQuestion[8]  // 第一轮题目
    },
    batchAnswers: {
      batch1: QuestionnaireAnswer[8]  // 第一轮答案（含跳过）
    },
    scenarioGuidance: {
      status: "confirmed" | "refined" | "abstract_scenarios",
      scenarioSummary: string,      // 用户希望聚焦的场景原文
      granularity: "specific" | "balanced" | "abstract",
      avoidTopics: string[],         // 关键词
      includeTopics: string[],       // 关键词
      userCorrectionQuote: string    // 用户对题目的吐槽原文（含题号引用）
    },
    refinedTargetContext: TargetContext  // 中途反馈后的目标上下文
  },
  batchMode: "hybrid_batch2"
}
```

**调用接口：**
```typescript
POST /api/questionnaire/generate
Body: {
  sessionState: SessionState,
  batchMode: "hybrid_batch2"
}
```

#### 2. 第二轮 vs 第一轮的区别

| 维度 | 第一轮 | 第二轮 |
|------|--------|--------|
| 目标 | 轻量风格采样 | 深入探测 + 场景适配 |
| 题目类型 | 4 通用 + 4 半具体 | 4 半具体 + 4 具体 |
| 题干长度 | ≤30 字（建议） | ≤50 字 |
| 输入信息 | role + recentUse + tools | 第一轮全部 + 中途反馈 |
| 关键约束 | 每维 1 正 1 反，覆盖四维 | 每维 1 正 1 反，避免重复，回应反馈 |

#### 3. 题目类型在第二轮的定义

**半具体题（4 题）：**
- 与第一轮的半具体题"互补"，不能简单换个说法重复第一轮
- 涵盖第一轮没碰到的角度（不同任务类型、不同情境）
- 例如第一轮半具体题问"写代码时..."，第二轮可以问"做团队协作时..."

**具体题（4 题）：**
- 直接基于用户的 `recentUse` 或 `scenarioSummary` 生成
- 题干带有用户提到的具体细节
- 例如用户提到"写产品需求文档时让 AI 补充边界情况"
  - 题干可以是："写需求时，我会主动让 AI 帮我列出可能遗漏的边界情况"

**比例适配（根据 granularity 微调）：**

| ScenarioGuidance.granularity | 题目分布调整 |
|------|------|
| specific | 保持 4 半具体 + 4 具体 |
| balanced | 保持 4 半具体 + 4 具体 |
| abstract | 5 半具体 + 3 具体（如果用户说题目太具体） |

注意：维度分布永远是 4 维各 2 题，类型比例只在 4 半具体 + 4 具体之间微调。

#### 4. Prompt 设计

##### 4.1 任务说明

```xml
<task>
你现在要生成 AI-MBTI 第二轮问卷（8 题）。

第一轮已经做过轻量采样（通用题 + 半具体题），第二轮的目标是：
1. 基于用户的具体使用场景，生成贴近用户真实工作的题目
2. 回应用户在中途反馈中的吐槽和期望
3. 避免和第一轮题目重复或过于相似

必须调用 generate_questionnaire_batch 工具，把题目写入 nextQuestions。
</task>
```

##### 4.2 第二轮约束

```xml
<batch2_contract>
batchMode: hybrid_batch2
总题数：8 题
维度分布：Relation / Workflow / Epistemic / RepairScope 各 2 题
题目类型分布：
  - 半具体题：4 题（每个维度 1 题）
  - 具体题：4 题（每个维度 1 题）
正反向分布：每个维度 1 题 reverse=false + 1 题 reverse=true
计分方式：用户选择 0-5 分，跳过按 2.5 分计算
</batch2_contract>
```

##### 4.3 第一轮上下文

```xml
<batch1_context>
用户在第一轮已经回答了以下 8 题（每维 1 正向题 + 1 反向题）：

【第一轮题目和答案】
1. [Relation/通用] 我倾向于把 AI 当成讨论伙伴...
   用户答：4分（通常会）
2. [Relation/写代码] 写代码时，我期待 AI 主动...
   用户答：5分（肯定会）
3. [Workflow/通用] 用 AI 时，我习惯先明确目标...
   用户答：3分（经常会）
4. [Workflow/开发功能] 开发功能时，我倾向于先定...
   用户答：⊘ 已跳过
... 共 8 题

【第一轮模糊维度】
基于第一轮答案，以下维度需要在第二轮深入探测：
${dimensionsNeedingExploration}
（接近中位数的维度优先深入）

【避免重复】
不能和第一轮 8 题在以下方面重复：
- 题干不能用相同的开头句式
- 不能换个说法问同一件事
- 同维度的题目必须问不同的角度
</batch1_context>
```

##### 4.4 中途反馈上下文

```xml
<mid_feedback_context>
【用户对第一轮的整体感受】
status: ${scenarioGuidance.status}
- confirmed：题目贴近用户，沿用方向
- refined：用户觉得一般，需要微调
- abstract_scenarios：用户觉得不贴近，需要更通用一些

【用户的题目反馈原文】
"${scenarioGuidance.userCorrectionQuote || '（用户未填写）'}"

【用户希望第二轮聚焦的场景】
"${scenarioGuidance.scenarioSummary || '（用户未填写，沿用 recentUse）'}"

【建议聚焦的话题】
includeTopics: ${scenarioGuidance.includeTopics.join('、') || '（无）'}

【建议避开的话题】
avoidTopics: ${scenarioGuidance.avoidTopics.join('、') || '（无）'}

【题号引用解读】
如果反馈原文中提到了"第 X 题"，请：
1. 找到对应的第一轮题目
2. 理解用户为什么觉得不好（太抽象/太具体/不懂/没经历）
3. 在第二轮避免类似题面
</mid_feedback_context>
```

##### 4.5 题目类型定义（第二轮版）

```xml
<question_types>
第二轮包含两种题目类型：

【半具体题】（4 题，每维度 1 题）
定义：结合用户的职业领域或常见任务，但不过度具体
特点：
- 与第一轮的半具体题"互补"，不能简单换个说法
- 涵盖第一轮没碰到的角度
- 题干 ≤40 字
- scenario 字段写任务类型（≤10字）

示例（假设用户是前端工程师）：
第一轮已问："写代码时..."
第二轮半具体题可以问：
✅ scenario="团队协作"，question="和团队协作时，我倾向于先和 AI 讨论方案，再去同步给同事"
✅ scenario="技术选型"，question="做技术选型时，我会让 AI 帮我列出多个方案的优缺点"
❌ scenario="写代码"，question="写代码时，我期待 AI 检查代码质量"  // 重复第一轮角度

【具体题】（4 题，每维度 1 题）
定义：直接来自用户的 recentUse 或 scenarioSummary，高度个性化
特点：
- 题干带有用户提到的具体细节
- 像在问用户"那次你做 X 的时候，是怎么用 AI 的"
- 题干 ≤50 字
- scenario 字段写具体场景（≤15字）

示例（用户提到"写 React 组件，让 AI 优化性能和处理边界情况"）：
✅ scenario="写 React 组件"，question="写 React 组件时，我会让 AI 主动指出性能瓶颈和边界情况"
✅ scenario="处理边界情况"，question="处理边界情况时，我倾向于先和 AI 讨论可能的边缘案例"
❌ scenario="写代码"，question="写代码时，我倾向于和 AI 讨论"  // 不够具体

【两种题目的核心区别】
- 半具体题：换一个用户也能代入（其他前端工程师能答）
- 具体题：高度匹配本用户场景（带用户提到的细节）

【生成顺序建议】
1. 先生成 4 道具体题（基于 recentUse 和 scenarioSummary）
2. 再生成 4 道半具体题（覆盖第一轮没碰到的角度）
3. 检查每个维度都有 1 半具体 + 1 具体
</question_types>
```

##### 4.6 题面质量标准（第二轮版）

```xml
<question_quality>
所有题目必须满足：

1. 语法正确：无病句、无机器翻译腔
2. 长度适中
   - 半具体题：≤40 字
   - 具体题：≤50 字
   - scenario：≤15 字
3. 自然表达：像用户自己会说的话
4. 避免模板化：禁止连续 3 题使用相同句式
5. 倾向清晰：认同度高 = 5 分 = 右侧倾向
6. **关键：避免和第一轮重复**
   - 不能用第一轮的开头句式（"用 AI 时..."、"AI 给出答案后..."）
   - 不能在同维度问相同的角度
   - 同一任务类型不能反复出现

正反例：

❌ "写代码时，我会让 AI 主动检查问题"
   问题：第一轮已经问过"写代码时，我期待 AI 主动指出我可能忽略的问题"
✅ "团队协作时，我倾向于先和 AI 讨论方案，再去同步给同事"
   优点：换了任务类型（团队协作），换了角度（讨论方案）

❌ "AI 出错时，我更愿意重新描述问题"
   问题：第一轮 RepairScope 通用题已经问过类似的
✅ "调试代码时，AI 给的方案不对，我会换个角度重新描述问题"
   优点：从通用到具体，绑定了用户的"调试代码"场景

【特殊提示】
如果用户在反馈中说"题目太抽象"：
- 第二轮多写具体题，少写半具体题
- 题干带具体细节（用户提到的工具、任务、场景）

如果用户在反馈中说"题目太具体"：
- 第二轮多写半具体题，少写具体题
- 题干用任务类型，不用具体细节
</question_quality>
```

##### 4.7 用户上下文（基于中途反馈）

```xml
<user_context>
【信息收集页输入】
用户职业：${role}
常用 AI 工具：${tools.join('、')}
具体 AI 使用经历：
${recentUse}

【中途反馈后的精炼场景】
${scenarioGuidance.scenarioSummary || recentUse}

【生成策略】
具体题（4 题）：
- 优先使用 scenarioSummary（中途反馈中用户希望聚焦的场景）
- 如果 scenarioSummary 为空，使用 recentUse
- 题干必须带有用户提到的具体细节

半具体题（4 题）：
- 涵盖 role 相关的、第一轮没碰到的任务类型
- 不要重复第一轮的任务类型
</user_context>
```

##### 4.8 输出要求

```xml
<output_requirements>
必须调用 generate_questionnaire_batch 工具：

1. analysis: 第二轮生成分析
   - batch1Coverage: 第一轮覆盖了哪些任务类型（4 个）
   - dimensionsNeedingExploration: 哪些维度需要深入探测（基于第一轮答案接近中位数的维度）
   - reasoning: 简短说明（≤100字）

2. nextQuestions: **必须恰好 8 道题**
   每题包含：
   {
     dimension: "Relation" | "Workflow" | "Epistemic" | "RepairScope",
     question: string,    // 题干
     scenario: string,    // 任务类型 / 具体场景
     questionType: "semi_specific" | "specific"  // 类型标记
   }

【题目分布要求】
- Relation: 1 半具体 + 1 具体
- Workflow: 1 半具体 + 1 具体
- Epistemic: 1 半具体 + 1 具体
- RepairScope: 1 半具体 + 1 具体

【其他字段说明】
- 不需要输出 reverse（服务端自动补 false）
- 不需要输出 userFacingMessage（前端用本地固定文案）
</output_requirements>
```

#### 5. 工具 Schema（第二轮专用）

```typescript
const GENERATE_QUESTIONNAIRE_BATCH_TOOL_BATCH2 = {
  name: "generate_questionnaire_batch",
  description: "生成 AI-MBTI 第二轮问卷。8 题，每维度 1 半具体 + 1 具体，全部正向题，避免和第一轮重复。",
  input_schema: {
    type: "object",
    properties: {
      analysis: {
        type: "object",
        properties: {
          batch1Coverage: {
            type: "array",
            items: { type: "string" },
            description: "第一轮覆盖的任务类型（用于第二轮避免重复）"
          },
          dimensionsNeedingExploration: {
            type: "array",
            items: { 
              type: "string", 
              enum: ["Relation", "Workflow", "Epistemic", "RepairScope"] 
            },
            description: "需要深入探测的维度（第一轮答案接近中位数的维度）"
          },
          reasoning: {
            type: "string",
            description: "简短说明：第二轮策略与重复避免方案，≤100字"
          }
        },
        required: ["batch1Coverage", "dimensionsNeedingExploration", "reasoning"]
      },
      nextQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dimension: { 
              type: "string", 
              enum: ["Relation", "Workflow", "Epistemic", "RepairScope"]
            },
            question: { 
              type: "string",
              description: "题干，半具体题 ≤40 字，具体题 ≤50 字"
            },
            scenario: { 
              type: "string",
              description: "任务类型 ≤10 字，或具体场景 ≤15 字"
            },
            questionType: {
              type: "string",
              enum: ["semi_specific", "specific"],
              description: "题目类型：半具体或具体"
            }
          },
          required: ["dimension", "question", "scenario", "questionType"]
        }
      }
    },
    required: ["analysis", "nextQuestions"],
    additionalProperties: false
  }
};
```

#### 6. 服务端预处理

在调用模型前，服务端先做几件事：

```typescript
// 1. 计算第一轮维度倾向（用于推断需要深入探测的维度）
const batch1Scores = calculateDimensionScores(batch1Answers);

// 2. 推断模糊维度（接近中位数的维度优先深入）
const ambiguousDimensions = batch1Scores
  .filter(s => Math.abs(s.score - 5) < 2)  // 距离中点 < 2 分
  .map(s => s.dimension);

// 3. 提取题号引用（如果用户在反馈中提到了第 X 题）
const referencedQuestions = extractQuestionReferences(
  scenarioGuidance.userCorrectionQuote,
  batch1Questions
);

// 4. 构建第一轮答案摘要（给模型的简化版）
const batch1Summary = batch1Questions.map((q, i) => ({
  index: i + 1,
  dimension: q.dimension,
  scenario: q.scenario,
  question: q.question,
  userScore: batch1Answers[i]?.skipped ? "skipped" : batch1Answers[i]?.score
}));

// 5. 把这些信息注入 prompt
const prompt = buildBatch2Prompt({
  sessionState,
  batch1Summary,
  ambiguousDimensions,
  referencedQuestions,
  scenarioGuidance
});
```

#### 7. 验证规则（与第一轮类似 + 增量检查）

```typescript
function validateBatch2(
  questions: QuestionnaireQuestion[],
  batch1Questions: QuestionnaireQuestion[]
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // ===== 基础验证（与第一轮相同） =====
  // 1. 题目数量必须 8
  // 2. 维度分布必须每维度 2 题
  // 3. 题目类型必须 4 半具体 + 4 具体
  // 4. 每维度必须 1 半具体 + 1 具体
  // 5. 题干长度限制
  
  // ===== 第二轮特有验证 =====
  
  // 6. 重复检查（与第一轮）
  questions.forEach((q, i) => {
    batch1Questions.forEach((b1q) => {
      // 简单字符串相似度检查
      const similarity = calculateSimilarity(q.question, b1q.question);
      if (similarity > 0.7) {
        warnings.push(`第 ${i+1} 题与第一轮相似度过高：${q.question}`);
      }
    });
  });
  
  // 7. 句式重复检查
  const startPhrases = questions.map(q => q.question.slice(0, 5));
  const phraseCounts = countOccurrences(startPhrases);
  for (const [phrase, count] of phraseCounts) {
    if (count >= 3) {
      warnings.push(`句式重复：${count} 题以 "${phrase}" 开头`);
    }
  }
  
  // ===== 容错策略（与第一轮一致） =====
  // 允许 1 题轻微质量问题，2 题以上触发重试
  
  return {
    valid: issues.length === 0 && warnings.length < 2,
    severity: issues.length > 0 ? "fatal" : warnings.length >= 2 ? "fatal" : "warning",
    issues,
    warnings
  };
}
```

#### 8. Fallback 策略（第二轮）

如果第二轮生成失败，使用通用 fallback 题目：

```typescript
function getFallbackBatch2(role: string): QuestionnaireQuestion[] {
  return [
    // Relation 维度
    { dimension: "Relation", question: "和团队讨论时，我会先问 AI 的看法，再做决定", scenario: "团队讨论", questionType: "semi_specific" },
    { dimension: "Relation", question: `做${role}相关任务时，我把 AI 当成主要协作伙伴`, scenario: `${role}任务`, questionType: "specific" },
    // Workflow 维度
    { dimension: "Workflow", question: "学习新东西时，我倾向于先列大纲，再让 AI 帮我细化", scenario: "学习", questionType: "semi_specific" },
    { dimension: "Workflow", question: `做${role}工作时，我习惯先和 AI 一起规划再执行`, scenario: `${role}工作`, questionType: "specific" },
    // Epistemic 维度
    { dimension: "Epistemic", question: "解决问题时，我会让 AI 给我多个方案，再自己选", scenario: "解决问题", questionType: "semi_specific" },
    { dimension: "Epistemic", question: `做${role}决策时，我会和 AI 反复确认数据来源`, scenario: `${role}决策`, questionType: "specific" },
    // RepairScope 维度
    { dimension: "RepairScope", question: "做事卡住时，AI 给的方向不对，我会换个角度重新问", scenario: "卡住时", questionType: "semi_specific" },
    { dimension: "RepairScope", question: `${role}工作中遇到问题，我倾向于完全重新描述背景`, scenario: `${role}问题`, questionType: "specific" }
  ];
}
```

#### 9. 完整数据流

```
读取 sessionState（含 batch1 答案 + scenarioGuidance）
  ↓
服务端预处理：
  - 计算第一轮维度分数
  - 推断模糊维度
  - 提取题号引用
  - 构建 batch1 摘要
  ↓
调用模型（generate_questionnaire_batch）
  ↓
模型返回 8 题（4 半具体 + 4 具体）
  ↓
服务端验证：
  - 基础验证（题数、维度、类型分布）
  - 重复检查（与第一轮）
  - 句式检查
  ↓
失败 → 重试 / fallback
成功 → 更新 sessionState.questionnaireBatches.batch2
  ↓
跳转到第二轮答题页（步骤 6）
```

#### 10. 关键设计决策总结

| 决策点 | 决策 | 理由 |
|--------|------|------|
| 题目类型 | 4 半具体 + 4 具体 | 与第一轮互补 |
| 题干长度 | 半具体 ≤40 / 具体 ≤50 | 具体题需要更多上下文 |
| 输入信息 | 第一轮全部 + 中途反馈 | 让模型有充分上下文 |
| 重复检查 | 字符串相似度 + 句式检查 | 自动检测，但允许 1 题警告 |
| 模糊维度 | 计算后传给模型 | 引导模型深入探测 |
| 题号引用 | 服务端解析后传给模型 | 模型能精准避开类似题 |

#### 11. 待讨论问题（已解决）

1. ✅ **相似度算法**：方案 B（分词后看共同词比例，中文友好）
2. ✅ **模糊维度逻辑**：暂不设计（避免过度复杂）
3. ✅ **题号引用解析**：只提取题号，让模型自己理解
4. ✅ **验证失败处理**：局部 fallback 策略（见下方第 12 节）

#### 12. 验证失败的局部 Fallback 策略（核心优化）

**核心思想：只要模型返回了合法 JSON，就保留可用的题目，单独替换不合格的题。**

**为什么不用整批重试？**
- 浪费已经生成的好题
- 整批重试增加 10+ 秒延迟
- 第二次生成不一定比第一次好

**为什么不用整批 fallback？**
- 模型已经基于用户上下文生成了贴近的题
- 整批替换会丢失个性化

**新策略：单题替换**

```typescript
function repairQuestionnaireBatch(
  questions: QuestionnaireQuestion[],
  batchMode: "hybrid_batch1" | "hybrid_batch2",
  context: {
    role: string;
    recentUse: string;
    batch1Questions?: QuestionnaireQuestion[];
  }
): { 
  questions: QuestionnaireQuestion[]; 
  replacedIndices: number[];
  reasons: string[];
} {
  const repaired = [...questions];
  const replacedIndices: number[] = [];
  const reasons: string[] = [];
  
  // 1. 逐题检查
  questions.forEach((q, i) => {
    const issue = checkSingleQuestion(q, batchMode, context);
    if (issue) {
      // 单题不合格 → 用 fallback 题替换
      const fallback = getFallbackForSlot(
        q.dimension,           // 保持维度
        getQuestionType(q, batchMode),  // 保持类型
        context
      );
      repaired[i] = fallback;
      replacedIndices.push(i);
      reasons.push(`第 ${i+1} 题：${issue}（已替换为 fallback）`);
    }
  });
  
  // 2. 检查整体结构（维度分布、类型分布）
  // 如果整体结构错误（缺少某维度题），需要做槽位修复
  const structuralFix = fixStructuralIssues(repaired, batchMode, context);
  if (structuralFix.fixed) {
    replacedIndices.push(...structuralFix.fixedIndices);
    reasons.push(...structuralFix.reasons);
  }
  
  return { questions: repaired, replacedIndices, reasons };
}
```

**单题检查规则：**

```typescript
function checkSingleQuestion(
  q: QuestionnaireQuestion,
  batchMode: "hybrid_batch1" | "hybrid_batch2",
  context: any
): string | null {
  // 1. 字段完整性
  if (!q.dimension || !q.question || !q.scenario) {
    return "字段缺失";
  }
  
  // 2. 维度合法性
  if (!["Relation", "Workflow", "Epistemic", "RepairScope"].includes(q.dimension)) {
    return `dimension 非法：${q.dimension}`;
  }
  
  // 3. 题干长度
  const maxLength = batchMode === "hybrid_batch1" ? 50 : 50;
  if (q.question.length > maxLength) {
    return `题干过长：${q.question.length}字`;
  }
  if (q.question.length < 5) {
    return `题干过短：${q.question.length}字`;
  }
  
  // 4. scenario 长度
  if (q.scenario.length > 15) {
    return `scenario 过长：${q.scenario.length}字`;
  }
  
  // 5. 机器翻译腔检测
  const machineTranslationPatterns = [
    /进行.+的操作/,
    /实现.+的目标/,
    /在.+的场景下/,
    /在.+的过程中/
  ];
  if (machineTranslationPatterns.some(p => p.test(q.question))) {
    return "疑似机器翻译腔";
  }
  
  // 6. 第二轮专属：与第一轮重复检查
  if (batchMode === "hybrid_batch2" && context.batch1Questions) {
    for (const b1q of context.batch1Questions) {
      if (calculateSimilarityB(q.question, b1q.question) > 0.7) {
        return `与第一轮第 ${b1q.index} 题相似度过高`;
      }
    }
  }
  
  return null;  // 通过
}
```

**槽位修复（结构性问题）：**

如果模型生成的 8 题里维度分布错了（比如 Relation 出了 3 题，Workflow 只有 1 题），需要做槽位级修复：

```typescript
function fixStructuralIssues(
  questions: QuestionnaireQuestion[],
  batchMode: "hybrid_batch1" | "hybrid_batch2",
  context: any
): { fixed: boolean; fixedIndices: number[]; reasons: string[] } {
  // 1. 统计每个维度的题目数
  const dimensionCounts = countByDimension(questions);
  
  // 2. 找出多余的题（>2）和缺失的维度（<2）
  const overflow: Array<{ dim: string; index: number }> = [];
  const missing: Array<{ dim: string; needed: number }> = [];
  
  for (const dim of ["Relation", "Workflow", "Epistemic", "RepairScope"]) {
    if (dimensionCounts[dim] > 2) {
      // 多余的题，记录索引
      const indices = questions
        .map((q, i) => q.dimension === dim ? i : -1)
        .filter(i => i >= 0);
      // 保留前 2 题，剩余的标记为可替换
      overflow.push(...indices.slice(2).map(i => ({ dim, index: i })));
    }
    if (dimensionCounts[dim] < 2) {
      missing.push({ dim, needed: 2 - dimensionCounts[dim] });
    }
  }
  
  // 3. 把多余位置替换为缺失维度的 fallback 题
  const fixedIndices: number[] = [];
  const reasons: string[] = [];
  
  let overflowIndex = 0;
  for (const m of missing) {
    for (let n = 0; n < m.needed; n++) {
      if (overflowIndex < overflow.length) {
        const slot = overflow[overflowIndex];
        const fallbackType = inferTypeForSlot(questions, slot.index, batchMode);
        questions[slot.index] = getFallbackForSlot(m.dim, fallbackType, context);
        fixedIndices.push(slot.index);
        reasons.push(`第 ${slot.index + 1} 题：补全维度 ${m.dim}`);
        overflowIndex++;
      }
    }
  }
  
  return {
    fixed: fixedIndices.length > 0,
    fixedIndices,
    reasons
  };
}
```

**Fallback 题库（按槽位）：**

```typescript
// 按 dimension + questionType 组织 fallback 题
const FALLBACK_BANK = {
  hybrid_batch1: {
    "Relation_universal": [
      { dimension: "Relation", question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具", scenario: "通用" },
      // 多个备选，避免重复使用
    ],
    "Relation_semi_specific": [
      { dimension: "Relation", question: "做事时，我期待 AI 主动提供补充建议", scenario: "做事" },
    ],
    "Workflow_universal": [...],
    "Workflow_semi_specific": [...],
    // ... 8 个槽位 × 多个备选
  },
  hybrid_batch2: {
    "Relation_semi_specific": [...],
    "Relation_specific": [...],
    // ... 8 个槽位
  }
};

function getFallbackForSlot(
  dimension: string,
  questionType: string,
  context: any
): QuestionnaireQuestion {
  const key = `${dimension}_${questionType}`;
  const candidates = FALLBACK_BANK[batchMode][key];
  
  // 随机选一个（避免每次都用第一个）
  const fallback = candidates[Math.floor(Math.random() * candidates.length)];
  
  // 如果是 batch2 的 specific 题，可以基于 context.role 微调
  if (batchMode === "hybrid_batch2" && questionType === "specific") {
    return {
      ...fallback,
      question: fallback.question.replace("{role}", context.role),
      scenario: fallback.scenario.replace("{role}", context.role)
    };
  }
  
  return fallback;
}
```

**完整调用流程：**

```typescript
async function generateQuestionnaireBatch(
  sessionState: SessionState,
  batchMode: "hybrid_batch1" | "hybrid_batch2"
) {
  // 1. 调用模型
  const modelResponse = await callModel(sessionState, batchMode);
  
  // 2. 解析工具调用
  const { analysis, nextQuestions } = parseToolCall(modelResponse);
  
  // 3. 局部修复（不重试）
  const { questions: repaired, replacedIndices, reasons } = 
    repairQuestionnaireBatch(nextQuestions, batchMode, {
      role: sessionState.background.role,
      recentUse: sessionState.background.recentUse,
      batch1Questions: sessionState.questionnaireBatches?.batch1
    });
  
  // 4. 最终结构性兜底（极端情况：题数不足 8）
  while (repaired.length < 8) {
    const missingDim = findMissingDimension(repaired);
    const missingType = findMissingType(repaired, batchMode);
    repaired.push(getFallbackForSlot(missingDim, missingType, context));
    replacedIndices.push(repaired.length - 1);
  }
  
  // 5. 返回结果（带审计信息）
  return {
    questions: repaired,
    sessionState,
    source: replacedIndices.length === 0 ? "model" : "model_with_fallback",
    fallbackInfo: {
      replacedIndices,
      reasons,
      replacementCount: replacedIndices.length
    }
  };
}
```

**触发整批重试的条件（极少）：**
- 模型完全没返回工具调用
- 返回的 JSON 解析失败
- 题数严重不足（<4）
- 字段缺失严重（多个维度都缺）

**优势总结：**
- 单题替换：保留 7 道好题，只换不合格的
- 槽位修复：自动平衡维度/类型分布
- 不重试：节省 10+ 秒延迟
- 体面降级：用户拿到的总是 8 题

#### 13. 计算相似度（方案 B：分词共同词比例）

```typescript
function calculateSimilarityB(text1: string, text2: string): number {
  // 简单分词：按标点和常见连接词切分
  const tokenize = (text: string): Set<string> => {
    const tokens = text
      .replace(/[，。、,.\s\n;；！？]+/g, ' ')
      .split(' ')
      .filter(t => t.length >= 2 && t.length <= 6);
    return new Set(tokens);
  };
  
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  // Jaccard 相似度：交集 / 并集
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

// 例如：
// "写代码时，我期待 AI 主动指出我可能忽略的问题"
// "写代码时，我会让 AI 检查代码质量"
// 共同词：写代码、AI
// 相似度 ≈ 0.3（不算太相似）

// "写代码时，我期待 AI 主动指出问题"
// "写代码时，我希望 AI 主动指出问题"
// 共同词：写代码、AI、主动、指出、问题
// 相似度 ≈ 0.8（高度相似，触发警告）
```

#### 14. 第一轮也应用同样策略

第一轮的验证失败处理也使用局部 fallback：

```typescript
// 第一轮也用同样的 repair 函数
const { questions: repairedBatch1 } = repairQuestionnaireBatch(
  modelQuestions,
  "hybrid_batch1",
  { role, recentUse }  // 不需要 batch1Questions
);
```

第一轮 fallback 题库需要按 4 个维度 × 2 种类型（universal / semi_specific）组织 8 个槽位。


---

## 步骤 6：第二轮问卷作答页

### 设计决策（2026-05-05）

**核心：复用步骤 3 的设计，只调整数据指向和题面 tag**

#### 1. 与步骤 3 的差异

| 项 | 步骤 3（第一轮） | 步骤 6（第二轮） |
|----|------|------|
| 题目数据来源 | `sessionState.questionnaireBatches.batch1` | `sessionState.questionnaireBatches.batch2` |
| 答案存储位置 | `sessionState.batchAnswers.batch1` | `sessionState.batchAnswers.batch2` |
| 题面类型 tag | "通用" / 任务类型 | 任务类型 / 具体场景 |
| 题干长度展示 | ≤50 字 | ≤50 字 |
| 完成后跳转 | `/mid-feedback`（中途反馈页） | `/report`（报告生成页） |
| 进度计数 | "第 X / 8 题"（第一轮） | "第 X / 8 题"（第二轮，独立计数） |

#### 2. UI 完全复用

- 同一个 `QuestionnaireCard.tsx` 组件
- 单题模式 + 旋转入场动画
- 圆形按钮评分（0-5）
- 跳过按钮（"不了解 / 没想好"）
- 上一题/下一题导航
- 6 档语义标签（"肯定不会"→"肯定会"）

#### 3. 数据流

```
读取 sessionState.questionnaireBatches.batch2（步骤 5 生成的 8 题）
  ↓
逐题渲染 QuestionnaireCard
  ↓
每题答完保存到 sessionState.batchAnswers.batch2
  ↓
8 题完成 → 跳转到报告生成页
```

#### 4. 实现建议

- 第一轮和第二轮答题页共用一个组件，例如 `BatchAnsweringPage`
- 通过路由参数或 props 区分批次：
  ```typescript
  function BatchAnsweringPage({ batchKey }: { batchKey: "batch1" | "batch2" }) {
    const questions = sessionState.questionnaireBatches[batchKey];
    const onComplete = () => {
      if (batchKey === "batch1") {
        router.push("/mid-feedback");
      } else {
        router.push("/report");
      }
    };
    // ...
  }
  ```

#### 5. 不做的事

- 不重复设计 UI
- 不增加和第一轮不同的交互（保持一致体验）
- 不展示"第二轮专属"的特殊标识（避免增加用户认知负担）


---

## 过渡动画页（保留现有设计）

### 设计决策（2026-05-05）

**核心：当前项目的两个过渡动画页设计很好，新流程完整保留。**

#### 1. 问卷生成过渡页（`QuestionnaireGenerating.tsx`）

**触发时机：**
- 步骤 1 → 步骤 3 之间：第一轮问卷生成时
- 步骤 4 → 步骤 6 之间：第二轮问卷生成时

**当前设计：**
- 4 阶段打字机文案：
  1. "分析你的回答..."（5s）
  2. "理解你的协作风格..."（5s）
  3. "定制专属问卷..."（10s）
  4. "即将完成..."（10s）
- 标签："预计 30–60s，请稍候"

**新流程的微调建议：**

第一轮问卷生成时的文案（信息收集页 → 第一轮）：
- "正在理解你的背景..."
- "分析你的 AI 使用场景..."
- "定制第一轮问卷..."
- "即将完成..."

第二轮问卷生成时的文案（中途反馈页 → 第二轮）：
- "正在分析你的反馈..."
- "调整问题方向..."
- "生成第二轮问卷..."
- "即将完成..."

**实现方案：**
- 保留 `QuestionnaireGenerating.tsx` 组件
- 通过 prop 传入不同 STAGES 数组
- 例如：`<QuestionnaireGenerating stages={BATCH1_STAGES} />`

#### 2. 报告生成过渡页（`HolographicLoading.tsx`）

**触发时机：**
- 步骤 6 → 步骤 8 之间：报告生成时

**当前设计：**
- 5 阶段维度分析动画：
  1. 关系维度（红，3s）
  2. 工作流维度（蓝，3s）
  3. 认知维度（绿，3s）
  4. 修复维度（黄，3s）
  5. 综合分析（紫，2s）
- 矩阵雨背景（"AIMBTICFEALGT01" 字符）
- 全息感动画

**新流程的对齐：**
- 5 阶段刚好对应 4 维度 + 综合，逻辑保留
- 完全不需要改动

**实现方案：**
- 保留 `HolographicLoading.tsx` 组件
- 在报告生成完成后调用 `onComplete` 跳转报告页

#### 3. 新流程中的过渡页位置

```
信息收集页（/intake）
  ↓ 提交表单
  ↓
[过渡：QuestionnaireGenerating + 第一轮文案] ← 调用 /api/questionnaire/generate (batch1)
  ↓ 生成完成
  ↓
第一轮答题（8 题）
  ↓
中途反馈页（/mid-feedback）
  ↓ 提交反馈
  ↓
[过渡：QuestionnaireGenerating + 第二轮文案] ← 调用 /api/questionnaire/generate (batch2)
  ↓ 生成完成
  ↓
第二轮答题（8 题）
  ↓
[过渡：HolographicLoading] ← 调用 /api/report
  ↓ 报告生成完成
  ↓
报告页（/report）
```

#### 4. 不做的事

- 不重新设计动画
- 不删除现有的过渡页组件
- 不在过渡页中展示中间结果（保持神秘感）


---

## 步骤 7：报告生成

### 设计决策（2026-05-05）

**核心：报告页基本沿用原格式（幻灯片 + 海报），优化内容层**

**保留的整体结构：**
1. 人格头像 + 名称
2. 四维光谱
3. 人格故事页（幻灯片）
4. 关于你 3 个值得记住的发现
5. Prompt 模板与适合的工作流
6. 海报（可分享）
7. 完整维度解读
8. 答题与计分明细
9. 反馈入口

**优化方案（5 项）：**

---

### 优化 1：维度分析改为三段式

**当前问题：**
- 维度分析容易写成"该维度得分 17，基于 4 道有效回答..."
- 像计分说明，不像用户洞察

**新设计：行为模式 + 证据 + 边界**

```typescript
interface DimensionAnalysisV2 {
  userPattern: string;        // 行为模式：用户在实际用 AI 时表现为什么动作
  evidenceExplanation: string; // 证据解释：引用用户原话或题目回答
  caveat: string;              // 边界提示：这不是能力等级，只是协作倾向
}
```

**示例：**

```text
【行为模式】
你更像是先把 AI 放进同一个讨论桌的人：
不会只丢任务等结果，也会期待它补充盲区。

【证据解释】
这个判断主要来自你在 Relation 维度几道伙伴协作题上
的高分，以及你在中途反馈里希望题目更贴近真实场景的表达。

【边界提示】
需要注意的是，它说明的是你更愿意和 AI 共创，
不等于每次都会信任 AI 的输出。
```

**实施改动：**
- 修改 `REPORT_SYSTEM` prompt，要求模型按三段式输出
- 修改报告 schema：新增 `userPattern` / `evidenceExplanation` / `caveat` 字段
- 修改 `DimensionCard.tsx`，按三段式展示（可视化用三种颜色或图标分隔）

---

### 优化 2：Prompt 模板绑定真实任务

**当前问题：**
- Prompt 模板可能是通用填空表（"我希望你..."）
- 用户复制后还要改成自己的场景

**新设计：模板必须基于用户真实任务**

**优先级：**
1. 中途反馈中的 `scenarioSummary`（用户希望聚焦的场景）
2. 信息收集页的 `recentUse`（具体 AI 使用经历）
3. 用户的 role（兜底）

**示例对比：**

❌ 通用模板：
```
我希望你帮我[任务目标]，请先[步骤 1]，再[步骤 2]，最后[步骤 3]。
```

✅ 绑定真实任务：
```
我现在要写一份产品需求文档（用户填的具体任务），
基于你 Collaborative + Framer 的倾向，建议这样问 AI：

"我要写产品需求文档，主题是 [你的具体功能]。
我想先和你讨论：1) 哪些边界情况容易遗漏？
2) 异常流程有哪些常见模式？
然后我们再一起列大纲，最后我来填具体内容。"
```

**实施改动：**
- 修改 `REPORT_SYSTEM` prompt，要求 promptTemplates 必须用 scenarioSummary 或 recentUse 填充
- 模型层面拒绝输出 `[任务目标]`、`[你的场景]` 这种 placeholder
- 在校验层（`reportContentValidation.ts`）检查 placeholder

---

### 优化 3："关于你 3 个值得记住的发现"具体化

**当前问题：**
- styleOverview 可能比较抽象
- 用户读完不知道"我做过什么让你这么说"

**新设计：每条发现 = 用户做过什么 → 反映了什么倾向**

**示例对比：**

❌ 抽象版：
```
你的核心模式：高效协作
适合场景：复杂决策
成长方向：建立反馈机制
```

✅ 具体版：
```
1. 你习惯把任务说清楚再问 AI
   （来自第 3 题"先明确目标"打 5 分 + recentUse 提到"先列大纲"）
   → 这让你在 Workflow 维度偏向"框架型"

2. 你期待 AI 主动指出你忽略的角度
   （来自第 2 题"AI 主动指出问题"打 5 分）
   → 这让你在 Relation 维度偏向"伙伴型"

3. 你写需求文档时会让 AI 检查边界情况
   （来自你的中途反馈原文）
   → 这是你最具体的协作场景，也是最值得保留的习惯
```

**实施改动：**
- 修改 styleOverview 的 schema：每条 `pattern` 字段必须带 `evidence` 子字段
- prompt 要求每条都引用具体题号、用户原话或反馈内容
- UI 展示时区分"行为"和"反映的倾向"

---

### 优化 4：答题明细区分两轮 + 展示中途反馈

**当前问题：**
- 答题明细是混在一起的 16 题列表
- 用户看不到"我中途反馈过，第二轮也确实变了"

**新设计：分三个区块展示**

```
答题与计分明细
─────────────────────────

【第一轮 8 题：轻量采样】
1. [Relation/通用] 我倾向于把 AI 当成讨论伙伴...
   你的回答：4 分（通常会）
2. ...

【中途反馈】
你的整体感受：挺贴近的
你希望聚焦的场景：
"写产品需求文档时让 AI 补充边界情况"
你的题目反馈：
"第 3 题问得有点抽象"

【第二轮 8 题：深入探测】
基于你的反馈，第二轮聚焦在「写需求 / 边界情况」
9. [Relation/写需求] 写需求时，我会让 AI 主动指出...
   你的回答：5 分（肯定会）
...

【最终计分】
- Relation: 17/20（伙伴型，high confidence）
- Workflow: 15/20（框架型，high confidence）
- Epistemic: 11/20（审计型，medium confidence）
- RepairScope: 9/20（局部型，low confidence）
```

**实施改动：**
- 修改 `buildScoreAudit` 函数，输出三个区块而不是一个列表
- 在第二轮区块前加一个小卡片，展示 `scenarioGuidance.scenarioSummary`
- 中途反馈区块包含：整体感受 + 聚焦场景 + 题目反馈原文

---

### 优化 5："本次报告基于"区块（透明度）

**当前问题：**
- 用户看到结论但不知道"为什么得出这个"
- 缺乏对数据来源的清晰说明

**新设计：在报告页顶部增加"本次报告基于"区块**

```
本次报告基于：
─────────────────────────
✓ 你填写的职业：前端工程师
✓ 你填写的 AI 使用经历：
  "用 Claude 写 React 组件，让它优化性能..."
✓ 你常用的 AI 工具：Claude、Cursor
✓ 第一轮 8 题回答（跳过 0 题）
✓ 你的中途反馈：
  整体感受"挺贴近的"，希望聚焦"写需求文档"
✓ 第二轮 8 题回答（跳过 0 题）
─────────────────────────
```

**位置：** 在四维光谱之前，作为"输入说明"区块

**展示形式：**
- 默认折叠（不抢人格头像的视觉重心）
- 展开后显示完整的输入清单
- 用 ✓ 图标表示"这些数据被用了"

**实施改动：**
- 新增 `ReportInputSummary.tsx` 组件
- 从 `sessionState` 读取所有输入
- 渲染为可折叠的小卡片

---

### 报告生成的整体合同（参考 `report-update.md` 4.1）

**模型只输出叙事层：**

```typescript
type ReportNarrativeDraft = {
  summary: string;
  openingInsight: string;
  styleOverview: Array<{
    pattern: string;        // 用户做过什么
    tendency: string;       // 反映了什么倾向
    evidence: string;       // 题号或原话引用
  }>;
  dimensionAnalyses: Array<{
    dimension: Dimension;
    userPattern: string;
    evidenceExplanation: string;
    caveat: string;
  }>;
  overallAdvice: string;
  recommendations: Array<{ title: string; detail: string }>;
  promptTemplates: Array<{
    title: string;
    useCase: string;       // 必须基于 scenarioSummary 或 recentUse
    prompt: string;        // 不能有 [任务目标] 这种 placeholder
  }>;
  signatureDetail?: string;
};
```

**服务端固定生成（不让模型输出）：**
- `personality`（确定性计算）
- `scores`（确定性计算）
- `targetContext`（已有）
- `collaborationManifesto`（固定工作流）
- `styleOverview.growthDirection`（来自 personality.code）
- `collaborationSignature.headline`（来自人格画像）
- `colors` / `avatarPrompt`（来自人格画像）

### 服务端预处理（高信号摘要）

按 `report-update.md` 5.2 节，调用模型前先整理：

```typescript
const reportInputSummary = {
  identity: { role, recentUse, tools },
  
  // 维度数据
  dimensions: {
    strongest: ["Relation", "Workflow"],     // 最强 2 维度
    ambiguous: ["Epistemic"],                 // 接近中点的维度
    scores: { Relation: 17, Workflow: 15, ... }
  },
  
  // 答题数据
  batch1Highlights: [
    // 每维度 1 条最高信号题（分数最高或最低的题）
    { dimension: "Relation", question: "...", score: 5 }
  ],
  batch2Highlights: [...],
  
  // 中途反馈
  midFeedback: {
    status: "confirmed",
    scenarioSummary: "写产品需求文档时让 AI 补充边界情况",
    userCorrectionQuote: "第 3 题问得有点抽象"
  },
  
  // 跳过统计
  skipStats: {
    batch1Skipped: 0,
    batch2Skipped: 1,
    skippedQuestions: [{ index: 12, question: "..." }]
  },
  
  // 两轮差异
  batchDiff: {
    consistent: ["Relation", "Workflow"],
    inconsistent: []  // 第一轮和第二轮分数差异 ≥3 的维度
  }
};
```

**关键：** 不要把全部 16 题原样堆给模型，只给"高信号摘要"。

### 报告内容质量校验

按 `report-update.md` 5.3 节，新增 `src/lib/reportContentValidation.ts`：

```typescript
function validateReportNarrative(report: ReportNarrativeDraft): {
  valid: boolean;
  failedFields: string[];
  warnings: string[];
} {
  const failedFields = [];
  const warnings = [];
  
  // 1. 禁止 placeholder
  if (/\[任务目标\]|\[你的场景\]|\[填入.+\]/.test(report.promptTemplates.map(t => t.prompt).join(""))) {
    failedFields.push("promptTemplates: 包含 placeholder");
  }
  
  // 2. 禁止空词密集
  const emptyPhrases = ["高效", "稳定", "持续优化", "实现价值", "综合能力", "赋能"];
  for (const dim of report.dimensionAnalyses) {
    const text = dim.userPattern + dim.evidenceExplanation;
    const count = emptyPhrases.filter(p => text.includes(p)).length;
    if (count >= 3) {
      failedFields.push(`dimensionAnalyses.${dim.dimension}: 空词密集（${count} 个）`);
    }
  }
  
  // 3. 禁止默认目标
  if (report.summary.includes("更有效地使用 AI") || 
      report.openingInsight.includes("更有效地使用 AI")) {
    warnings.push("summary/openingInsight: 使用了兜底目标，缺乏个性化");
  }
  
  // 4. 句式重复检查
  const startPhrases = report.dimensionAnalyses.map(d => d.userPattern.slice(0, 5));
  const uniqueStarts = new Set(startPhrases);
  if (uniqueStarts.size < 3) {
    warnings.push("dimensionAnalyses: 多个维度使用相同句式开头");
  }
  
  return {
    valid: failedFields.length === 0,
    failedFields,
    warnings
  };
}
```

**校验失败处理：**
- 失败字段单独重试（不重新生成整份报告）
- 多次失败 → 用 fallback 文案替换该字段

### 数据流

```
用户在第二轮答完 8 题
  ↓
[过渡：HolographicLoading]
  ↓
调用 /api/report
  Body: { sessionState（含完整数据） }
  ↓
服务端确定性处理：
  - resolveReportQuestionnaireAnswers (合并 batch1 + batch2)
  - scoreQuestionnaireAnswers (计算四维分数)
  - getPersonalityCode + getPersonalityProfile (确定人格)
  - normalizeTargetContext
  ↓
服务端整理高信号摘要：
  - 强弱维度
  - 高信号题
  - 中途反馈
  - 两轮差异
  ↓
调用模型生成叙事层（ReportNarrativeDraft）
  ↓
内容校验（reportContentValidation）
  - 失败字段重试或 fallback
  ↓
服务端补全（确定性字段 + 模型字段）
  ↓
返回完整 FinalReport
  ↓
报告页渲染（ReportStoryExperience）
```

### 不做的事

- 不重新设计报告页 UI 主体结构
- 不改幻灯片或海报形式
- 不改人格画像（16 型）
- 不改四维定义和计分逻辑
- 不让模型输出 `personality` / `scores` / `manifesto`（服务端固定）

## 附录 A：DeepSeek API 迁移方案（参考）

### 背景

当前设计基于 Qwen API 的工具调用功能。经过调研，DeepSeek API 同样支持工具调用和 JSON Schema 验证，可以作为替代方案。

### DeepSeek API 能力确认

**✅ 支持的功能：**
1. **工具调用（Tool Calls）**：与 OpenAI API 格式兼容
2. **strict 模式（Beta）**：强制 JSON Schema 验证
3. **enum 约束**：支持维度枚举
4. **required 字段**：支持必填字段验证
5. **additionalProperties: false**：禁止额外字段

**⚠️ 限制：**
1. **不支持 minItems/maxItems**：无法在 schema 层面约束数组长度
2. **strict 模式在 Beta**：可能不够稳定

**解决方案：**
- 在 prompt 中明确要求数组长度（"必须恰好 8 题"）
- 在服务端验证层检查数组长度（已有）

### 工具定义格式对比

**Qwen 格式：**
```typescript
const TOOL = {
  name: "generate_questionnaire_batch",
  input_schema: {
    type: "object",
    properties: { ... },
    required: [...]
  }
};
```

**DeepSeek 格式：**
```typescript
const TOOL = {
  type: "function",
  function: {
    name: "generate_questionnaire_batch",
    strict: true,  // 开启 strict 模式
    description: "工具描述",
    parameters: {
      type: "object",
      properties: { ... },
      required: [...],
      additionalProperties: false  // 必须设置
    }
  }
};
```

### 完整工具定义（DeepSeek 版本）

```typescript
const GENERATE_QUESTIONNAIRE_BATCH_TOOL_DEEPSEEK = {
  type: "function",
  function: {
    name: "generate_questionnaire_batch",
    strict: true,
    description: "生成 AI-MBTI 问卷批次。第一轮 8 题，每维度 1 通用 + 1 半具体，全部正向题。",
    parameters: {
      type: "object",
      properties: {
        analysis: {
          type: "object",
          description: "用户信息分析与生成策略",
          properties: {
            roleQuality: { 
              type: "string", 
              enum: ["high", "low"],
              description: "role 是否为有效职业/身份"
            },
            recentUseQuality: { 
              type: "string", 
              enum: ["high", "low"],
              description: "recentUse 是否为有效的 AI 使用描述"
            },
            extractedTaskTypes: {
              type: "array",
              description: "用于半具体题的 4 个任务类型（在 prompt 中要求恰好 4 个）",
              items: { type: "string" }
            },
            reasoning: { 
              type: "string",
              description: "简短说明：信息质量判断 + 任务类型选择依据"
            }
          },
          required: ["roleQuality", "recentUseQuality", "extractedTaskTypes", "reasoning"],
          additionalProperties: false
        },
        nextQuestions: {
          type: "array",
          description: "8 道题（在 prompt 中要求恰好 8 题）",
          items: {
            type: "object",
            properties: {
              dimension: { 
                type: "string", 
                enum: ["Relation", "Workflow", "Epistemic", "RepairScope"],
                description: "维度"
              },
              question: { 
                type: "string",
                description: "题干，第一人称陈述句"
              },
              scenario: { 
                type: "string",
                description: "通用题写'通用'，半具体题写任务类型"
              }
            },
            required: ["dimension", "question", "scenario"],
            additionalProperties: false
          }
        }
      },
      required: ["analysis", "nextQuestions"],
      additionalProperties: false
    }
  }
};
```

### API 调用代码（DeepSeek 版本）

```typescript
import OpenAI from "openai";

// 初始化 DeepSeek 客户端
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseUrl: "https://api.deepseek.com/beta"  // Beta 版本支持 strict 模式
});

// 调用 API
const response = await client.chat.completions.create({
  model: "deepseek-v4-pro",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  tools: [GENERATE_QUESTIONNAIRE_BATCH_TOOL_DEEPSEEK],
  temperature: 0.7,
  max_tokens: 4096
});

// 提取工具调用结果
const message = response.choices[0].message;
if (!message.tool_calls || message.tool_calls.length === 0) {
  throw new Error("模型未调用工具");
}

const toolCall = message.tool_calls[0];
const result = JSON.parse(toolCall.function.arguments);

// result 结构与 Qwen 版本相同
const { analysis, nextQuestions } = result;
```

### Prompt 补充（补偿 minItems/maxItems）

在输出要求部分增加明确的数量约束：

```xml
<output_requirements>
必须调用 generate_questionnaire_batch 工具，输出两个核心字段：

1. analysis: 信息质量判断
   - roleQuality: "high" | "low"
   - recentUseQuality: "high" | "low"
   - extractedTaskTypes: **必须恰好 4 个**任务类型（不能多也不能少）
   - reasoning: 简短说明（≤80字）

2. nextQuestions: **必须恰好 8 道题**（不能多也不能少）
   每题包含：
   {
     dimension: "Relation" | "Workflow" | "Epistemic" | "RepairScope",
     question: string,
     scenario: string
   }

【严格数量要求】
- nextQuestions 数组长度必须是 8
- extractedTaskTypes 数组长度必须是 4
- 如果不满足，服务端验证会失败并重试

【题目分布要求】
- Relation: 1 通用 + 1 半具体
- Workflow: 1 通用 + 1 半具体
- Epistemic: 1 通用 + 1 半具体
- RepairScope: 1 通用 + 1 半具体
</output_requirements>
```

### 迁移清单

**需要改动的代码：**
1. ✅ 工具定义格式：从 Qwen 格式改为 DeepSeek 格式（约 30 行）
2. ✅ API 调用代码：从 Qwen SDK 改为 OpenAI SDK（约 20 行）
3. ✅ Prompt 补充：强调数组长度约束（约 10 行）
4. ✅ 环境变量：添加 `DEEPSEEK_API_KEY`

**不需要改动的部分：**
1. ✅ Prompt 设计（完全保留）
2. ✅ 验证逻辑（完全保留）
3. ✅ 数据结构（完全保留）
4. ✅ 前端代码（完全保留）

**总改动量：约 60 行代码 + 配置**

### 迁移风险评估

**低风险：**
- API 格式与 OpenAI 兼容，生态成熟
- 工具调用和 strict 模式功能完整
- 我们的设计不依赖 minItems/maxItems

**中风险：**
- strict 模式在 Beta，可能不稳定
- 需要测试 DeepSeek 的题目生成质量

**建议测试项：**
1. strict 模式是否稳定（是否会拒绝合法输出）
2. 题目生成质量（与 Qwen 对比）
3. 数组长度约束是否有效（模型是否遵守 prompt）
4. 错误处理（schema 验证失败时的错误信息）

### 迁移步骤

1. **准备阶段**：
   - 申请 DeepSeek API key
   - 安装 OpenAI SDK：`npm install openai`
   - 配置环境变量

2. **开发阶段**：
   - 创建 `src/lib/deepseek.ts`（封装 DeepSeek API 调用）
   - 修改 `/api/questionnaire/generate` 支持切换模型
   - 更新工具定义和 prompt

3. **测试阶段**：
   - 单元测试：验证工具定义格式
   - 集成测试：生成 10 次问卷，检查质量
   - 对比测试：Qwen vs DeepSeek 生成质量

4. **上线阶段**：
   - 灰度发布：部分用户使用 DeepSeek
   - 监控指标：生成成功率、重试率、用户反馈
   - 全量切换或回滚

---

---

## 实施状态

- [x] 步骤 1：信息收集页 - 设计完成
- [x] 问卷设计重构 - 完成
- [x] 步骤 2：第一轮问卷生成 - Prompt 设计完成，模型调用方案完成
- [x] 步骤 3：第一轮问卷作答 - 设计完成（复用现有 UI + 分数方案调整）
- [x] 步骤 4：中途反馈页 - 设计完成（表单 + 题目回顾 + 本地结构化）
- [x] 步骤 5：第二轮问卷生成 - 设计完成（基于第一轮答案 + 中途反馈 + 局部 fallback）
- [x] 步骤 6：第二轮问卷作答 - 设计完成（复用步骤 3，仅数据指向不同）
- [x] 过渡动画页 - 设计完成（保留 QuestionnaireGenerating + HolographicLoading）
- [x] 步骤 7：报告生成 - 设计完成（5 项内容优化 + 高信号摘要 + 内容校验）
- [ ] 步骤 8：报告页展示（保留现有 ReportStoryExperience，按步骤 7 的优化点适配）

---

## 变更日志

### 2026-05-05

**步骤 1：信息收集页**
- 表单字段确定：role + recentUse + tools（其他自定义可选）
- goal 数据结构简化：统一为固定值"提高效率，并获得更多 idea/思路/选择/灵感"
- 移除 goalStatus / goalType（过度设计）
- AI 工具列表：9 个预设 + 其他自定义
- UI 风格：标签选择器 + 深色渐变（参考 landing page）

**问卷设计重构**
- 取消反向题，全部正向
- 计分简化：0-5 分制，跳过=2.5（每维度 4 题，满分 20，中点 10）
- 题目数量：16 题（8+8 两轮）
- 题目类型：通用-半具体-具体光谱（4-8-4 固定比例）
- 每维度：1 通用 + 1 半具体（第一轮）+ 1 半具体 + 1 具体（第二轮）
- 置信度阈值：60% high / 30-60% medium / <30% low

**步骤 2：第一轮问卷生成**
- Prompt 设计：信息质量二分类、内容相关性筛选、任务类型提取
- 工具 Schema 简化：只保留 analysis + nextQuestions
- 题干长度放宽至 ≤50 字（建议 ≤30）
- 明确工具调用 vs 普通文本回复的选择理由
- 验证策略：局部 fallback（单题替换，不重试整批）

**步骤 3：第一轮问卷作答**
- 直接复用现有 QuestionnaireCard.tsx
- 唯一改动：1-6 分制 → 0-5 分制（标签不变）
- 跳过题计分按 2.5 分

**步骤 4：中途反馈页**
- 3 个表单字段：整体感受（必填）+ 题目反馈（可选）+ 聚焦场景（可选）
- 题目回顾功能：可展开列表 + 题号引用按钮
- 题目回顾展示用户答案，但不展示维度累计得分（信息分层）
- 本地结构化为 ScenarioGuidance（不调用 Qwen）

**步骤 5：第二轮问卷生成**
- 题型：4 半具体 + 4 具体（与第一轮互补）
- 输入：第一轮答案 + 中途反馈 + 题号引用
- 相似度算法：方案 B（Jaccard 分词比例，阈值 0.7）
- 失败处理：单题 fallback（同步骤 2）
- 暂不实现"模糊维度"逻辑（避免过度复杂）

**步骤 6：第二轮问卷作答**
- 完全复用步骤 3，仅数据指向不同
- 完成后跳转报告生成页

**过渡动画页**
- 保留 QuestionnaireGenerating（问卷生成）
- 保留 HolographicLoading（报告生成）
- 仅微调文案（区分第一轮 / 第二轮）

**步骤 7：报告生成**
- 报告页基本沿用原格式（幻灯片 + 海报）
- 5 项内容优化：维度三段式、Prompt 真实任务绑定、发现具体化、答题明细分轮、本次报告基于
- 服务端整理高信号摘要（不堆全量数据给模型）
- 模型只输出叙事层（不重算分数、不决定人格）
- 新增 reportContentValidation：placeholder/空词/句式重复检查

**附录**
- DeepSeek API 迁移方案：支持工具调用 + strict 模式，完全可替代 Qwen
