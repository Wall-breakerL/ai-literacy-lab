# 场景蓝图系统

## 概述

场景蓝图（ScenarioBlueprint）是嵌入了隐性评估探针的叙事骨架。系统在用户对话过程中注入探针，评估用户对 AI 输出可靠性、边界与协作质量的感知与应对能力。

场景数据来源唯一：`data/scenario-blueprints/*.json`

---

## 蓝图 Schema（v2.0）

### 顶层字段

```typescript
type ScenarioBlueprint = {
  id: string;                  // 全局唯一标识，如 "coordination_student_v1"
  pack: ScenarioPack;           // 场景包分类
  family: string;              // 场景族
  applicableIdentityTags: string[];

  // --- v2 两段式字段（优先使用）---
  phases?: {
    helper: HelperPhaseSpec;
    talk: TalkPhaseSpec;
  };
  phaseSwitchPolicy?: PhaseSwitchPolicy;

  // --- 兼容单段蓝图（phases 存在时忽略）---
  assistantRolePrompt: string;
  worldState: string;
  openingMessage: string;
  hiddenProbes: ProbeSpec[];
  turnPolicies: { maxTurns?: number; minUserTurns?: number; allowEarlyFinish?: boolean };
  successSignals: string[];
  stopConditions: string[];

  debriefQuestions: string[];   // 收尾反思问题（3 个）
  version: "2.0";
};
```

### HelperPhaseSpec — Phase 1

```typescript
type HelperPhaseSpec = {
  type: "helper";
  assistantRolePrompt: string; // AI 助手角色描述
  worldState: string;           // 情境背景（不暴露给用户）
  openingMessage: string;       // 首条 AI 消息
  hiddenProbes: ProbeSpec[];    // 隐性探针
  turnPolicies: {
    maxTurns?: number;         // 最大回合数
    minUserTurns?: number;     // 最少用户回合数
    allowEarlyFinish?: boolean;
  };
  successSignals: string[];     // 成功信号（用于判断何时可切换 phase）
  stopConditions: string[];     // 停止条件
};
```

### TalkPhaseSpec — Phase 2

```typescript
type TalkPhaseSpec = {
  type: "talk";
  assistantRolePrompt: string;
  openingMessage: string;
  hiddenProbes: ProbeSpec[];
  defaultTalkPrompt: string;     // 用户留空时使用的默认讨论引导
  talkPromptPolicy?: {
    allowEmptyPrompt?: boolean;
    maxChars?: number;
  };
  talkSafety: TalkSafety;       // 安全门控
  turnPolicies: { maxTurns?: number; minUserTurns?: number };
};
```

### ProbeSpec — 隐性探针

```typescript
type ProbeSpec = {
  probeId: string;
  targetDimensions: string[];     // 目标评分维度
  injectionTiming: "opening" | "after_turn_n" | "on_signal" | "before_close";
  injectionTurn?: number;         // injectionTiming=after_turn_n 时使用
  assistantMove: string;          // AI 侧注入动作描述（不暴露给用户）
  positiveSignals: string[];       // 正面信号关键词
  negativeSignals: string[];       // 负面信号关键词
  severity: "low" | "medium" | "high";
};
```

### PhaseSwitchPolicy — 阶段切换策略

```typescript
type PhaseSwitchPolicy = {
  trigger: "user_explicit" | "min_turns_reached" | "stop_condition_met";
  minPhase1UserTurns: number;    // 最少在 Phase 1 说多少句才允许切换
};
```

---

## 探针注入机制

系统不在代码里硬编码探针行为，而是通过 `hiddenProbes` 数组声明探针意图，由 `lib/llm/chat.ts` 的 system prompt 隐式传达给 AI 对话模型。

- **positiveSignals / negativeSignals**：供 Judge 和事件提取器使用，AI 不可见
- **severity**：影响探针在评分中的权重

---

## 场景包（ScenarioPack）

| Pack | 说明 |
|------|------|
| `coordination` | 协作对齐类（如小组分工、时间对齐） |
| `verification` | 事实核验类 |
| `decision` | 决策判断类 |
| `risk_boundary` | 边界与风险类 |

---

## 场景匹配与候选生成

详见 [07_api_reference.md](./07_api_reference.md)。

---

## 现有场景

| ID | Pack | 说明 |
|----|------|------|
| `coordination_student_v1` | coordination | 大三学生，小组作业 deadline 前分工对齐 |

详情见 `data/scenario-blueprints/coordination_student_v1.json`。
