# Prompt Registry

## 目的

记录关键 prompt 的位置、职责、修改原因和质量要求。

这不是复制所有 prompt 的地方，而是登记 prompt 的产品职责，避免后续改动时出现语义漂移。

## 当前 Prompt 清单

| 名称 | 位置 | 职责 | 质量关注 |
|---|---|---|---|
| AI-MBTI Researcher Interview | `src/lib/researcher.ts`, `src/app/api/chat/route.ts`, `src/app/api/chat/stream/route.ts` | Phase 6 初始访谈，先问职业/身份，再问平时 AI 使用场景，并写入 SessionState | 第 0 轮只问职业/身份；第 1 轮提取 role 并追问 AI 使用；第 2 轮提取 recentUse 后进入问卷 |
| AI-MBTI Mid-dialogue Opening | `src/lib/researcher.ts`, `src/app/api/mid-dialog/opening/route.ts`, `src/app/interview/page.tsx` | Phase 6 第一部分后的单轮场景校准开场，由模型生成开放式问题，必要时引用跳过题 | 有跳过题时引用 1-2 道询问题意/经历/兴趣；无跳过题时询问整体感受和第二部分场景 |
| AI-MBTI Researcher Tools | `src/lib/researcher.ts` | 通过 tool call 更新访谈状态并生成 Phase 6 两部分问卷 | 四维覆盖、正反向题、场景绑定、可回答性；每部分生成完成后给用户一句自然完成提示 |
| AI-MBTI Report Agent | `src/lib/reportAgent.ts` | 基于确定性计分和回答生成报告，并生成 Phase 5 可携带产物 | 证据、建议、prompt 模板、置信表达、manifesto 可用性 |
| AI-MBTI Feedback Agent | `src/lib/feedbackAgent.ts`, `src/app/api/feedback/chat/route.ts` | Phase 7 报告页 1-2 轮反馈对话，并整理成结构化 Notion 反馈 | 最多追问一次；不为报告辩解；优先沉淀可改进的题目、报告、prompt 和流程问题 |
| AI-HQ Agent A | `src/lib/hqAgents.ts` | archived：固定 5 段访谈 | 保留 v0.1 代码，暂不作为主线入口 |
| AI-HQ Agent B | `src/lib/hqAgents.ts` | archived：通读 transcript，结合探针生成报告 | 未来作为 AI-MBTI 报告补充模块重构 |

## 当前 Phase 6 约定

- 初始开场保持轻量：先问职业/身份，不在第一句话里同时追问 AI 使用方式或目标。
- 中途对话开场只在第一部分后触发；有跳过题时稳定抽样 1-2 道代表题，无跳过题时询问整体感受和第二部分场景。
- deterministic fallback 只用于模型/API 失败，或本地 fallback 问卷/本地 fallback 文案路径；正常模型成功时不合成本地成功文案替代模型输出。

## 修改 Prompt 前检查

1. 这次修改解决什么具体问题？
2. 是否影响数据结构或前端字段？
3. 是否需要同步 fallback、validation 或 scoring？
4. 是否需要更新 README 或设计文档？
5. 是否需要新增样例或测试？

## 修改记录

### 2026-04-28：建立 registry

状态：已创建。

原因：
- 项目历史上有多个 Agent A/B prompt，当前主线已收敛到 researcher / report / feedback agent。
- AI-MBTI 与 AI-HQ 的职责边界不同。
- 后续需要避免 prompt 改了，但 scoring、UI、README 没同步。

后续每次修改 prompt 时，在这里追加：

```text
### YYYY-MM-DD：变更标题

位置：
原因：
改动：
验证：
风险：
```

### 2026-04-29：AI-MBTI 报告 Phase 5 可携带产物

位置：
- `src/lib/reportAgent.ts`
- `src/app/api/report/route.ts`

原因：
- 报告需要从“解释文本”升级为用户可带走的 AI 协作配置。
- 当前数据不支持真实使用表现分析，因此 prompt 必须避免“做对了什么”“常犯错误”“长期预测”等过度判断。

改动：
- 新增 `styleOverview`、`collaborationManifesto`、`collaborationSignature.detail` 生成约束。
- `promptTemplates` 收敛为 1-2 条高质量模板。
- `collaborationSignature.headline` 改由服务端固定 profile 注入。

验证：
- `npm run typecheck`
- `npm run lint`
- `/test-lab` Phase 5 portable artifacts 测试

风险：
- manifesto 质量仍依赖模型输出，因此服务端保留确定性兜底和长度/占位符/禁用句式检查；当前实现采用 100-220 字容忍范围，模型目标仍是 100-200 字。
- promptTemplates / recommendations / overallAdvice 目前主要靠 tool schema 与 prompt 约束，不做强运行时质量校验；除非真实样本显示空泛或不可直接使用，否则不作为 Phase 5 阻断项。

### 2026-04-30：Phase 6 初始访谈与中途对话开放式校准

位置：
- `src/lib/researcher.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/stream/route.ts`
- `src/app/api/mid-dialog/opening/route.ts`
- `src/app/interview/page.tsx`

原因：
- 初始访谈第一句话同时询问职业、AI 使用和目标时，用户容易只回答一部分，导致 `role` 或 `recentUse` 仍落到默认值。
- 中途对话出现“适合吗 / 是不是 / 贴合吗”这类封闭式问法，用户容易只回答“是/否”，不利于边聊边测。

改动：
- 第 0 轮开场主任务收敛为只问职业或身份，并校验模型输出不能同时询问 AI 使用方式或目标。
- researcher 背景阶段 prompt 按用户已回答轮数拆分：第一轮提取 `role` 并追问“你平时用 AI 主要做什么”；第二轮提取 `recentUse` 后进入个性化问卷。
- 中途对话开场 prompt 强制开放式提问，必须包含“你觉得”以及“你平时/你更希望”，并在有跳过题时引用 1-2 道代表题后询问哪些题不太贴。
- 中途开场 fallback 仅用于模型失败或空输出；正常模型输出直接展示，主要通过 prompt 约束开放式话术。

验证：
- `npm run typecheck`
- `npm run lint`
- `/api/chat/stream` 初始访谈 smoke
- `/api/mid-dialog/opening` 高/低跳过率 smoke

风险：
- 初始两轮仍依赖模型从自然语言中抽取 `role` 和 `recentUse`；当前选择保持 prompt 驱动，不加入强制表单式 gate，以保留“边聊边测”的体验。

### 2026-04-30：Phase 6 中途对话防卡住

位置：
- `src/lib/researcher.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/stream/route.ts`

原因：
- 中途对话里用户说“我说不清楚 / 嗯”这类低信息回复时，模型可能持续返回 `needs_more_context`，导致前端一直停在聊天界面，第二部分问卷不出现。
- OpenAI-compatible tool-call 模式下模型可能只返回工具调用、不返回正文；旧逻辑会把 `directive.hint` 当成用户可见回复，导致“用更具体的日常行为场景引导用户描述”这类内部指令泄漏到聊天气泡。

改动：
- 增加中途对话专用可见回复兜底，不再把 `directive.hint` 当作用户回复展示。
- prompt 明确 `directive.hint` 是内部提示，正文才是用户会看到的内容。
- 中途对话收敛为一轮：除非用户明确退出，否则按当前场景 `finish_mid_dialog` 并 `shouldGenerateNextBatch=true`。

验证：
- `npm run typecheck`
- `npm run lint`
- `/api/chat/stream` 复现 smoke：用户先说“我说不清楚”，再说“嗯”，第二轮返回 `finish_mid_dialog` 且 `shouldGenerateNextBatch=true`。

风险：
- 低信息回复会按当前上下文继续生成第二部分，可能少拿到一条场景修正；这是为了避免用户被卡在中途对话里。

### 2026-04-30：Phase 6 问卷生成完成过渡

位置：
- `src/lib/researcher.ts`
- `src/app/api/questionnaire/generate/route.ts`
- `src/app/interview/page.tsx`

原因：
- 问卷生成完成后直接切入问卷页，用户感知上从“聊天”突然跳到“作答”，缺少自然承接。
- 批次生成时模型已经掌握本批题的设计意图，应该让它给用户一句简短过渡，而不是只显示加载状态。

改动：
- `generate_questionnaire_batch` 工具新增 `userFacingMessage`，要求模型输出一条用户可见的生成完成提示。
- `/api/questionnaire/generate` 返回模型生成的 `message`；只有模型/API 失败或问卷结构校验失败并启用本地 fallback 问卷时，才使用本地批次完成提示。
- 前端生成完成后回到聊天流并追加完成提示；底部输入框替换为“开始第 X/2 部分问卷”按钮；用户点击后再进入问卷作答。
- 进入第一部分问卷前不再展示 qwen3.6-plus 过渡正文；前端只显示“个性化生成问卷中”的气泡 2.5s，再进入全屏生成态。

验证：
- `npm run typecheck`
- `npm run lint`
- `/api/questionnaire/generate` smoke：返回 12 题和 model `message`

风险：
- `userFacingMessage` 质量依赖模型；正常模型成功但文案为空时不会显示本地拟人化兜底，用户会直接看到开始问卷按钮。只有模型/API 失败或本地 fallback 问卷启用时才显示 deterministic 兜底文案。
- 若转问卷轮 qwen3.6-plus 输出过渡正文，这句会被隐藏；这是为了避免生成问卷前出现冗余对话步骤。

### 2026-04-30：Phase 6 中途对话完成补句契约

位置：
- `src/lib/researcher.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/stream/route.ts`

原因：
- 中途对话完成并触发第二部分问卷时，OpenAI-compatible tool-call 成功路径可能只有工具调用、没有正文，导致前端无可见助手过渡消息。
- JSON `/api/chat` 与 `/api/chat/stream` 需要一致返回 `thinkDurationSec`，方便前端展示同一耗时语义。

改动：
- 当 `shouldGenerateNextBatch=true` 或 `directive.action="finish_mid_dialog"` 但首个模型工具响应无正文时，API 先调用模型补写一句直接面向用户的过渡话。
- deterministic fallback 只在模型补句失败时使用；正常模型成功但无正文不再静默推进，也不展示 `directive.hint`。
- `/api/chat` 成功响应补齐 `thinkDurationSec`，与流式 done payload 对齐。

验证：
- `npm run typecheck`
- `npm run lint`
- `npm run test:browser`
- `npm run check:llm`
- `npm run check:llm-tools`
- Phase 6 self-test 覆盖中途对话内部提示清洗

风险：
- 补句是第二次模型调用，极端慢网关下可能增加一次延迟；若失败则使用短 deterministic 过渡句保证流程不空转。

### 2026-04-30：Phase 7 对话式反馈收集

位置：
- `src/lib/feedbackAgent.ts`
- `src/app/api/feedback/chat/route.ts`
- `src/app/api/feedback/route.ts`
- `src/lib/feedbackStorage.ts`
- `src/components/FeedbackDialogue.tsx`
- `src/app/report/page.tsx`
- `src/app/feedback-debug/page.tsx`

原因：
- 静态评分表单只能得到“有用/没用”这类弱信号，难以指导下一轮 prompt、题目和报告结构改进。
- 项目主体验是“边聊边测”，报告反馈也应由 Claude 通过 1-2 轮对话收集具体感受，再整理成可执行反馈。

改动：
- 新增 Feedback Agent prompt 和 tool schema，要求最多追问一次，随后输出结构化反馈。
- 报告页底部新增反馈对话组件，Claude 整理完成后自动写入 Notion。
- 新增 `/feedback-debug` 调试页和首页调试入口。
- Notion 写入使用 REST API；失败或未配置时落到 `.local-debug/feedback/`。

验证：
- `npm run typecheck`
- `npm run lint`
- `npm run test:browser`
- `/feedback-debug` 真实对话和 Notion 写入 smoke

风险：
- 调试页使用真实反馈接口，提交会写入 Notion；测试记录需要在 Notion 中清理。
- Notion schema 字段名是运行时契约，字段重命名会触发本地 fallback。

## Prompt 质量要求

### AI-MBTI

- 背景访谈只收集背景和目标，不直接判定维度。
- 结构化访谈状态与问卷生成优先走 tool call，不再依赖 JSON-tail 文本解析。
- 问卷题面必须贴合用户真实使用场景。
- 报告必须解释“为什么是这个倾向”，不能只贴标签。
- 目标相关建议和可直接使用的 prompt 模板是报告核心价值的一部分。

### AI-HQ

- v0.1 已暂时归档，不再作为首页主入口。
- 旧的固定 5 段访谈和报告 prompt 只作为兼容路径保留。
- 不再扩展独立 AI-HQ 主入口；未来若恢复，应作为 AI-MBTI 报告补充模块重新设计。
