# AI 项目组决策日志

## 记录规则

每条决策使用：

```text
## YYYY-MM-DD：标题

状态：
背景：
决定：
原因：
影响：
后续：
```

状态可选：

- `Accepted`：已接受。
- `Proposed`：提出但未拍板。
- `Revisit`：以后需要重看。
- `Deprecated`：已废弃。

## 2026-04-28：建立轻量 AI 项目组 workflow

状态：Accepted

背景：
- 项目需要一个本地 AI 团队来协助推进 AI-MBTI 与 AI-HQ。
- 当前 Codex 能按需使用主线程、Explorer、Worker、Reviewer 形式协作，但不是常驻自动化团队平台。
- 项目当前目标仍偏向快速可用和产品质量验证。

决定：
- 先建立 `docs/ai-team/` 文档组，作为本地 AI 项目组操作手册。
- 核心团队包括：项目主理人、总工程/产品架构、Explorer、Worker、Reviewer。
- 不在当前阶段实现复杂 agent orchestration 框架。

原因：
- 这个项目的关键风险是报告是否有用、流程是否真实、prompt/scoring/UI 是否一致。
- 文档化工作流能立刻提升协作质量，不会拖慢产品验证。
- 后续如果频繁出现重复任务，再把 workflow 中的部分动作脚本化。

影响：
- 以后可以用“开一轮 AI-MBTI 报告质量改进”“让 AI 团队评审 AI-HQ 架构”等口令启动工作。
- 每轮工作要尽量沉淀到 decision log、rubric 或 prompt registry。

后续：
- 选择一个真实任务跑第一轮，例如 AI-MBTI 报告质量评审或 AI-HQ 报告证据强化。

## 2026-04-28：采用反馈驱动交付循环

状态：Accepted

背景：
- 用户希望以后以个人审核/测试体验为起点提出要求。
- AI 团队需要负责研究问题、提出方案、工程实施、自检交付，并等待下一轮反馈。
- 用户希望主线程作为总架构师，合理分配每个 subagent 的能力。

决定：
- 将默认工作流定义为 `用户体验/审核 -> AI 团队研究问题 -> 工程实施 -> 自检交付 -> 等待下一轮反馈`。
- 主线程保留最高层判断和最终整合职责，目标能力配置为 `GPT-5.5 / xhigh`，当运行环境支持时采用。
- Explorer 负责并行只读研究，Worker 负责明确边界内的工程实施，Reviewer 负责产品质量验收。
- 用户只需要提出体验反馈和目标，不需要设计 MCP 调用或管理子代理。

原因：
- 这个项目的关键推进方式是用户真实体验后的连续改进。
- 先诊断再实施可以避免把主观反馈误翻译成错误技术任务。
- 子代理并行适合读链路、读文档、查 prompt 和查 scoring；最终产品判断仍需要主线程整合。

影响：
- 新增 `docs/ai-team/feedback-loop.md`。
- `workflow.md` 增加主线程职责和 subagent 调度矩阵。
- 后续第一轮 work 可以直接按反馈驱动交付循环启动。

后续：
- 用第一轮 AI-MBTI 或 AI-HQ 真实反馈验证这套流程。

## 2026-04-28：Claude API 接入问题先做可诊断化

状态：Accepted

背景：
- 第一轮实际 work 是修复 Claude API 接入无法跑通。
- 本地 `.env.local` 已设置 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、Agent A/B 模型。
- 直接访问 Anthropic 官方 `/models` 和 `/messages` 均返回 `403 Request not allowed`。

决定：
- 先将 Claude API 错误提示改成可诊断信息，避免前端只暴露 `Internal server error`。
- 新增 `npm run check:claude`，用脱敏方式检查 base URL、API key 是否存在、模型配置和上游访问结果。
- README 增加 Claude API 诊断入口。

原因：
- 多个模型都返回同一个 403，说明当前主要不是单个模型 ID 错误，而是 API key 权限、账号/组织、计费、地域/网络访问限制，或网关兼容性问题。
- 这个问题不能完全靠业务代码修复，需要先让失败原因可见。

影响：
- 应用返回给前端的 Claude 上游错误更可行动。
- 以后可以用 `npm run check:claude` 快速区分代码问题与上游权限/网络问题。

后续：
- 用户需要确认 Anthropic Console 账号/组织、计费权限、当前网络/地域是否允许访问官方 Anthropic API。
- 如果使用第三方网关，需要确认它是否兼容 Anthropic Messages API，而不是 OpenAI-compatible API。

## 2026-04-28：支持 OpenAI-compatible 镜像站

状态：Accepted

背景：
- 用户提供了一个 OpenAI-compatible 镜像站，用于访问 Claude 模型。
- 该网关的 base URL 是 `/v1`，模型列表包含当前 Agent A/B 使用的 Claude 模型名。
- 该网关通过 `/chat/completions` 跑通，不兼容原先的 Anthropic `/messages` 调用方式。

决定：
- `src/lib/claude.ts` 保持现有导出接口，但内部新增 `LLM_PROVIDER=openai-compatible` 分支。
- OpenAI-compatible 分支使用 `OPENAI_COMPATIBLE_BASE_URL`、`OPENAI_COMPATIBLE_API_KEY` 和 `/chat/completions`。
- 保留原生 Anthropic provider 作为可切换路径。
- `npm run check:llm` 作为新的通用诊断命令，`npm run check:claude` 继续作为兼容别名。

原因：
- 现有业务层已经围绕 Agent A/B 模型名和 `createClaudeMessage` 工作，最小改动是替换底层 transport。
- 这样可以同时支持镜像站和未来原生 Anthropic API。

影响：
- 本地开发默认可以切到 OpenAI-compatible 镜像站。
- README 和 `.env.local.example` 改为同时说明两种 provider。

后续：
- 如果后续更换网关，只需要更新 `.env.local` 的 provider/base/key/model。

## 2026-04-28：GetGoAPI Claude 网关强制 temperature=1

状态：Accepted

背景：
- 第二家镜像站 `https://api.getgoapi.com/v1` 的 Claude Sonnet/Opus 4 系列可用。
- 定点测试显示 `claude-sonnet-4-6` 与 `claude-opus-4-7` 在 temperature 为 0、0.3、0.7 时均返回 400。
- 上游错误提示为 thinking/adaptive 模式下 temperature 只能为 1。

决定：
- 新增 `OPENAI_COMPATIBLE_FORCE_TEMPERATURE` 配置项。
- 当该配置存在时，OpenAI-compatible provider 会覆盖业务层传入的 temperature。
- 本地当前先将 Agent A/B 都设为 `claude-sonnet-4-6`，并对 GetGoAPI 强制 `temperature=1`。

原因：
- 业务层仍需要表达 A/B 的默认温度意图，但镜像站兼容层有自己的接口约束。
- 配置化覆盖可以让未来切回其他网关时不改代码。

影响：
- 使用 GetGoAPI Claude 时，Agent A/B 不再因为 temperature 0.7/0.3 报 400。
- 如果换成不需要强制温度的网关，只要清空该环境变量即可。

## 2026-04-28：AI-MBTI 报告兜底文案修复

状态：Accepted

背景：
- 用户在报告页看到“你的 AI 协作画像已经生成：这份结果基于问卷分数计算，解释文本暂时使用兜底版本。”
- 该文案只会在 `/api/report` 中 Agent B 返回文本无法解析成合法 JSON 时出现。
- 复现显示服务端分数可用，但解释文本落入 fallback。

决定：
- 新增 `src/lib/jsonResponse.ts`，用平衡括号和 code fence 候选解析替代贪婪正则。
- 将 AI-MBTI 报告模型输出 schema 缩小为解释文本层：summary、tags、overallAdvice、recommendations、promptTemplates、dimension analysis。
- personality、targetContext、score、tendency、evidence 等确定性字段继续由服务端合并。
- AI-HQ report 也切换到同一 JSON 提取工具，避免同类解析问题。

原因：
- Claude 在 `temperature=1` 下容易输出 markdown fenced JSON 或额外说明，原来的贪婪正则不够稳。
- 让模型复制 avatarPrompt、colors、完整 personality 等大字段会增加截断和 JSON 转义失败概率。
- 该项目的原则是“判定在代码，表达给模型”。

影响：
- 报告页不应再因为解释文本 JSON 解析失败而直接显示兜底报告。
- 报告输出更聚焦于用户可读价值，服务端继续兜住核心分数和画像。

后续：
- 如再次出现 fallback，应优先检查上游超时或模型输出是否完全空/截断。

## 2026-04-29：切换 ClaudeAPI 镜像并接入流式访谈

状态：Accepted

背景：
- 用户希望判断 Sonnet 4-6 回复速度是否可优化，并希望对话框具备类似 Claude/GPT 的逐字句涌出效果。
- 新镜像 `https://gw.claudeapi.com/v1` 支持 OpenAI-compatible `/chat/completions` 与 Anthropic `/messages`。
- 实测 `claude-sonnet-4-6` 支持 temperature 0、0.3、0.7、1，且 5 次短请求平均约 1.5 秒。
- 该镜像支持 `stream: true`，返回 `text/event-stream`。

决定：
- 本地 `.env.local` 切到 `https://gw.claudeapi.com/v1`，Agent A/B 均使用 `claude-sonnet-4-6`。
- 清空 `OPENAI_COMPATIBLE_FORCE_TEMPERATURE`，恢复业务层温度设置。
- 新增统一 stream transport：`createClaudeMessageStream`。
- 新增 `/api/chat/stream` 与 `/api/hq-chat/stream`，前端优先使用 stream，失败时回退原 JSON API。
- 报告生成和问卷生成仍保留非流式结构化返回，避免 JSON 解析风险。

原因：
- 真实 streaming 能改善首 token 体验；单纯前端假打字只能改善阅读动画，不能减少等待感。
- `/api/chat` 的 Agent B 阶段仍需要完整 JSON，因此只 stream Agent A 文本。
- 保留旧 JSON API 可以降低上线风险，并作为网关不支持 streaming 时的回退。

影响：
- AI-MBTI 与 AI-HQ 访谈页可以边接收边显示助手文本。
- 使用 ClaudeAPI 镜像时不再需要强制 temperature=1。
- 当前报告页仍可能受长文本生成耗时影响，但不属于本轮流式访谈范围。

后续：
- 若需要进一步优化 AI-MBTI 首屏等待，需要压缩 Agent B 预分析或在 UI 上更明确展示“分析对话中”状态。

## 2026-04-29：执行 codex-next-iteration Phase 3，AI-HQ 暂存

状态：Accepted

背景：
- `docs/codex-next-iteration.md` 建议把产品收敛到 AI-MBTI 单一主线。
- 用户也明确 AI-HQ 先暂时搁置，接下来主要做好 AI-MBTI。
- Phase 1/2 的单 Agent tool use 与 SessionState memory 需要先验证网关 tool-call 兼容性，不适合在未探针前整块重写。

决定：
- 首页只保留 AI-MBTI 主 CTA。
- `/hq-interview` 与 `/hq-report` 保留可访问，但页面顶部显示 archived 提示。
- HQ 相关源码加 archived 注释，避免后续误判为当前主线。
- `/test-lab` 主测试链路暂时只统计 AI-MBTI，HQ v0.1 显示为 skipped。
- README 页面结构与测试说明同步标记 HQ archived。

原因：
- 这是独立低风险切片，可以立刻减少产品分心。
- 保留 HQ 代码方便未来作为 AI-MBTI 报告补充模块回归。
- 核心聊天链路留给下一轮基于 tool-use 探针后的安全改造。

后续：
- 下一轮先做 OpenAI-compatible tool-call 探针和 `createClaudeMessageWithTools` 非流式兼容层。

## 2026-04-29：Tool-call 探针与非流式兼容层

状态：Accepted

背景：
- `docs/codex-next-iteration.md` 的 Phase 1 需要单 Agent + tool use。
- 当前镜像站是否支持 OpenAI-compatible tool calls 是核心风险。

决定：
- 新增 `npm run check:llm-tools`，用脱敏方式强制模型调用一个小型测试工具。
- 当前 `https://gw.claudeapi.com/v1` 在 `/chat/completions` 下返回标准 `message.tool_calls`，`finish_reason=tool_calls`，arguments 为 JSON 字符串。
- 新增 `createClaudeMessageWithTools` 非流式 transport，统一返回 `textBlocks`、`toolUses`、`stopReason`。
- Anthropic provider 走 `/messages` 原生 `tools/tool_choice`；OpenAI-compatible provider 走 `/chat/completions` 的 `tools/tool_choice`。

原因：
- 先把工具调用兼容层做成可诊断的底座，再重写 `/api/chat/stream`，风险更低。
- Streaming tool-use 仍有 partial input 分片兼容风险，本轮暂不处理。

后续：
- 下一轮可以基于 `createClaudeMessageWithTools` 新增 `researcher.ts`，再把 Agent B JSON-tail 迁移成 tool call。

## 2026-04-29：AI-MBTI 结构化分析迁移到 tool call

状态：Accepted

背景：
- 当前 AI-MBTI 聊天链路中，Agent B 原本通过“输出 JSON 文本 + 服务端解析”的方式生成 directive、targetContext 和问卷。
- 这会受 markdown fence、额外说明、截断和 JSON 解析漂移影响。
- 上一轮已经确认当前 ClaudeAPI 镜像支持标准 OpenAI-compatible tool calls。

决定：
- 新增 `src/lib/researcher.ts`，登记 `update_session_state` 与 `generate_questionnaire` 两个工具。
- `/api/chat/stream` 和 `/api/chat` 都改为通过 `createClaudeMessageWithTools` 获取结构化 AgentBOutput。
- 第 0 轮开场改成服务端固定返回，避免为固定开场白额外调用模型。
- 问卷生成轮将 researcher maxTokens 收紧到 4096，降低工具调用超过 60 秒的概率。
- 若工具问卷不合法，继续用 `FALLBACK_QUESTIONNAIRE` 兜底，并把兜底题同步写回 `agentBOutput.nextQuestions`。

原因：
- tool call 比 JSON-tail 更适合作为下一阶段 SessionState memory 的结构化入口。
- 首轮固定开场可以显著降低首次等待。
- 兜底路径必须保持，避免问卷阶段因工具调用不完整而卡住用户。

影响：
- 当前仍保留 Agent A 负责用户可见自然回复，所以还不是完整单 Agent。
- Agent B 的结构化输出已经从文本 JSON 迁移到 tool call，为下一步合并角色和引入 SessionState 做准备。

后续：
- 下一轮可以把 `update_session_state` 的输出落成显式 `SessionStatePatch`，前端随请求传递 `sessionState`。

## 2026-04-29：Phase 5 报告可携带产物升级

状态：Accepted

背景：
- Claude Code 更新后的 Phase 5 明确收缩边界：AI-MBTI 只有访谈和问卷数据，没有真实 AI 使用日志。
- 因此报告不应生成“做对了什么”“常犯错误”“6-12 个月预测”等需要真实使用数据支撑的内容。
- 用户要求按 AI-team 分工实施这轮计划。

决定：
- 报告新增 `styleOverview`、`collaborationManifesto`、`collaborationSignature` 三类可携带产物。
- `collaborationSignature.headline` 固定写在 16 型人格 profile 中，服务端注入；LLM 只生成 detail。
- 新字段由服务端质量检查兜底，不让 manifesto 或 signature 质量漂移导致报告失败；文案长度采用容忍校验，manifesto 模型目标为 100-200 字，服务端接受 100-220 字。
- 报告页新增风格速览、横向 TOC、Prompt 模板、AI 协作宣言和协作签名；不提供显式 Copy 按钮，文本由用户自行选择是否复制。

原因：
- 当前阶段最有用户价值的是“看完报告后能带走一段可继续使用的 AI 协作配置”。
- 固定 headline 与服务端兜底能保持质量下限。
- 单次 tool-call 报告生成继续降低复杂度，避免 core/extras 双调用带来的不一致。

影响：
- `/api/report` 的结构化输出 schema 扩展，但保留旧字段和解析兜底。
- `/report` 页面从解释型报告升级为解释 + 可带走配置产物。
- `/test-lab` 增加 Phase 5 portable artifacts 兜底测试。

后续：
- 上线后重点观察 manifesto 主观有用度、prompt 模板反馈和新字段 fallback 触发率。
