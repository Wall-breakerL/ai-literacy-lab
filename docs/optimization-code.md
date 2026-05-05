# 优化代码详细实现

## 优化 1：问卷题干质量

### 方案 A：前端智能去重

**文件：** `src/lib/questionText.ts`

**替换 `buildQuestionStem` 函数：**

```typescript
export function buildQuestionStem(question: QuestionnaireQuestion): {
  label: string;
  stem: string;
} {
  const habit = isHabitScenario(question.scenario);
  const cleanQuestion = question.question.trim();
  
  if (habit) {
    return {
      label: question.questionType === "universal" || question.scenario.trim() === "通用" ? "通用倾向" : "日常习惯",
      stem: cleanQuestion,
    };
  }

  const scenario = trimSentenceEnd(question.scenario)
    .replace(/^(如果|假设|当|在)\s*/, "")
    .trim();
  
  // 检查 question 是否已经是完整的场景描述（包含"在...时"或"...时"）
  // 如果是，直接使用 question，不再拼接
  if (/^(在.+[时的]时候?[，,]|.+[时的]时候?[，,])/.test(cleanQuestion)) {
    return {
      label: question.questionType === "specific" ? "真实场景" : "任务场景",
      stem: cleanQuestion,  // 直接使用，不拼接
    };
  }
  
  // 检查 question 开头是否包含 scenario 的内容
  const scenarioPattern = new RegExp(`^(在)?${scenario.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[时的]?[，,]?`);
  const questionWithoutPrefix = cleanQuestion.replace(scenarioPattern, '').trim();
  
  // 如果去掉前缀后 question 变空或太短，说明 question 本身就是场景描述，直接用原 question
  if (questionWithoutPrefix.length < 5) {
    return {
      label: question.questionType === "specific" ? "真实场景" : "任务场景",
      stem: cleanQuestion,
    };
  }
  
  return {
    label: question.questionType === "specific" ? "真实场景" : "任务场景",
    stem: `在${scenario}时，${questionWithoutPrefix}`,
  };
}
```

**测试用例：**

```typescript
// 测试 1：正常情况
scenario: "写代码"
question: "我会先明确需求"
结果: "在写代码时，我会先明确需求" ✓

// 测试 2：question 已包含场景前缀
scenario: "写代码"
question: "写代码时，我会先明确需求"
结果: "我会先明确需求" ✓（去掉重复）

// 测试 3：question 是完整场景描述
scenario: "课程学习"
question: "在复习复杂课程内容时，我会先制定详细的学习大纲"
结果: "在复习复杂课程内容时，我会先制定详细的学习大纲" ✓（直接使用）

// 测试 4：通用题
scenario: "通用"
question: "我倾向于把 AI 当成讨论伙伴"
结果: "我倾向于把 AI 当成讨论伙伴" ✓（不拼接）
```

---

## 优化 2：报告内容质量

### 阶段 1：修改 schema

**文件：** `src/app/api/report/route.ts`

**修改 `GENERATE_REPORT_TOOL` 的 `dimensions` 字段：**

```typescript
dimensions: {
  type: "array",
  minItems: 4,
  maxItems: 4,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["dimension", "userPattern", "evidenceExplanation", "caveat"],
    properties: {
      dimension: {
        type: "string",
        enum: ["Relation", "Workflow", "Epistemic", "RepairScope"],
      },
      userPattern: {
        type: "string",
        minLength: 40,
        maxLength: 120,
        description: "行为模式：用户在实际用 AI 时表现为什么动作，40-120 字。",
      },
      evidenceExplanation: {
        type: "string",
        minLength: 40,
        maxLength: 120,
        description: "证据解释：引用用户原话、题目回答或中途反馈，说明为什么得出这个判断，40-120 字。",
      },
      caveat: {
        type: "string",
        minLength: 30,
        maxLength: 80,
        description: "边界提示：说明这不是能力等级，只是协作倾向，30-80 字。",
      },
    },
  },
},
```

**修改 `styleOverview` 字段：**

```typescript
styleOverview: {
  type: "object",
  additionalProperties: false,
  required: ["patterns"],
  properties: {
    patterns: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pattern", "tendency", "evidence"],
        properties: {
          pattern: {
            type: "string",
            minLength: 30,
            maxLength: 50,
            description: "用户做过什么（具体行为）。",
          },
          tendency: {
            type: "string",
            minLength: 20,
            maxLength: 40,
            description: "反映了什么倾向（维度解释）。",
          },
          evidence: {
            type: "string",
            minLength: 10,
            maxLength: 30,
            description: "来自哪道题或用户原话（题号或引用）。",
          },
        },
      },
    },
  },
},
```

**修改 `promptTemplates` 字段：**

```typescript
promptTemplates: {
  type: "array",
  minItems: 1,
  maxItems: 2,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["title", "useCase", "prompt", "boundToUserScenario"],
    properties: {
      title: { type: "string" },
      useCase: {
        type: "string",
        description: "必须基于用户的 recentUse 或 scenarioSummary，不能是通用场景。",
      },
      prompt: {
        type: "string",
        minLength: 100,
        description: "Prompt 模板，必须包含用户的具体任务，不能有 [任务目标]、[你的场景] 等 placeholder。",
      },
      boundToUserScenario: {
        type: "boolean",
        description: "是否绑定了用户真实场景，必须为 true。",
      },
    },
  },
},
```

---

### 阶段 2：修改 REPORT_SYSTEM prompt

**文件：** `src/lib/reportAgent.ts`

**在 `REPORT_SYSTEM` 开头增加：**

```typescript
export const REPORT_SYSTEM = `你是一位AI使用习惯分析专家，负责根据服务端已计算好的问卷得分生成最终的AI-MBTI分析报告。

【维度分析三段式】
每个维度必须输出三个字段：
1. userPattern：用户在实际用 AI 时表现为什么动作（行为描述，40-120 字）
2. evidenceExplanation：引用用户原话、题目回答或中途反馈，说明为什么得出这个判断（40-120 字）
3. caveat：说明这不是能力等级，只是协作倾向（30-80 字）

示例：
userPattern: "你更像是先把 AI 放进同一个讨论桌的人：不会只丢任务等结果，也会期待它补充盲区。"
evidenceExplanation: "这个判断主要来自你在 Relation 维度几道伙伴协作题上的高分，以及你在中途反馈里希望题目更贴近真实场景的表达。"
caveat: "需要注意的是，它说明的是你更愿意和 AI 共创，不等于每次都会信任 AI 的输出。"

【Prompt 模板约束】
- useCase 必须基于用户的 recentUse 或 scenarioSummary，不能是"使用 AI 完成任务"这类泛目标
- prompt 必须包含用户的具体任务（如"写产品需求文档"、"优化 React 性能"），不能有 [任务目标]、[你的场景] 等 placeholder
- boundToUserScenario 必须为 true
- 如果用户的 recentUse 太泛（如"使用 AI 完成日常任务"），从 scenarioSummary 或答题内容中提取具体场景

【关于你 3 个值得记住的发现】
patterns 数组必须包含 3 条，每条包含：
- pattern：用户做过什么（来自题目回答或反馈，30-50 字）
- tendency：反映了什么倾向（维度解释，20-40 字）
- evidence：来自哪道题或用户原话（题号或引用，10-30 字）

示例：
pattern: "你在第 3 题'先明确目标'打了 5 分，在中途反馈提到'先列大纲'"
tendency: "这让你在 Workflow 维度偏向'框架型'"
evidence: "第 3 题 + 中途反馈原文"

...（其余 prompt 内容保持不变）
`;
```

---

### 阶段 3：修改前端展示

**文件：** `src/components/DimensionCard.tsx` 或相关组件

**按三段式渲染：**

```typescript
// 假设 dimension 对象现在有 userPattern, evidenceExplanation, caveat 字段

<div className="dimension-analysis">
  <div className="section user-pattern">
    <div className="section-icon">🎯</div>
    <h4 className="section-title">行为模式</h4>
    <p className="section-content">{dimension.userPattern}</p>
  </div>
  
  <div className="section evidence">
    <div className="section-icon">📊</div>
    <h4 className="section-title">证据解释</h4>
    <p className="section-content">{dimension.evidenceExplanation}</p>
  </div>
  
  <div className="section caveat">
    <div className="section-icon">💡</div>
    <h4 className="section-title">边界提示</h4>
    <p className="section-content">{dimension.caveat}</p>
  </div>
</div>
```

**样式建议：**

```css
.dimension-analysis {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  padding: 1rem;
  border-left: 3px solid var(--section-color);
  background: rgba(255, 255, 255, 0.02);
}

.section.user-pattern {
  --section-color: #55b3ff;
}

.section.evidence {
  --section-color: #5fc992;
}

.section.caveat {
  --section-color: #ffbc33;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--section-color);
  margin-bottom: 0.5rem;
}

.section-content {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
}
```

---

### 阶段 4：增加"本次报告基于"区块（可选）

**新建文件：** `src/components/ReportInputSummary.tsx`

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SessionState } from "@/lib/types";

interface ReportInputSummaryProps {
  sessionState: SessionState;
}

export function ReportInputSummary({ sessionState }: ReportInputSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  
  const batch1Skipped = sessionState.batchAnswers?.batch1?.filter(a => a.skipped || a.score == null).length ?? 0;
  const batch2Skipped = sessionState.batchAnswers?.batch2?.filter(a => a.skipped || a.score == null).length ?? 0;
  
  const getFeelingLabel = (status?: string) => {
    switch (status) {
      case "close": return "挺贴近的";
      case "neutral": return "一般";
      case "far": return "不太贴近";
      default: return "已确认";
    }
  };
  
  return (
    <div className="report-input-summary">
      <button
        onClick={() => setExpanded(!expanded)}
        className="summary-toggle"
      >
        {expanded ? <ChevronDown className="icon" /> : <ChevronRight className="icon" />}
        <span>本次报告基于</span>
      </button>
      
      {expanded && (
        <div className="input-list">
          <div className="input-item">
            <span className="check">✓</span>
            <span>你填写的职业：{sessionState.background.role}</span>
          </div>
          
          <div className="input-item">
            <span className="check">✓</span>
            <span>你填写的 AI 使用经历：{sessionState.background.recentUse}</span>
          </div>
          
          <div className="input-item">
            <span className="check">✓</span>
            <span>你常用的 AI 工具：{sessionState.background.tools.join('、')}</span>
          </div>
          
          <div className="input-item">
            <span className="check">✓</span>
            <span>第一轮 8 题回答（跳过 {batch1Skipped} 题）</span>
          </div>
          
          {sessionState.scenarioGuidance && (
            <div className="input-item">
              <span className="check">✓</span>
              <span>
                你的中途反馈：整体感受"{getFeelingLabel(sessionState.scenarioGuidance.status)}"
                {sessionState.scenarioGuidance.scenarioSummary && 
                  `，希望聚焦"${sessionState.scenarioGuidance.scenarioSummary}"`}
              </span>
            </div>
          )}
          
          <div className="input-item">
            <span className="check">✓</span>
            <span>第二轮 8 题回答（跳过 {batch2Skipped} 题）</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

**样式：**

```css
.report-input-summary {
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.summary-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.2s;
}

.summary-toggle:hover {
  color: rgba(255, 255, 255, 0.9);
}

.summary-toggle .icon {
  width: 1rem;
  height: 1rem;
}

.input-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.7);
}

.input-item .check {
  color: #5fc992;
  flex-shrink: 0;
}
```

**使用：**

在 `src/app/report/page.tsx` 或报告展示组件中：

```typescript
import { ReportInputSummary } from "@/components/ReportInputSummary";

// 在报告页顶部，四维光谱之前
<ReportInputSummary sessionState={sessionState} />
```

---

## 测试建议

### 优化 1 测试
1. 生成多轮问卷，检查题干格式
2. 特别注意具体题（questionType="specific"）
3. 检查是否还有"在...时时"

### 优化 2 测试
1. 生成报告，检查维度分析是否有三段式
2. 检查 Prompt 模板是否绑定了用户真实任务
3. 检查"关于你 3 个发现"是否有具体的行为 → 倾向绑定
4. 检查"本次报告基于"区块是否正常展示

---

## 回滚方案

### 优化 1
如果前端去重逻辑有问题，可以暂时回退：

```typescript
// 临时回退：直接拼接，不去重
return {
  label: question.questionType === "specific" ? "真实场景" : "任务场景",
  stem: `在${scenario}时，${cleanQuestion}`,
};
```

### 优化 2
如果三段式导致报告生成失败率上升，可以回退到单字段 `analysis`：

```typescript
// 回退 schema
dimensions: {
  items: {
    required: ["dimension", "analysis"],
    properties: {
      dimension: { ... },
      analysis: {
        type: "string",
        minLength: 80,
        description: "该维度的模型分析...",
      },
    },
  },
},
```
