# Codex Phase 7 实现说明：对话式反馈收集

> 报告页底部增加 1-2 轮 Claude 反馈对话。用户说出对题目和报告的真实感受后，Claude 整理成结构化反馈，并写入 Notion。Notion 未配置或写入失败时保存到 `.local-debug/feedback/`，避免丢数据。

## 1. 功能定位

目标：把用户看完报告后的主观体验转成可用于迭代题目、prompt、报告结构和流程设计的反馈。

位置：
- `/report` 页面底部，在 Collaboration Signature 之后。
- `/feedback-debug` 调试页，用模拟报告上下文测试反馈链路。
- 首页提供“调试反馈对话”按钮，方便开发时直接进入反馈界面。

原则：
- 不做静态评分表单。
- 用户与 Claude 自然聊 1-2 轮。
- Claude 最多追问一次，然后必须整理。
- 结构化字段用于筛选，长文本和原始对话写入反馈页面正文。
- 不在仓库中保存 Notion token 或其他 secrets。
- 本地 fallback 文件可能包含用户原文、报告摘要、人格 code、目标、跳过率和 rawDialogue；只用于本地调试，不要提交。

## 2. 用户流程

1. 用户看完报告。
2. 点击“开始反馈对话”。
3. Claude 开放式询问：
   - 哪些部分有用？
   - 哪些部分不准、空泛或没帮助？
   - 题目是否贴近真实使用场景？
4. 用户回答。
5. 如果回答太笼统，Claude 最多追问一次具体例子。
6. Claude 输出一句自然收束语，同时通过 tool schema 生成结构化反馈。
7. 前端调用 `/api/feedback` 保存结构化反馈：优先 Notion，失败或未配置时写入本地 fallback。

## 3. 数据结构

核心类型在 `src/lib/types.ts`：

- `FeedbackContext`：报告页传给反馈 agent 的上下文。
- `FeedbackDialogueMessage`：反馈对话消息。
- `StructuredFeedback`：Claude 整理后的最终反馈。
- `FeedbackChatResponse`：`/api/feedback/chat` 返回值。

`StructuredFeedback` 包含：

- `sessionId`
- `personalityCode`
- `role`
- `recentUse`
- `goal`
- `totalQuestions`
- `answeredQuestions`
- `skipRate`
- `summary`
- `usefulParts`
- `inaccurateParts`
- `questionIssues`
- `reportIssues`
- `improvementSuggestions`
- `sentiment`
- `priority`
- `feedbackTypes`
- `rawDialogue`

## 4. Notion / local storage

运行时写入逻辑在 `src/lib/feedbackStorage.ts`：

- `NOTION_API_KEY` 和 data source id 都存在时，调用 Notion REST API 创建 page。
- data source id 优先读 `NOTION_FEEDBACK_DATA_SOURCE_ID`，否则读 `NOTION_FEEDBACK_DATABASE_ID`。
- 任一配置缺失时，直接写入 `.local-debug/feedback/`。
- Notion 写入失败时，仍写入 `.local-debug/feedback/`，并在响应里返回 warning。

运行时环境变量：

```env
NOTION_API_KEY=
NOTION_FEEDBACK_DATABASE_ID=777147e1-3401-4f4b-98dc-bc14fce6a127
NOTION_FEEDBACK_DATA_SOURCE_ID=
NOTION_VERSION=2026-03-11
```

历史上 `NOTION_FEEDBACK_DATABASE_ID` 的名字可能看起来像 database id，但当前代码把它作为 data source id fallback 使用。更清晰的配置是把 data source id 放到 `NOTION_FEEDBACK_DATA_SOURCE_ID`。

字段：

| 字段名 | 类型 | 用途 |
|---|---|---|
| Name | Title | 反馈记录标题 |
| Created At | Date | 写入时间 |
| Session ID | Text | 测评会话 |
| Personality | Text | AI-MBTI 类型 |
| Role | Text | 用户职业/身份 |
| Recent Use | Text | 用户近期 AI 使用场景 |
| Goal | Text | 用户目标 |
| Total Questions | Number | 总题数 |
| Answered Questions | Number | 有效题数 |
| Skip Rate | Number | 跳过率 |
| Sentiment | Select | positive / mixed / negative |
| Priority | Select | low / medium / high |
| Feedback Type | Multi-select | question_issue / report_issue / prompt_template / flow_issue / positive_signal |
| Summary | Text | Claude 整理摘要 |
| Stored Source | Select | claude_feedback_dialogue / manual_import |

## 5. 代码位置

- `src/lib/feedbackAgent.ts`：反馈访谈 prompt、tool schema、结构化解析。
- `src/app/api/feedback/chat/route.ts`：Claude 反馈对话接口。
- `src/lib/feedbackStorage.ts`：Notion REST 写入和本地 fallback。
- `src/app/api/feedback/route.ts`：保存结构化反馈。
- `src/components/FeedbackDialogue.tsx`：报告页和调试页共用 UI。
- `src/app/report/page.tsx`：报告底部挂载反馈对话。
- `src/app/feedback-debug/page.tsx`：模拟上下文调试页。
- `src/app/page.tsx`：首页调试入口。

## 6. 验收

必跑：

```bash
npm run typecheck
npm run lint
npm run test:browser
npm run check:llm
```

手动或 API smoke：

1. `/feedback-debug` 可打开。
2. 点击“开始反馈对话”，Claude 返回第一问。
3. 输入反馈后，Claude 返回整理完成文案。
4. `/api/feedback` 在 Notion 配置完整时写入 Notion 成功。
5. Notion 未配置或失败时，`.local-debug/feedback/` 生成 JSON。

当前文档只声明手动/API smoke，不声明自动化 API E2E。

## 7. 风险

- 反馈质量仍依赖用户表达，Claude 只负责整理，不应过度推断。
- Notion schema 字段名必须和代码一致；不一致时会落本地 fallback。
- 调试页使用真实反馈接口；配置 Notion 后提交会写入真实 Notion，测试记录需要手动删除或保留为 smoke 记录。
- `.local-debug/feedback/` 是隐私敏感调试目录，不能提交，也不应作为长期存储。
