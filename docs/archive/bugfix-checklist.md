# Bug 修复执行清单

## 第一批：阻塞性 bug（必须立即修复）

### ✅ 问题 2：报告页跳转到首页（5 分钟）

**文件：** `src/app/report/page.tsx`

**位置：** 第 492-501 行

**改动：**
```typescript
// 旧代码（498-501 行）
if (!historyStr) {
  router.push("/");
  return;
}

// 新代码
const hasNewFlowData = sessionStateStr && answersStr;
const hasOldFlowData = historyStr;

if (!hasNewFlowData && !hasOldFlowData) {
  router.push("/");
  return;
}
```

**测试：** 完成新流程后检查报告页是否正常加载

---

### ✅ 问题 1：题干出现"在...时时"（25 分钟）

#### 1.1 前端智能去重（15 分钟）

**文件：** `src/lib/questionText.ts`

**位置：** `buildQuestionStem` 函数（第 12-32 行）

**改动：** 见 `bugfix-plan.md` 问题 1 方案 A 的完整代码

**关键逻辑：**
1. 检测 question 是否已包含完整场景描述
2. 如果是，直接使用 question，不拼接
3. 如果 question 开头包含 scenario，去掉重复部分

**测试：**
- 生成问卷后检查所有题干
- 特别注意具体题（questionType="specific"）

#### 1.2 Prompt 强化约束（5 分钟）

**文件：** `src/lib/researcher.ts`

**位置：** `buildQuestionnaireGenerationPrompt` 函数，`<question_design>` 部分（约 406-412 行）

**改动：** 替换现有的 `<question_design>` 为 `bugfix-plan.md` 问题 1 方案 B 的内容

**关键增加：**
- 明确 scenario 格式（2-6 字任务类型）
- 强调题干不要包含场景前缀
- 增加正反例

#### 1.3 增加示例（5 分钟）

**文件：** `src/lib/researcher.ts`

**位置：** 在 `<question_design>` 之后增加 `<question_examples>`

**改动：** 见 `bugfix-plan.md` 问题 1 方案 C

**测试：** 生成几轮问卷，观察模型是否遵守约束

---

## 第二批：体验优化（建议尽快修复）

### ✅ 问题 3：进度卡在 90%（10 分钟）

**文件：** `src/app/interview/page.tsx`

**改动：**
1. 新增状态：`const [isQuestionnaireReady, setIsQuestionnaireReady] = useState(false);`
2. 在 `generateQuestions` 成功后：`setIsQuestionnaireReady(true);`
3. 延迟切换：`setTimeout(() => setPhase("answering"), 1500);`
4. 传递参数：`<QuestionnaireGenerating isReady={isQuestionnaireReady} />`

**详细代码：** 见 `bugfix-plan.md` 问题 3

**测试：** 观察两次生成页的进度条是否到 100%

---

### ✅ 优化 4：Prompt 优化（10 分钟）

**文件：** `src/lib/researcher.ts`

**位置：** `<question_design>` 部分

**改动：** 进一步明确 scenario 格式要求

**已包含在问题 1.2 中**

---

## 第三批：报告质量优化（可延后，2 小时）

### ⏸️ 问题 6：报告内容优化

**工作量：** 2 小时

**是否必须：** 否（不阻塞流程）

**详细方案：** 见 `bugfix-plan.md` 问题 6

**包含：**
- 维度分析三段式（userPattern + evidenceExplanation + caveat）
- Prompt 模板绑定真实任务
- styleOverview 具体化（pattern + tendency + evidence）
- 答题明细区分两轮
- "本次报告基于"区块

**建议：** 先完成第一批和第二批，再评估是否实施

---

## 第四批：可选优化

### ⏸️ 优化 5：验证增强（15 分钟）

**文件：** `src/lib/questionnaireValidation.ts`

**改动：** 增加 scenario 格式检查

**建议：** 先观察问题 1 修复后的效果，再决定是否需要

---

## 测试清单

### 问题 1 测试
- [ ] 生成第一轮问卷，检查所有题干
- [ ] 生成第二轮问卷，检查具体题
- [ ] 检查通用题是否正常（不应该有"在...时"前缀）
- [ ] 特别检查是否还有"在...时时"或嵌套场景

### 问题 2 测试
- [ ] 完成新流程（intake → batch1 → mid-feedback → batch2 → report）
- [ ] 确认报告页正常加载，不跳转到首页
- [ ] 确认旧流程（如果还保留）仍然正常工作

### 问题 3 测试
- [ ] 观察第一轮问卷生成页，进度条是否从 0% → 90% → 100%
- [ ] 观察第二轮问卷生成页，进度条是否正常
- [ ] 确认进度条到 100% 后平滑过渡到问卷页

### 回归测试
- [ ] 完整走一遍新流程
- [ ] 用户跳过 ≥3 题
- [ ] 用户在 intake 填写很长的 recentUse（>200 字）
- [ ] 用户在 mid-feedback 填写很具体的场景
- [ ] 第二轮生成失败重试

---

## 预期结果

### 修复后应该看到
✅ 题干流畅，不再有"在...时时"  
✅ 报告页正常加载  
✅ 进度条完整显示 0% → 100%  
✅ 模型生成的 scenario 更规范  

### 如果还有问题
- 题干仍有重复 → 检查 `questionText.ts` 的正则是否正确
- 报告页跳转 → 检查 sessionStorage 中是否有 `ai_mbti_session_state`
- 进度卡住 → 检查 `isReady` 是否正确传递

---

## 回滚方案

### 问题 1（题干去重）
如果前端去重逻辑有问题，可以暂时回退，只保留 Prompt 约束：
```typescript
// 临时回退：直接拼接，不去重
return {
  label: question.questionType === "specific" ? "真实场景" : "任务场景",
  stem: `在${scenario}时，${cleanQuestion}`,
};
```

### 问题 2（报告页）
如果新旧流程兼容有问题，可以暂时只支持新流程：
```typescript
if (!sessionStateStr || !answersStr) {
  router.push("/");
  return;
}
```

### 问题 3（进度条）
如果 isReady 传递有问题，可以暂时移除：
```typescript
<QuestionnaireGenerating />  // 不传 isReady，进度卡在 90%
```

---

## 完成标准

### 第一批（必须）
- [x] 问题 2 修复完成
- [x] 问题 1 修复完成
- [x] 通过测试清单

### 第二批（建议）
- [ ] 问题 3 修复完成
- [ ] 优化 4 完成
- [ ] 通过测试清单

### 第三批（可选）
- [ ] 问题 6 评估是否实施
- [ ] 如果实施，通过测试

---

## 时间估算

- **第一批：** 30 分钟（阻塞性）
- **第二批：** 20 分钟（体验优化）
- **第三批：** 2 小时（报告质量）
- **测试：** 30 分钟

**总计（必须）：** 1 小时  
**总计（含可选）：** 3 小时
