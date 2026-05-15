# 问卷与报告优化方案

## 当前状态

✅ 已修复：
- 问题 2：报告页跳转到首页
- 问题 3：进度卡在 90%

🔧 待优化：
- **问题 1**：问卷题干质量（"在...时时"、嵌套场景）
- **问题 6**：报告内容未按设计优化

---

## 优化 1：问卷题干质量（高优先级）

### 问题描述

**严重情况：**
```
scenario: "课程学习"
question: "在复习复杂课程内容时，我会先制定详细的学习大纲..."
前端拼接: "在课程学习时，在复习复杂课程内容时，我会..."  ❌❌
```

**轻微情况：**
```
scenario: "写代码"
question: "写代码时，我会先明确需求"
前端拼接: "在写代码时，写代码时，我会..."  ❌
```

### 根源

1. **前端拼接逻辑**（`src/lib/questionText.ts:30`）无条件拼接 `在${scenario}时，`
2. **Prompt 约束不够强**（`src/lib/researcher.ts:410`）模型仍然生成带场景前缀的题干

### 修复方案

#### 方案 A：前端智能去重（必须，15 分钟）

**文件：** `src/lib/questionText.ts`

**核心逻辑：**
1. 检测 question 是否已包含完整场景描述（"在...时，..."或"...时，..."）
2. 如果是，直接使用 question，不拼接
3. 如果 question 开头包含 scenario，去掉重复部分
4. 如果去掉后太短，说明 question 本身就是完整描述

**完整代码见下一节**

---

#### 方案 B：Prompt 强化约束（必须，10 分钟）

**文件：** `src/lib/researcher.ts`

**位置：** `buildQuestionnaireGenerationPrompt` 函数的 `<question_design>` 部分（约 406-412 行）

**替换为：**

```xml
<question_design>
- 通用题 scenario 必须精确写成 "通用"，questionType="universal"。
- 半具体题 scenario 写 2-6 字任务类型（如"写代码"、"开会"、"学习"），questionType="semi_specific"。
- 具体题 scenario 写 4-12 字具体场景（如"写产品需求文档"、"优化 React 性能"），questionType="specific"。

【关键约束】题干格式：
- scenario 只写场景名称，不要写"...时"、"...的时候"等后缀。
- 题干（question）直接从"我..."开头，不要重复 scenario，不要写"在...时"、"...的时候"等场景前缀。

正确示例：
  scenario: "写代码"
  question: "我会先明确需求，再开始编写"  ✓
  
错误示例：
  scenario: "写代码"
  question: "写代码时，我会先明确需求"  ✗（重复了 scenario）
  question: "在写代码时，我会先明确需求"  ✗（包含场景前缀）
  question: "在复习复杂课程内容时，我会..."  ✗（question 本身就是完整场景描述）

- 题干避免和已有题目语义重复，第二部分尤其要和第一部分互补。
- userFacingMessage 用 1 句自然中文告诉用户这一部分题已经准备好，并提示点击按钮进入作答；不要解释维度、计分或内部分析。
</question_design>
```

---

#### 方案 C：增加示例（辅助，5 分钟）

**文件：** `src/lib/researcher.ts`

**位置：** 在 `<question_design>` 之后增加

**内容：**

```xml
<question_examples>
【Relation 维度示例】
✓ scenario: "团队协作", question: "我期待 AI 主动指出我可能忽略的问题"
✗ scenario: "团队协作", question: "团队协作时，我期待 AI 主动指出问题"
✗ scenario: "团队协作", question: "在团队协作时，我期待 AI 主动指出问题"

【Workflow 维度示例】
✓ scenario: "写需求文档", question: "我习惯先列大纲，再让 AI 帮我细化"
✗ scenario: "写需求文档", question: "写需求文档时，我习惯先列大纲"

【Epistemic 维度示例】
✓ scenario: "调试代码", question: "我会先验证 AI 给的方案，再实际应用"
✗ scenario: "调试代码", question: "调试代码时，我会先验证 AI 的方案"

【RepairScope 维度示例】
✓ scenario: "优化性能", question: "我更愿意重新思考整体架构，而不是只改局部"
✗ scenario: "优化性能", question: "在优化性能时，我更愿意重新思考架构"
</question_examples>
```

---

### 测试清单

- [ ] 生成第一轮问卷，检查所有题干
- [ ] 生成第二轮问卷，特别检查具体题
- [ ] 检查通用题是否正常（不应该有"在...时"前缀）
- [ ] 确认不再有"在...时时"或嵌套场景

---

## 优化 2：报告内容质量（中优先级，2 小时）

### 问题描述

`update-plan.md` 步骤 7 设计了 5 项报告内容优化，但未实施：

1. ❌ 维度分析改为三段式（userPattern + evidenceExplanation + caveat）
2. ❌ Prompt 模板绑定真实任务（基于 recentUse / scenarioSummary）
3. ❌ "关于你 3 个值得记住的发现"具体化（pattern + tendency + evidence）
4. ❌ 答题明细区分两轮 + 展示中途反馈
5. ❌ "本次报告基于"区块（透明度）

**当前实现：**
- 维度分析只有单字段 `analysis`（80+ 字）
- Prompt 模板没有强制绑定用户场景
- styleOverview 没有 evidence 字段

**影响：**
- 报告内容和旧版区别不大
- 用户看不到"我做过什么 → 反映了什么倾向"的具体绑定
- 维度分析容易写成计分说明

### 修复方案（分阶段）

#### 阶段 1：修改 schema（30 分钟）

**文件：** `src/app/api/report/route.ts`

**改动：** `GENERATE_REPORT_TOOL` 的 schema

**关键改动见下一节**

---

#### 阶段 2：修改 REPORT_SYSTEM prompt（20 分钟）

**文件：** `src/lib/reportAgent.ts`

**增加三段式说明和约束**

---

#### 阶段 3：修改前端展示（40 分钟）

**文件：** `src/components/ReportStoryExperience.tsx` 或相关组件

**按三段式渲染维度分析**

---

#### 阶段 4：增加"本次报告基于"区块（30 分钟，可选）

**新增：** `src/components/ReportInputSummary.tsx`

**展示用户输入清单**

---

### 是否实施？

**建议：** 先完成优化 1（问卷题干），再评估是否实施优化 2

**理由：**
- 优化 1 是阻塞性问题（用户明显感知）
- 优化 2 不阻塞流程，工作量较大（2 小时）
- 可以放到下一个迭代

---

## 实施顺序

### 立即执行（30 分钟）
1. **优化 1 方案 A**：前端智能去重（15 分钟）
2. **优化 1 方案 B**：Prompt 强化约束（10 分钟）
3. **优化 1 方案 C**：增加示例（5 分钟）

### 评估后决定（2 小时）
4. **优化 2**：报告内容优化（如果需要）

---

## 预期效果

### 优化 1 完成后
✅ 题干流畅，不再有"在...时时"  
✅ 题干不再有嵌套场景  
✅ 模型生成的 scenario 更规范  

### 优化 2 完成后（如果实施）
✅ 维度分析有明确的行为模式 + 证据 + 边界  
✅ Prompt 模板绑定用户真实任务  
✅ "关于你 3 个发现"有具体的行为 → 倾向绑定  
✅ 答题明细清晰展示两轮 + 中途反馈  

---

## 详细代码

见下一个文件：`optimization-code.md`
