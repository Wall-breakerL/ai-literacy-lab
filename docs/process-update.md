# AI-MBTI 流程改版方案备忘

## 0. 本轮目标

第一批测试反馈集中在两件事：

- 开局对话偏枯燥，用户感觉像在被机械追问。
- 问卷题面偏僵硬，且偶发语法问题。

本文件先整理当前真实流程，并提出改成「信息收集页 -> 第一轮问卷 -> 中途反馈页 -> 第二轮问卷 -> 报告页」的迁移方案。

当前先只讨论两条主线：

1. 问卷收集情况如何稳定进入后续流程。
2. 报告页结构如何与两轮问卷和中途反馈保持一致。

以下事项后续需要单独细致讨论，本文只记录边界，不提前定死：

- 更新后每次流程的结构化结果设计。
- 报告页与问卷结构的详细对齐方式。

已明确的边界：

- 信息收集页只收两项：职业 / 身份、具体 AI 使用经历。
- 中途反馈页收三项：第一轮整体感受、题目问题反馈、第二轮希望聚焦的真实场景。
- 信息收集页和中途反馈页均本地结构化，不调用 Qwen 做表单归一化。
- 模型只负责问卷生成和报告生成，不负责表单归一化。

## 1. 当前流程梳理

当前 v6.0 主流程是：

```text
访谈页自动开场
  -> 用户回答职业/身份
  -> Qwen 追问 AI 使用场景
  -> 用户回答 AI 使用场景
  -> 第一部分问卷生成页
  -> 第一部分问卷作答
  -> 中途对话开场
  -> 用户回复中途反馈
  -> 第二部分问卷生成页
  -> 第二部分问卷作答
  -> 报告生成页
  -> 报告页 / 反馈入口
```

关键代码位置：

| 阶段 | 当前触发 | 当前模型 / 逻辑入口 |
|---|---|---|
| 自动开场 | `src/app/interview/page.tsx` mount 后调用 `triggerTurn([], 0)` | `src/app/api/chat/route.ts` 的 `createModelOpeningMessage` |
| 背景访谈 | 用户在聊天框发消息 | `src/app/api/chat/route.ts` -> `createResearcherMessageWithFallback` |
| 背景访谈 prompt | Qwen 负责承接与追问 | `src/lib/researcher.ts` 的 `buildResearcherToolPrompt` / `buildInitialInterviewRoundInstruction` |
| 第一轮问卷生成 | 前端调用 `/api/questionnaire/generate` | `src/app/api/questionnaire/generate/route.ts` -> `buildQuestionnaireBatchPrompt` |
| 中途开场 | 第一轮答完后调用 `/api/mid-dialog/opening` | `src/app/api/mid-dialog/opening/route.ts` -> `buildMidDialogueOpeningPrompt` |
| 中途反馈解析 | 当前前端本地规则解析，不再走 Qwen tool | `src/app/interview/page.tsx` 的 `buildOneShotScenarioGuidance` |
| 第二轮问卷生成 | 使用 `scenarioGuidance` 调 `/api/questionnaire/generate` | 同第一轮，`batchMode=hybrid_batch2` |
| 报告生成 | 报告页读取 sessionStorage 后调用 `/api/report` | `src/app/api/report/route.ts` |

当前数据结构的核心是 `SessionState`：

- `background.role`：职业/身份。
- `background.recentUse`：近期 AI 使用场景。
- `background.goal` / `goalStatus` / `goalType`：目标上下文。
- `questionnaireBatches.batch1/batch2`：两轮题目。
- `batchAnswers.batch1/batch2`：两轮答案。
- `scenarioGuidance`：中途反馈对第二轮的影响。
- `refinedTargetContext`：中途反馈后修正过的目标上下文。

报告入口当前会优先使用请求体 `questionnaireAnswers`，没有时使用 `sessionState.answers`，再兜底展开 `sessionState.batchAnswers`。计分仍由 `src/lib/reportScoring.ts` 确定性完成，LLM 只写解释和建议。

## 2. 当前流程的问题判断

### 2.1 开局对话为什么容易枯燥

当前开局对话本质是两轮信息采集，但被包装成聊天：

1. 第 0 轮模型只问职业或身份。
2. 第 1 轮模型只追问主要 AI 使用场景。
3. 第 2 轮后立即进入问卷。

prompt 还明确限制「前两轮保持轻量，不深挖四维度、协作类型或测评倾向」。这保证了流程快，但也导致用户看到的是很短的机械问答，而不是有价值的访谈。

如果目标是快速进入测试，继续用聊天 UI 反而会让用户期待「被理解」，实际体验却只是填表。因此把这两轮收敛成信息收集页更符合真实产品行为。

### 2.2 问卷为什么容易僵硬

当前 `buildQuestionnaireBatchPrompt` 主要约束题目结构：

- 8 + 16 两批题数。
- 四维分布。
- 正反向题分布。
- 习惯题 / 场景题比例。
- 题干第一人称陈述句。
- 题目不重复。

但它没有足够强的中文题面质量约束，例如：

- 不允许病句、长句堆叠、机器翻译腔。
- 不允许「当我在某某场景时，我会……」这种过度模板化题面连续出现。
- 不允许把职业、目标、工具名硬塞进题干导致语法不顺。
- 不要求生成前先把用户输入改写成自然场景词表。

所以后续优化不只是改 UI，还要重新设计问卷 prompt 和问卷生成后的语言质量校验。

## 3. 目标流程

建议改成：

```text
入口页
  -> 信息收集页
       字段 1：职业 / 身份
       字段 2：具体 AI 使用经历
  -> 第一轮问卷生成页
  -> 第一轮问卷作答
  -> 中途反馈页
       用户填写第一轮感受、题目问题、希望第二轮更贴近的场景
  -> 第二轮问卷生成页
  -> 第二轮问卷作答
  -> 报告生成页
  -> 报告页
```

这个改法的核心不是减少信息，而是把信息采集从「假装聊天」改成「明确表单」。用户知道自己正在提供背景，系统也能拿到更稳定的输入。

## 4. 新流程中的页面与数据职责

### 4.1 信息收集页

职责：

- 直接收集 `role`。
- 直接收集 `recentUse`，要求用户写具体 AI 使用经历。
- 初始化 `SessionState`。
- 跳过 `/api/chat` 的第 0-2 轮访谈调用。
- 本地结构化用户输入，不调用 Qwen。

建议字段：

| 字段 | 写入位置 | 说明 |
|---|---|---|
| 职业 / 身份 | `sessionState.background.role` | 不需要模型提取，用户原文清洗后直接写入 |
| 具体 AI 使用经历 | `sessionState.background.recentUse` | 用作第一轮问卷核心上下文 |
| 目标 | 不在第一版收集 | 先使用兜底目标，不增加表单负担 |

为了保证报告页可用，信息收集页至少要形成一个有效 `TargetContext`：

```ts
{
  role: 用户填写的职业,
  recentUse: 用户填写的具体 AI 使用经历,
  goal: "更有效地使用 AI",
  goalStatus: "missing",
  goalType: inferTargetContextFromMessages 或本地规则推断后的类型
}
```

第一版不增加「目标」字段。模型不负责把这两项表单输入归一化；必要的 `goalType` 可用本地规则推断，推不出则写 `other`。

### 4.2 第一轮问卷生成页

职责：

- 读取信息收集页产出的 `SessionState` / `TargetContext`。
- 调用 `/api/questionnaire/generate`，生成 `hybrid_batch1`。
- 进入第一轮 8 题作答。

暂不在本文细化第一轮 prompt。后续需要讨论：

- 第一轮问卷是否应该更像「轻量风格采样」。
- 第一轮是否继续保持 8 题。
- 第一轮是否仍然全正向题。
- 如何把用户填写的「具体 AI 使用经历」改写成自然、可出题的场景词表。

### 4.3 中途反馈页

职责：

- 替代当前聊天式 `mid_dialog1`。
- 显式收集用户对第一轮问卷的感受。
- 产出影响第二轮的 `scenarioGuidance`。
- 本地结构化用户反馈，不调用 Qwen。

设计成表单，而不是聊天：

| 字段 | 写入位置 | 说明 |
|---|---|---|
| 第一轮整体感受 | 中途反馈结构字段；可同步进 `scenarioGuidance.status` | 建议选项：挺贴近 / 一般 / 不太贴近 |
| 题目问题反馈 | `scenarioGuidance.avoidTopics` / `userCorrectionQuote` | 用户可写哪里不贴、哪里奇怪、哪里像病句 |
| 第二轮希望聚焦的真实场景 | `scenarioGuidance.includeTopics` / `scenarioSummary` | 直接影响第二轮场景题 |

第一版明确不引入中途反馈 Qwen 归一化。反馈页提交后由本地规则生成 `ScenarioGuidance`，同时保留用户原文，供第二轮问卷 prompt 和报告生成使用。

### 4.4 第二轮问卷生成页

职责：

- 读取第一轮答案、跳过情况、中途反馈页结构化结果。
- 调用 `/api/questionnaire/generate`，生成 `hybrid_batch2`。
- 进入第二轮 16 题作答。

暂不在本文细化第二轮 prompt。后续需要讨论：

- 第二轮是否承担「校准」作用，而不是只是补足题量。
- 第二轮是否应该明显回应中途反馈。
- 第二轮如何避免重复第一轮句式。
- 反向题如何写得自然，不像陷阱题或病句。

### 4.5 报告页

职责不变：

- 展示人格画像。
- 展示四维分数、倾向、证据、confidence。
- 展示建议、prompt 模板和完整答题明细。
- 提供反馈入口。

但报告生成需要更清楚地对齐新流程：

- 报告中的「背景」应来自信息收集页，而不是聊天 transcript。
- 报告中的「场景修正」应来自中途反馈页。
- 报告中的「题目证据」应能区分第一轮和第二轮。
- 答题明细应继续按 `batch1` / `batch2` 展开。

报告页的视觉格式和模块重排先不急着动。本阶段只保证新流程数据能稳定进入报告生成和现有报告页。

## 5. 与当前代码的迁移关系

### 5.1 可以保留的部分

- `SessionState` 大体可以继续使用。
- `questionnaireBatches` / `batchAnswers` 两批结构可以继续使用。
- `/api/questionnaire/generate` 可以继续作为问卷生成入口。
- `src/lib/reportScoring.ts` 的确定性计分逻辑应继续保留。
- `/api/report` 的基本合并逻辑可以继续使用。
- 报告页的四维卡片、答题明细、反馈入口可以继续保留。

### 5.2 需要替换或弱化的部分

- 访谈页的第 0-2 轮 `/api/chat` 调用应从主流程移除。
- `buildResearcherToolPrompt` 在主流程中的背景采集职责会弱化，可能只保留给 legacy / debug。
- `createModelOpeningMessage` 不再是主流程入口。
- 中途反馈页不应继续伪装成聊天气泡。
- `buildOneShotScenarioGuidance` 需要升级或替换，否则第二轮仍可能过度依赖粗糙正则。

### 5.3 可能新增的模块

命名只是建议，后续实现时可以调整：

| 新模块 | 责任 |
|---|---|
| `src/app/intake/page.tsx` | 信息收集页 |
| `src/lib/intakeState.ts` | 将职业和 AI 使用经历转为 `SessionState` / `TargetContext` |
| `src/app/mid-feedback/page.tsx` 或访谈页内状态 | 中途反馈页 |
| `src/lib/midFeedbackState.ts` | 本地规则将三字段反馈转为 `ScenarioGuidance`，不调用 Qwen |
| `src/lib/questionnaireLanguageValidation.ts` | 后续用于检查题面中文质量 |

## 6. 问卷收集情况与报告页对齐

当前报告页已经有「答题与计分明细」区域，会展示：

- 总题数。
- 有效题数。
- 跳过题数。
- 每个维度分数。
- 每一批题目与回答。

新流程应继续保证以下数据完整：

| 报告页需要 | 新流程来源 |
|---|---|
| 用户身份 | 信息收集页职业字段 |
| 近期 AI 使用场景 | 信息收集页 AI 使用经历字段 |
| 第一轮题目和答案 | `questionnaireBatches.batch1` / `batchAnswers.batch1` |
| 中途反馈 | 中途反馈页结构化结果 |
| 第二轮题目和答案 | `questionnaireBatches.batch2` / `batchAnswers.batch2` |
| 跳过题 | 每个 `QuestionnaireAnswer.skipped` |
| 四维分数 | `scoreQuestionnaireAnswers(flattenBatchAnswers(batchAnswers))` |
| 报告证据 | 用户原始填写内容 + 问卷题面 + 可选中途反馈引用 |

后续可以考虑让报告页增加一个明确的「本次输入来源」概念，但这不是当前阶段的 UI 优先项：

```text
本次报告基于：
- 你的职业 / 身份
- 你的 AI 使用经历
- 第一轮 8 题回答
- 中途反馈
- 第二轮 16 题回答
```

这能降低用户对报告来源的困惑，也能让报告页和新流程叙事一致。当前阶段先不改报告页格式，只保证这些来源数据进入报告生成链路。

## 7. 已明确结论与后续讨论边界

### 7.1 已明确结论

- 信息收集页只收两项：职业 / 身份、具体 AI 使用经历。
- 信息收集页本地结构化，不调用 Qwen。
- 中途反馈页收三项：第一轮整体感受、题目问题反馈、第二轮希望聚焦的真实场景。
- 中途反馈页本地结构化为 `ScenarioGuidance`，不调用 Qwen。
- 模型只负责问卷生成和报告生成，不负责表单归一化。
- 报告页格式优化先暂缓；本阶段只保证数据结构和报告生成链路对齐。

### 7.2 仍需讨论的结构化结果设计

需要讨论：

- 是否新增 `flowInputs` 这类字段来保留信息收集页和中途反馈页原文。
- `SessionEvidence` 是否应该保留用户填写的职业、AI 使用经历、中途反馈原文。
- `ScenarioGuidance` 是否足够表达中途反馈，还是需要新增更面向产品的结构。

### 7.3 报告生成与问卷结构对齐

需要讨论：

- 报告生成是否要引用中途反馈作为解释依据。
- 报告页的建议和 prompt 模板应绑定信息收集页的 `recentUse`，还是绑定中途反馈修正后的 `scenarioSummary`。
- 如果第一轮和第二轮结论不一致，报告页如何解释这种变化。

以下报告页 UI 问题暂缓：

- 是否显式展示两轮问卷的不同作用。
- 是否把「跳过题」升级成更明显的可信度提示。
- 是否重排报告页模块。

## 8. 建议实施顺序

1. 先新增信息收集页，把职业和 AI 使用经历写入 `SessionState`。
2. 让信息收集页直接进入第一轮问卷生成页，绕过 `/api/chat` 前两轮。
3. 把第一轮答完后的聊天式中途对话替换成中途反馈页。
4. 让中途反馈页用本地规则稳定产出 `ScenarioGuidance`，再进入第二轮问卷生成页。
5. 保持报告页先可用，只做最小对齐：确认 `batchAnswers`、`targetContext`、`scenarioGuidance` 都能传入 `/api/report`。
6. 再单独优化第一轮和第二轮问卷 prompt。
7. 最后再讨论报告页展示结构是否需要升级。

## 9. 当前不做的事

- 不在本轮决定第一轮问卷 prompt。
- 不在本轮决定第二轮问卷 prompt。
- 不在本轮重写或优化报告页视觉结构。
- 不在本轮引入 Qwen 做信息收集页或中途反馈页的表单归一化。
- 不在本轮改变四维模型、16 型人格、计分算法。
- 不在本轮移除 legacy 访谈代码；可以先让主流程不再使用它。
