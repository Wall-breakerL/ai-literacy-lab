# 记忆层与离线校准

## 1. 三层区分

| 层级 | 用途 | 实现要点 |
|------|------|----------|
| **SessionMemory** | 当前会话恢复（刷新不丢） | `localStorage` key `ai-literacy-session-v2`（`lib/memory/session-storage.ts`），由 chat 页读写。 |
| **UserMemoryCard** | 同一被试长期画像，仅影响后续场景/难度建议 | `data/runtime/users/{userId}.json`；`mergeUserMemoryWithExperience`（`lib/memory/user-memory.ts`）；评估后由 `/api/evaluate` 更新。 |
| **ExperienceBank** | 匿名/研究用 experience，供离线分析 | `data/runtime/experiences/{sessionId}.json`；`buildExperienceCard`（`lib/memory/experience-card.ts`）。 |

**不将 UserMemory 反写进 rubric 定义**；不改变 Judge prompt 线上版本。

## 2. ExperienceCard 与版本字段

每次 v2 评测写入 experience 文件，内含：

- `identityVersion`、`scenarioVersion`、`blueprintVersion`、`rubricVersion`、`eventSchemaVersion`、`memorySchemaVersion`、`judgePromptVersion`、`judgeModel`、`scoredAt`

详见 `lib/memory/experience-card.ts`。

## 3. API

- `GET /api/memory?type=user&id={userId}`  
- `GET /api/memory?type=experience&id={sessionId}`  

仅本地 file-json；生产环境应替换存储实现。

## 4. 离线校准

- **脚本**：`npm run calibrate` → `scripts/calibrate.mjs`  
- **输出**：`reports/calibration_aggregate.json`、`reports/rubric_drift_summary.md`  
- **内容**：experience 计数、探针覆盖缺口聚合、场景池频次、**judge prompt revision candidates**（需人工审核，**非自动上线**）。

## 5. 隐私说明

`transcriptSummary` 默认做截断与事件/分数摘要，避免完整对话入库；正式研究请补充同意流程与脱敏策略。
