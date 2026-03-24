# 身份层

## 流程：Setup → Select-Scenario

Setup 页提交后，dossier 的 `identityId` 通过 URL 参数传递给 Select-Scenario 页面，再由 Select-Scenario 传入 `/api/evaluate`：

```
/setup         POST /api/identity → identityId
    ↓ redirect /select-scenario?identityId=xxx
/select-scenario POST /api/scenario-select → session → /evaluate
```

## B+ 方案：Prompt → 结构化提取

用户输入自由文本，系统自动提取为结构化维度，存入记忆库供横向查询。

```
用户输入 Prompt（自由文本）
    ↓
LLM 提取 → structuredSummary（必存）
    ↓
rawPrompt 原文保留（备份，供回溯）
    ↓
存入 data/runtime/identities/{id}.json
    ↓
ExperienceCard 嵌入 structuredSummary → 记忆库可按维度查询
```

---

## IdentityDossier

```typescript
type IdentityDossier = {
  identityId: string;
  source: IdentitySource;                    // "manual_prompt" | "structured_form" | "default_profile"
  rawPrompt: string;                        // 用户原文（B+ 方案中 manual_prompt 必填）
  compiledPrompt: string;                    // 编译后（拼入 Chat/Judge system prompt）
  structuredSummary: IdentityStructuredSummary;
  version: string;
  createdAt: string;
};
```

## IdentityStructuredSummary — 7 个结构化维度

| 字段 | 说明 | 填写建议 |
|------|------|----------|
| `roleContext` | 角色与情境 | 被测者的身份、当前处境，如「大三学生、课程作业冲刺阶段」 |
| `domain` | 领域 | 协作任务所属领域，如「学术写作」「数据分析」「产品设计」 |
| `goals` | 目标（数组） | 被测者想达成的结果，如「完成报告」「核实引用」 |
| `constraints` | 约束（数组） | 对 AI 输出的格式、风格、边界要求 |
| `communicationStyle` | 沟通风格 | 偏好自然/正式/简洁/详细等 |
| `aiFamiliarity` | 对 AI 熟悉度 | 新手 / 一般 / 熟练 |
| `riskSensitivity` | 风险敏感度 | 对隐私、责任、风险边界问题的关注程度：低 / 中 / 高 |

---

## 两种来源的处理差异

| 路径 | structuredSummary 来源 | rawPrompt |
|------|------------------------|-----------|
| `manual_prompt`（用户自由输入） | LLM 自动提取 | 完整原文（必填） |
| `structured_form`（直接提交表单） | 直接传入 | 置空（不需要原文备份） |
| `default_profile`（跳过 setup） | 系统默认 | 系统默认文本 |

---

## 编译流程（compiler.ts）

`POST /api/identity` 调用 `compileIdentityDossier`：

1. `source === "manual_prompt"`：调用 `extractIdentitySummary(rawPrompt)`（LLM 提取），结果与原文一起存入 dossier
2. `source === "structured_form"`：直接使用传入的 `structuredSummary`，rawPrompt 置空
3. `compiledPrompt` 生成：拼接身份上下文块，供 Chat/Judge system prompt 使用

### LLM 提取模块（extractor.ts）

`extractIdentitySummary(prompt)` 调用 OpenAI 兼容接口，使用 `gpt-4o-mini` 提取 JSON 结构。提取失败时返回空对象（不阻断流程）。

---

## 持久化

```
POST /api/identity  →  data/runtime/identities/{identityId}.json
```

## 与记忆库的关系

`ExperienceCard` 在评测完成后嵌入 `identitySummary`：

```typescript
type ExperienceCard = {
  identityId: string;
  identitySummary?: IdentityStructuredSummary;  // 可按维度查询
  // ...
};
```

支持按 `roleContext`、`aiFamiliarity`、`riskSensitivity` 等字段过滤 ExperienceBank，实现跨被试分组分析。

---

## 与评分的关系

身份作为隐藏上下文注入 Judge prompt（`lib/llm/judge-v2.ts` 的 `identityCompiled` 段），影响 Judge 对「该用户在这个场景下的合理期待」的判断。
