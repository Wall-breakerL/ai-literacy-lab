# AI-MBTI 访谈流程设计文档

## 概述

当前 AI-MBTI v5.2 流程分为：背景访谈 -> 三批问卷 -> 两段中途校准 -> 报告生成 -> 报告反馈。运行时主链路是单一 researcher agent，不再使用旧版 Agent A / Agent B 双代理编排。

旧文档中的“16-20 道单次问卷”“Agent A 必须同时问职业和 AI 使用方式”“Agent B 每轮给 A directive”属于 legacy 设计。代码里仍有兼容入口，但新产品口径以 Phase 6 三批 24 题为准。

## 阶段 1：背景访谈

目标：只收集职业/身份、AI 使用经历和当前目标，不分析四维倾向。

当前节奏：

1. 第 0 轮 researcher 开场只问职业或身份，示例：`嗨，欢迎！先聊聊你是做什么的吧？`
2. 用户回答职业/身份后，researcher 提取 `role`，再追问主要 AI 使用场景。
3. 用户回答 AI 使用方式后，researcher 提取 `recentUse`；如果用户顺带说了目标，写入 `goal`，否则 `goalStatus="missing"`。
4. 达到 `QUESTIONNAIRE_ENTRY_ROUND = 2` 后进入问卷生成，不再继续追问背景。

禁止事项：

- 不直接追问 Relation / Workflow / Epistemic / RepairScope 倾向。
- 不把职业回答误写成 `recentUse`。
- 不把“更有效地使用 AI”当作具体场景。
- 不在背景访谈阶段生成问卷。

## 阶段 2：Phase 6 三批问卷

总题数固定为 24 题，三批各 8 题。

| 批次 | mode | 题型 | 触发方式 |
|---|---|---|---|
| 第一批 | `habit_batch` | 8 道习惯题 | 初始访谈完成后调用 `/api/questionnaire/generate` |
| 第二批 | `scenario_batch` | 8 道场景题 | `mid_dialog1` 完成后调用 `/api/questionnaire/generate` |
| 第三批 | `mixed_batch` | 4 道习惯题 + 4 道场景题 | `mid_dialog2` 完成后调用 `/api/questionnaire/generate` |

每批硬性结构：

- 四个维度各 2 题。
- 每个维度 1 道正向题、1 道反向题。
- `habit_batch` 的 `scenario` 全部是 `习惯`。
- `scenario_batch` 不能使用泛场景，例如“日常使用 AI”。
- `mixed_batch` 每个维度必须有 1 道习惯题和 1 道场景题。

校验失败时会触发一次重试；仍失败则使用本地 fallback batch。

## 阶段 3：中途对话

中途对话使用同一个聊天 UI，但由 `sessionState.phase` 驱动，不再用 `roundCount >= 2` 判定。

### `mid_dialog1`

第一批习惯题答完后触发。根据第一批跳过率和跳过题样本生成开放式问题，例如：

- 跳过率低：询问习惯题答下来感觉如何，以及接下来希望围绕哪些真实场景。
- 跳过率中：引用 1-2 道跳过题，询问哪些题不太贴。
- 跳过率高：明确提示习惯题可能不贴近，请用户说平时主要用 AI 做什么。

### `mid_dialog2`

第二批场景题答完后触发。重点询问场景题是否贴合，以及第三批应更具体、更抽象还是换场景。

### 结构化结果

中途对话必须写入：

- `scenarioGuidance.status`
- `scenarioGuidance.scenarioSummary`
- `scenarioGuidance.granularity`
- `scenarioGuidance.includeTopics`
- `scenarioGuidance.avoidTopics`
- `scenarioGuidance.userCorrectionQuote`
- 必要时更新 `refinedTargetContext`

如果用户反馈不清，最多追问一次；如果仍然低信息，按当前场景继续生成下一批，避免无限循环。

## 阶段 4：报告生成

报告入口优先使用请求体里的 `questionnaireAnswers`；没有时使用 `sessionState.answers`；仍没有时展开 `sessionState.batchAnswers`。

计分规则：

- 量表为 1-6 分。
- `reverse=false`：`(score - 1) * 20`。
- `reverse=true`：`(6 - score) * 20`。
- 「不了解 / 没想好」不计分。
- 每维有效答案 `>= 4` 为 high confidence，`2-3` 为 medium，`< 2` 为 low。

LLM 只生成解释文本、建议和 prompt 模板，不输出或重算分数。服务端合并 personality、targetContext、score、tendency、evidence 和 confidence。

## 阶段 5：报告反馈

报告页底部挂载 Phase 7 反馈对话。用户可以自然说明哪些报告内容有用、哪些不准、题目哪里不贴。反馈 agent 最多追问一次，然后输出结构化 `StructuredFeedback`。

保存规则：

- 配置 `NOTION_API_KEY` 且存在 feedback data source id 时，写入 Notion。
- Notion 未配置或写入失败时，保存到 `.local-debug/feedback/`。
- 本地 fallback 文件可能包含用户原文、报告摘要、人格 code、题目数量、跳过率和 rawDialogue，不要提交。

## 关键文件

| 文件 | 作用 |
|---|---|
| `src/lib/researcher.ts` | researcher prompt、批次问卷 tool、中途对话 tool |
| `src/lib/sessionState.ts` | phase、batch、mid-dialogue、答案展平 |
| `src/app/api/chat/route.ts` | 背景访谈和中途对话 API |
| `src/app/api/chat/stream/route.ts` | 流式聊天路径 |
| `src/app/api/questionnaire/generate/route.ts` | 8 题批次生成 |
| `src/app/api/mid-dialog/opening/route.ts` | 中途对话开场生成 |
| `src/app/api/report/route.ts` | 报告生成 API |
| `src/app/api/feedback/chat/route.ts` | Phase 7 反馈对话 |
| `src/app/api/feedback/route.ts` | 结构化反馈保存 |
| `src/app/interview/page.tsx` | 访谈与三批问卷客户端状态机 |
| `src/app/report/page.tsx` | 报告展示与反馈入口 |

## 调试要点

- 背景访谈：第一轮只问职业/身份，第二轮追问 AI 使用场景。
- 第一批：8 道 `habit_batch` 题，四维各 2 题。
- 中途对话 1：用户意见进入 `scenarioGuidance`，影响第二批。
- 第二批：8 道具体场景题，不接受泛场景。
- 中途对话 2：用户意见影响第三批。
- 第三批：4 习惯 + 4 场景，合计 24 题。
- 报告：跳过题不计分，24 题全答时每维 6 题。
- 测试：`npm run test:browser` 只声明本地 self-tests / browser smoke，不代表 API E2E。
