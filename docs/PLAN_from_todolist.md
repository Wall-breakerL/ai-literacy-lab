# 基于 Todolist 的修改计划

根据 `todolist.md` 中四项待办，制定以下可执行计划。实施时需与 `docs/00–05` 及 `.cursor/rules/core-principles.mdc` 保持一致。

---

## 1. Memory（对话记忆 / 上下文持久化）

**现状**：对话仅存在于单次会话的 React state；刷新或离开即丢失；无跨会话或跨场景的记忆。

**目标**：在不大改 MVP 边界的前提下，增加「单次会话内上下文持久化」与可选的「跨会话轻量记忆」能力。

| 步骤 | 内容 | 涉及文件/模块 |
|-----|------|----------------|
| 1.1 | **会话内持久化**：将当前会话的 `messages` + `scenarioId` + `profile` 写入 `sessionStorage`，进入 chat 页时恢复；离开/提交评估时清理或归档。 | `app/chat/[scenarioId]/page.tsx`、可选 `lib/session-storage.ts` |
| 1.2 | **恢复与提示**：若检测到有未完成会话（同 scenarioId），询问「是否继续上次对话」再决定是恢复还是重新开始。 | 同上 |
| 1.3 | **（可选）跨会话记忆**：若需「同一用户多场景历史」或「同一场景多次尝试对比」，可增加轻量后端或 localStorage 的 session 列表（id、scenarioId、createdAt、lastMessageAt），MVP 可只做列表展示与「从某次会话恢复」的只读查看，不要求影响本次评分。 | 新 API 或 `lib/memory.ts`、前端 session 列表页或 result 页入口 |

**优先级**：1.1–1.2 为 P1（体验直接相关），1.3 为 P2（后续扩展）。

---

## 2. 界面与视觉（UI / 排版 / 风格）

**现状**：各页为内联 style、无统一设计系统；`globals.css` 仅基础 reset 与打字动画；视觉层次和品牌感不足。

| 步骤 | 内容 | 涉及文件/模块 |
|-----|------|----------------|
| 2.1 | **设计 token**：在 `app/globals.css` 或单独 `tokens.css` 中定义 CSS 变量：主色、背景、文字层级色、圆角、间距、字号阶梯、阴影等，全站统一引用。 | `app/globals.css` 或 `app/tokens.css` |
| 2.2 | **布局与排版**：首页、profile、chat、result 统一 max-width、padding、标题层级与段落间距；主 CTA 统一样式（如 .btn-primary）。 | 各 `app/**/page.tsx`、共用组件可选 `components/Button.tsx` |
| 2.3 | **Chat 页**：气泡、输入框、发送按钮、思考折叠区使用 token；可增加浅色/深色主题变量，便于后续暗色模式。 | `app/chat/[scenarioId]/page.tsx`、`globals.css` |
| 2.4 | **结果页**：总分与五维用卡片或清晰分区；进度条或环形图展示维度分（0–100）；建议与证据区层次分明。 | `app/result/page.tsx` |
| 2.5 | **字体与品牌**：选用一到两种字体（如标题 + 正文），避免纯 system-ui 的「默认感」；可保留无衬线、偏中性气质的字体以符合「评估/教育」场景。 | `app/layout.tsx`（font）、`globals.css` |

**优先级**：2.1–2.4 为 P1，2.5 为 P2。

---

## 3. 评分设计（权重与维度）

**现状**：权重在 `lib/constants.ts` 中固定为 clarity 20%、context 25%、steering 20%、judgment 20%、safetyOwnership 15%；规则 Judge 用事件数量线性映射 0–5；校正规则在 `lib/rule-corrector.ts` 中实现。

**原则**：修改前需先更新 `docs/03_rubric.md` 与 `docs/04_eval_spec.md`，再改代码，以保持文档与实现一致。

| 步骤 | 内容 | 涉及文件/模块 |
|-----|------|----------------|
| 3.1 | **需求与依据**：明确「不合理」的具体点（例如：某维度过高/过低、与教学目标不符、区分度不足）。在 `docs/` 中写一小节「权重与维度修订说明」，记录修改理由与目标（例如：加强 Judgment 区分「被 AI 带着走」）。 | `docs/03_rubric.md` 或新 `docs/03_rubric_changelog.md` |
| 3.2 | **权重调整**：若确定新权重，在 `docs/03_rubric.md` 中更新表格与百分比，保证总和 100；再在 `lib/constants.ts` 中更新 `RUBRIC_WEIGHTS`；同时检查 `lib/judge-rule.ts`、`lib/rule-corrector.ts`、`lib/llm/judge.ts` 中是否写死权重或说明，一并改为从 constants 读取或与文档一致。 | `docs/03_rubric.md`、`lib/constants.ts`、`lib/rule-corrector.ts`、`lib/llm/judge.ts` |
| 3.3 | **规则 Judge 映射**：若当前「事件数 → 0–5」过于线性，可改为分段或引入「关键事件有无」逻辑（例如：无 verification_requested 则 judgment 上限 2），与 `docs/07` 的规则校正表对齐；必要时在 `lib/judge-rule.ts` 中增加注释引用文档。 | `lib/judge-rule.ts`、`docs/07_how_we_score.md` |
| 3.4 | **规则校正**：确认 `rule-corrector.ts` 中缺项降级、敏感行为扣分的阈值与 docs/07 一致；若有新规则（如某维无某类事件则封顶），先在 docs 中补充再实现。 | `lib/rule-corrector.ts`、`docs/07_how_we_score.md` |

**优先级**：3.1 必做（避免盲目调参）；3.2–3.4 依产品/教学反馈决定是否在本轮实施。

---

## 4. 文案与提示（提示词与引导词）

**现状**：Judge 的 prompt 在 `lib/llm/judge.ts`（含五条硬约束）；Chat 的 system prompt 在 `lib/llm/chat.ts`；前端引导/说明分散在各页的文案中。

| 步骤 | 内容 | 涉及文件/模块 |
|-----|------|----------------|
| 4.1 | **Judge prompt**：保持五条原则不变；将「五维定义与百分制」和「输出 JSON 说明」改为更自然、易读的段落；可把 anchor（0 完全缺失…5 非常成熟）单独成段，便于模型对齐；校验 `getJudgeOutputSchemaHint()` 与当前 Judge 实际使用的 schema 一致。 | `lib/llm/judge.ts` |
| 4.2 | **Chat system prompt**：在「不泄露题目、不教刷分」的前提下，把「当前用户可见的任务是：…」写得更像真实助手口吻；可区分学生/通用场景的措辞（仅语气差异，不改变任务内容）。 | `lib/llm/chat.ts`、若需按 profile 分支可读 `scenario` 与 profile |
| 4.3 | **前端引导**：首页「开始评估」、profile「选择你的画像」「进入场景」、chat 任务说明与占位符、result「再测一次」等，统一语气（友好、简短、不学术化）；可集中到 `lib/copy.ts` 或按页拆分为常量，便于后续多语言或 A/B 文案。 | 各 `app/**/page.tsx`、可选 `lib/copy.ts` |
| 4.4 | **场景 visibleTask / hiddenChecks**：若场景文案来自 `scenario-loader`，检查并打磨各场景的 `visibleTask` 与对用户的说明，确保自然、无剧透。 | `lib/scenario-loader.ts` 或场景数据源 |

**优先级**：4.1–4.3 为 P1（影响评分质量与体验），4.4 视场景数据位置而定。

---

## 建议执行顺序

1. **先做 4（文案与提示）**：无结构变更，风险小，且能立刻提升 Judge 与对话质量。  
2. **再做 2（界面与视觉）**：用设计 token 和统一布局打底，再逐页优化。  
3. **然后做 1（Memory）**：先实现 1.1–1.2 会话内恢复，再考虑 1.3。  
4. **最后做 3（评分设计）**：在 3.1 写清修订依据后，再改权重与规则，并同步文档与代码。

若你希望先落地某一项，可指定编号（如「先做 2 和 4」），我可以按该顺序给出更细的 task 列表或直接改对应文件。
