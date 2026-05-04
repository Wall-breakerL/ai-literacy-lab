# Codex Phase 6 实现状态：两部分问卷与中途校准

> 本文记录 v6.0 当前实现状态。Phase 6 的产品方向已经落到主链路：固定 24 题、两部分 8+16、一轮中途对话。旧版 16/20 单问卷仍作为 legacy compatibility 保留，但不是当前主流程口径。

## 1. 已落地的产品决策

1. **24 题固定结构**  
   当前主流程固定两部分，第一部分 8 题、第二部分 16 题，总计 24 题。第一部分四维各 2 题、4 习惯 + 4 场景；第二部分四维各 4 题、8 习惯 + 8 场景；两部分合计每维 4 正向 + 2 反向。

2. **一轮中途对话保留**  
   第一部分后进入 `mid_dialog1`。中途对话用于采集题目贴合度、跳过原因、真实场景和颗粒度偏好。

3. **用户反馈结构化落地**  
   用户说不合适、太具体、换场景、没有类似经历等反馈，需要写入 `scenarioGuidance` 和必要的 `refinedTargetContext`，供第二部分生成使用。

4. **问卷生成等待文案**  
   问卷生成状态使用“个性化生成问卷中”，避免把问卷生成说成“分析对话中”。

5. **服务端计分边界不变**  
   TypeScript 负责计分、反向题、跳过题和 confidence；LLM 只写解释。

## 2. 当前代码事实

- `/interview` 已是 Phase 6 客户端状态机：背景访谈、两部分问卷、一轮中途对话、报告跳转。
- `SessionState` 已包含 `questionnaireBatches`、`batchAnswers`、`midDialogues`、`refinedTargetContext`、`scenarioGuidance`。
- `SessionPhase` 已包含 `questionnaire_batch1`、`mid_dialog1`、`questionnaire_batch2`、`mid_dialog2`、`questionnaire_batch3`、`report`，并保留 legacy recovery / questionnaire phase。
- `/api/questionnaire/generate` 已生成 8+16 两部分，并在模型失败或校验失败时回落到 batch fallback。
- `validateQuestionnaireBatch` 校验 8+16 批次结构；`validateQuestionnaireTotal` 校验 24 题总结构。
- `FALLBACK_QUESTIONNAIRE_BATCHES` 已提供 `hybrid_batch1` / `hybrid_batch2` 两套 fallback；`FALLBACK_QUESTIONNAIRE_TOTAL` 合并为 24 题。
- `reportScoring` 已支持 24 题；confidence 阈值为 `>=4 high`、`2-3 medium`、`<2 low`。
- `/api/report` 已通过 `resolveReportQuestionnaireAnswers` 支持 `questionnaireAnswers`、`sessionState.answers`、`sessionState.batchAnswers` 优先级兜底。
- `/test-lab` 当前可见测试只运行 AI-MBTI self-tests；AI-HQ 区块显示 skipped。

## 3. 状态与数据契约

核心类型在 `src/lib/types.ts`：

```ts
type QuestionnaireBatchKey = "batch1" | "batch2" | "batch3";
type QuestionnaireBatchMode = "hybrid_batch1" | "hybrid_batch2";
type MidDialogueKey = "dialog1" | "dialog2";

type SessionPhase =
  | "interview"
  | "questionnaire_batch1"
  | "mid_dialog1"
  | "questionnaire_batch2"
  | "mid_dialog2"
  | "questionnaire_batch3"
  | "questionnaire"
  | "recovery_interview"
  | "recovery_questionnaire"
  | "report";
```

`SessionState` 保留扁平 `questionnaire` / `answers` 字段作为报告和 legacy 兼容，同时维护批次字段：

```ts
questionnaireBatches?: Partial<Record<QuestionnaireBatchKey, QuestionnaireQuestion[]>>;
batchAnswers?: Partial<Record<QuestionnaireBatchKey, QuestionnaireAnswer[]>>;
midDialogues?: Partial<Record<MidDialogueKey, Message[]>>;
refinedTargetContext?: TargetContext;
scenarioGuidance?: ScenarioGuidance;
```

## 4. 批次生成契约

`POST /api/questionnaire/generate` 输入：

- `sessionState`
- `batchMode`
- `existingQuestions`
- `scenarioGuidance?`

输出：

- `questions`
- `sessionState`
- `message`
- `batchMode`
- `source`
- `retryCount`
- `validationIssue?`
- `warnings`

批次规则：

- `hybrid_batch1`：8 题，4 道 `scenario: "习惯"`，4 道具体或半具体场景。
- `hybrid_batch2`：16 题，8 道 `scenario: "习惯"`，8 道具体或半具体场景。
- 第一部分四维各 2 题、每维 2 正向 + 0 反向；第二部分四维各 4 题、每维 2 正向 + 2 反向。
- 两部分合计每维 6 题、4 正向 + 2 反向。
- 传入 `existingQuestions` 后，题干相似度过高会触发重试；仍失败则 fallback。

## 5. 中途对话契约

`ScenarioGuidance` 是中途对话的主要产物：

```ts
type MidDialogueStatus =
  | "confirmed"
  | "refined"
  | "abstract_scenarios"
  | "needs_more_context"
  | "exit_requested";

interface ScenarioGuidance {
  status: MidDialogueStatus;
  scenarioSummary: string;
  granularity: "specific" | "balanced" | "abstract";
  avoidTopics: string[];
  includeTopics: string[];
  userCorrectionQuote?: string;
}
```

处理规则：

- 用户说继续或没问题：`confirmed`，生成第二部分。
- 用户给出真实场景修正：`refined`，更新 `refinedTargetContext`。
- 用户说场景太具体：`abstract_scenarios`，后续降低具象程度。
- 用户反馈不清：不继续追问，按当前场景生成第二部分。
- 用户明确不想继续：`exit_requested`，不生成低质量报告。

## 6. 前端状态机

当前 `/interview` 流程：

1. 背景访谈完成后生成 batch1。
2. batch1 答完后保存 `batchAnswers.batch1` 和扁平 `answers`，进入 `mid_dialog1`。
3. `mid_dialog1` 完成后生成 batch2。
4. batch2 答完后展平答案并进入报告页。

UI 要点：

- 显示批次进度和当前批次内进度。
- 中途对话复用聊天界面。
- 生成问卷时显示“个性化生成问卷中”。
- 遇到不贴近或无经验题，用户选择「不了解 / 没想好」，不计分。

## 7. 评分与报告

`scoreQuestionnaireAnswers` 支持 24 题，不对题量做单独假设。

- 跳过题不计分。
- 24 题全答时每维 6 题。
- 4/6 有效答案即 high confidence。
- 老的 16 题扁平答案仍可生成报告，但属于 legacy compatibility。

报告 prompt 可以引用中途对话修正，例如“用户中途把场景从 X 调整为 Y”。最终分数、倾向、证据、personality 和 targetContext 由服务端合并。

## 8. 当前测试覆盖

`src/lib/selfTests.ts` 中 AI-MBTI self-tests 覆盖：

- 正向/反向计分。
- 「不了解 / 没想好」不计分。
- Phase 6 24 题计分。
- confidence 阈值。
- 跳过题不参与置信度和分数。
- `batchAnswers` 报告入口兜底。
- 两部分 fallback 结构合法，合并后为 24 题。
- hybrid 批次拒绝泛场景。
- 问卷去重检测。
- 中途对话可见文案不泄漏内部提示。
- 四维报告补齐。
- 人格 code 与 16 型配置。
- Phase 5 可携带产物兜底。
- signature detail JSON 解包。
- 题面合成。
- targetContext 兜底。

`/test-lab` 当前只运行 AI-MBTI self-tests，并通过页面内的结构化 summary 给 `npm run test:browser` 校验。不要把这描述成 API E2E。

## 9. 剩余风险

- legacy `GENERATE_QUESTIONNAIRE_TOOL` 和 16/20 单问卷路径仍存在，文档应持续标记为 compatibility，避免被误认为主链路。
- stream 与 non-stream 路径需要在每次改动后人工或 smoke 确认行为一致。
- 中途对话依赖模型遵守 tool schema；当前有文本清洗和补写过渡话，但仍需关注用户可见文案质量。
- Notion/LLM 网关能力不属于 self-tests 覆盖范围，需要通过 `npm run check:llm`、`npm run check:llm-tools` 和人工 smoke 单独确认。
