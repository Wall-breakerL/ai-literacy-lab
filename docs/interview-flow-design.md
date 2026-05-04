# AI-MBTI 访谈流程设计文档

## 概述

当前 AI-MBTI v6.0 流程分为：背景访谈 -> 两部分问卷 -> 一轮中途校准 -> 报告生成 -> 报告反馈。运行时主链路是单一 researcher agent，不再使用旧版双代理编排。

旧文档中的“16-20 道单次问卷”“访谈模型必须同时问职业和 AI 使用方式”“每轮由另一个模型给 directive”属于 legacy 设计。新产品口径以 Phase 6 两部分 24 题为准。

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

## 阶段 2：Phase 6 两部分问卷

总题数固定为 24 题，第一部分 8 题、第二部分 16 题。

| 部分 | mode | 题型 | 触发方式 |
|---|---|---|---|
| 第一部分 | `hybrid_batch1` | 4 道习惯题 + 4 道场景题 | 初始访谈完成后调用 `/api/questionnaire/generate` |
| 第二部分 | `hybrid_batch2` | 8 道习惯题 + 8 道场景题 | `mid_dialog1` 完成后调用 `/api/questionnaire/generate` |

每部分硬性结构：

- 第一部分四个维度各 2 题，每维 2 正向 + 0 反向。
- 第二部分四个维度各 4 题，每维 2 正向 + 2 反向。
- 第一部分必须有 4 道 `scenario="习惯"` 的习惯题和 4 道具体或半具体场景题；第二部分必须有 8 道习惯题和 8 道场景题。
- 第二部分每个维度必须同时有正向题和反向题；第一部分按当前设计全部使用正向题。
- 两部分合计后，每个维度必须 6 题，且 4 道正向 + 2 道反向。
- 场景题优先绑定用户上下文；抽象颗粒度下可以降低职业细节，但仍要能让用户代入。

校验失败时会触发一次重试；仍失败则使用本地 fallback batch。

## 阶段 3：中途对话

中途对话使用同一个聊天 UI，但由 `sessionState.phase` 驱动，不再用 `roundCount >= 2` 判定。

### `mid_dialog1`

第一部分问卷答完后触发。根据第一部分是否有跳过题生成开放式问题，例如：

- 有跳过题：稳定抽样引用 1-2 道，询问题意是否不清、是否没有类似经历，或是否对这个方向不感兴趣。
- 无跳过题：询问第一部分整体感受，以及第二部分更希望围绕哪些真实 AI 使用场景。

### 结构化结果

中途对话必须写入：

- `scenarioGuidance.status`
- `scenarioGuidance.scenarioSummary`
- `scenarioGuidance.granularity`
- `scenarioGuidance.includeTopics`
- `scenarioGuidance.avoidTopics`
- `scenarioGuidance.userCorrectionQuote`
- 必要时更新 `refinedTargetContext`

中途对话只保留一轮。除非用户明确退出，否则用户回复后立即写入结构化字段并生成第二部分问卷。

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

报告页底部提供结构化反馈入口。用户可以说明哪些报告内容有用、哪些不准、题目哪里不贴，服务端把反馈写入 Notion 或本地 fallback。

保存规则：

- 配置 `NOTION_API_KEY` 且存在 feedback data source id 时，写入 Notion。
- Notion 未配置或写入失败时，保存到 `.local-debug/feedback/`。
- 本地 fallback 文件可能包含用户原文、报告摘要、人格 code、题目数量和跳过率，不要提交。

## 关键文件

| 文件 | 作用 |
|---|---|
| `src/lib/researcher.ts` | researcher prompt、批次问卷 tool、中途对话 tool |
| `src/lib/sessionState.ts` | phase、batch、mid-dialogue、答案展平 |
| `src/app/api/chat/route.ts` | 背景访谈和中途对话 API |
| `src/app/api/chat/stream/route.ts` | 流式聊天路径 |
| `src/app/api/questionnaire/generate/route.ts` | 8+16 批次生成 |
| `src/app/api/mid-dialog/opening/route.ts` | 中途对话开场生成 |
| `src/app/api/report/route.ts` | 报告生成 API |
| `src/app/api/feedback/route.ts` | 结构化反馈保存 |
| `src/app/interview/page.tsx` | 访谈与两部分问卷客户端状态机 |
| `src/app/report/page.tsx` | 报告展示与反馈入口 |

## 调试要点

- 背景访谈：第一轮只问职业/身份，第二轮追问 AI 使用场景。
- 第一部分：8 道 `hybrid_batch1` 题，4 习惯 + 4 场景，四维各 2 题。
- 中途对话：用户意见进入 `scenarioGuidance`，影响第二部分。
- 第二部分：16 道 `hybrid_batch2` 题，8 习惯 + 8 场景，两部分合计每维 4 正向 + 2 反向。
- 报告：跳过题不计分，24 题全答时每维 6 题。
- 测试：`npm run test:browser` 只声明本地 self-tests / browser smoke，不代表 API E2E。
