# 身份层

## IdentityDossier

评估者预先配置「被测者是谁」，编译为隐藏 system 上下文，不逐字展示给被测者。

```typescript
type IdentityDossier = {
  identityId: string;
  source: IdentitySource;                    // "manual_prompt" | "structured_form" | "default_profile"
  rawPrompt: string;                         // 用户原始输入
  compiledPrompt: string;                    // 编译后（确定性拼接）
  structuredSummary: IdentityStructuredSummary;
  version: string;
  createdAt: string;
};

type IdentityStructuredSummary = {
  roleContext: string;      // 角色背景
  domain: string;           // 领域
  goals: string[];          // 目标
  constraints: string[];     // 约束条件
  communicationStyle: string; // 沟通风格
  aiFamiliarity: string;     // AI 熟悉程度
  riskSensitivity: string;   // 风险敏感度
};
```

## 来源（IdentitySource）

| 来源 | 说明 |
|------|------|
| `manual_prompt` | 用户粘贴一段身份描述 |
| `structured_form` | 填结构化表单（当前未实现 UI） |
| `default_profile` | 未走 /setup 或无有效 identityId 时，系统自动生成默认身份 |

## 编译

`lib/identity/compiler.ts` 执行确定性拼接，将 `rawPrompt` 或表单数据编译为 `compiledPrompt`，注入 Chat system prompt。

## 持久化

```
POST /api/identity  →  data/runtime/identities/{identityId}.json
```

## 与评分的关系

身份作为隐藏上下文注入 Judge prompt（`lib/llm/judge-v2.ts` 的 `identityCompiled` 段），影响 Judge 对「该用户在这个场景下的合理期待」的判断。
