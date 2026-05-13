# AI-MBTI 访谈流程设计文档

## 概述

当前 AI-MBTI v6.0 流程分为：信息收集页 -> 两部分问卷 -> 中途反馈页 -> 报告生成 -> 报告反馈。运行时主链路不再使用旧版双代理编排。

旧文档中的“16-20 道单次问卷”“聊天式背景访谈”“每轮由另一个模型给 directive”属于 legacy 设计。新产品口径以 intake + Phase 6 两部分 16 题为准。

## 阶段 1：信息收集页

目标：本地收集职业/身份、常用 AI 工具和近期 AI 使用经历，不调用模型做表单归一化，不分析四维倾向。

当前节奏：

1. 用户填写职业 / 身份。
2. 用户选择或填写常用 AI 工具。
3. 用户填写近期具体 AI 使用经历。
4. 前端创建 `SessionState`，写入 `background.role`、`background.tools`、`background.recentUse` 和统一兜底目标。
5. 进入第一轮问卷生成页。

禁止事项：

- 不直接追问 Relation / Workflow / Epistemic / RepairScope 倾向。
- 不恢复聊天式背景访谈。
- 不恢复 `goalStatus` / `goalType`。
- 不把统一兜底目标当作具体场景。

## 阶段 2：Phase 6 两部分问卷

总题数固定为 16 题，第一部分 8 题、第二部分 8 题。

| 部分 | mode | 题型 | 触发方式 |
|---|---|---|---|
| 第一部分 | `hybrid_batch1` | 4 道通用题 + 4 道半具体题 | intake 完成后调用 `/api/questionnaire/generate` |
| 第二部分 | `hybrid_batch2` | 4 道半具体题 + 4 道具体题 | 中途反馈页提交后调用 `/api/questionnaire/generate` |

每部分硬性结构：

- 第一部分四个维度各 2 题，每维 1 道 `universal` + 1 道 `semi_specific`。
- 第二部分四个维度各 2 题，每维 1 道 `semi_specific` + 1 道 `specific`。
- 两部分合计后，每个维度必须 4 题。
- 每部分每个维度必须 1 道 `reverse=false` + 1 道 `reverse=true`；两部分合计每维 2 正 2 反。
- 场景题优先绑定用户上下文；抽象颗粒度下可以降低职业细节，但仍要能让用户代入。

校验失败时会触发一次重试；仍失败则使用本地 fallback batch。

## 阶段 3：中途反馈页

第一部分问卷答完后触发。中途反馈页显式收集第一部分整体感受、题目问题反馈和第二部分希望聚焦的真实 AI 使用场景。

### 结构化结果

中途对话必须写入：

- `scenarioGuidance.status`
- `scenarioGuidance.scenarioSummary`
- `scenarioGuidance.granularity`
- `scenarioGuidance.includeTopics`
- `scenarioGuidance.avoidTopics`
- `scenarioGuidance.userCorrectionQuote`
- 必要时更新 `refinedTargetContext`

中途反馈本地结构化，不调用模型。提交后立即写入结构化字段并生成第二部分问卷。

## 阶段 4：报告生成

报告入口优先使用请求体里的 `questionnaireAnswers`；没有时使用 `sessionState.answers`；仍没有时展开 `sessionState.batchAnswers`。

计分规则：

- 量表为 0-5 分。
- `reverse=false`：按原始 0-5 分累加。
- `reverse=true`：按 `5 - score` 计分；active 主流程每维一半题目为反向题。
- 「不了解 / 没想好」按 2.5 分贡献中位数，但不计入有效题数。
- 每维满分 20 分，报告同时使用 `scorePercent` 展示百分比。
- confidence 同时看有效题数和分数离中点的距离；有效题不足或接近中点时降为 low。

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
| `src/lib/researcher.ts` | researcher prompt、批次问卷 tool |
| `src/lib/sessionState.ts` | phase、batch、答案展平 |
| `src/lib/intakeState.ts` | 信息收集页本地状态创建 |
| `src/lib/midFeedbackState.ts` | 中途反馈本地结构化 |
| `src/app/api/questionnaire/generate/route.ts` | 8+8 批次生成 |
| `src/app/api/report/route.ts` | 报告生成 API |
| `src/app/api/feedback/route.ts` | 结构化反馈保存 |
| `src/app/intake/page.tsx` | 信息收集页 |
| `src/app/interview/page.tsx` | 两部分问卷生成和作答状态机 |
| `src/app/mid-feedback/page.tsx` | 中途反馈页 |
| `src/app/report/page.tsx` | 报告展示与反馈入口 |

## 调试要点

- 信息收集：职业/身份、工具、近期 AI 使用经历写入 `SessionState.background`。
- 第一部分：8 道 `hybrid_batch1` 题，4 通用 + 4 半具体，四维各 2 题。
- 中途反馈：用户意见进入 `scenarioGuidance`，影响第二部分。
- 第二部分：8 道 `hybrid_batch2` 题，4 半具体 + 4 具体，两部分合计每维 4 题。
- 报告：跳过题按 2.5 计入分数，16 题全答时每维 4 题。
- 测试：`npm run test:browser` 覆盖本地 self-tests；`npm run smoke:phase6-phase7` 覆盖 API smoke。
