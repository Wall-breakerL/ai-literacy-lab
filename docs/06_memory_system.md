# 记忆层

## 三层区分

| 层级 | 用途 | 存储位置 | 生命周期 |
|------|------|----------|----------|
| **SessionMemory** | 当前会话恢复（刷新不丢） | `sessionStorage`（`ai-literacy-session-v2`） | 会话内 |
| **UserMemoryCard** | 同一被试长期画像 | `data/runtime/users/{userId}.json` | 持久 |
| **ExperienceBank** | 匿名/研究用体验记录 | `data/runtime/experiences/{sessionId}.json` | 持久 |

**不将 UserMemory 反写进 rubric 定义**；不改变 Judge prompt 线上版本。

---

## SessionMemory

- 文件：`lib/memory/session-storage.ts`
- Key：`SESSION_STORAGE_KEY_V2` = `"ai-literacy-session-v2"`
- 内容：`PersistedSessionV2`（sessionId、scenarioId、identityId、phase、messages、debriefIndex、debriefQuestions、talkPrompt）
- 读写：`app/chat/[scenarioId]/page.tsx` 在 mount 时恢复，提交评估后清除

---

## UserMemoryCard

- 文件：`lib/memory/user-memory.ts`
- 路径：`data/runtime/users/{userId}.json`
- 内容：历史体验汇总，用于后续场景/难度建议
- API：`GET /api/memory?type=user&id={userId}`
- **当前状态**：已存储但未在结果页利用（待完善）

---

## ExperienceBank

- 文件：`lib/memory/experience-card.ts`
- 路径：`data/runtime/experiences/{sessionId}.json`
- 内容：每次评测的匿名记录，供离线分析

### ExperienceCard 结构

```typescript
type ExperienceCard = {
  sessionId: string;
  identityId: string;
  userId?: string;
  scenarioId: string;
  transcriptSummary: string;           // 截断摘要，避免完整对话入库
  eventSummary: Record<string, number>;
  dimensionScores: Record<string, number>;
  evidence: Record<string, string[]>;
  blindSpots: string[];
  nextRecommendedScenarios: string[];
  nextRecommendedProbes: string[];
  phaseScores?: PhaseScoreSummary[];  // 两段式时
  talkPrompt?: string;
  phaseSwitchTurn?: number;
  versions: {                          // 全链路版本追溯
    identityVersion: string;
    scenarioVersion: string;
    blueprintVersion: string;
    rubricVersion: string;
    eventSchemaVersion: string;
    memorySchemaVersion: string;
    judgePromptVersion: string;
    judgeModel: string;
    scoredAt: string;
  };
  createdAt: string;
};
```

API：`GET /api/memory?type=experience&id={sessionId}`

---

## 隐私说明

`transcriptSummary` 默认做截断（400 字符）与事件/分数摘要，避免完整对话入库。正式研究请补充同意流程与脱敏策略。

---

## 离线校准

- **脚本**：`npm run calibrate` → `scripts/calibrate.mjs`
- **输出**：`reports/calibration_aggregate.json`、`reports/rubric_drift_summary.md`
- **内容**：experience 计数、探针覆盖缺口聚合、场景池频次、**judge prompt revision candidates**（需人工审核，**非自动上线**）
