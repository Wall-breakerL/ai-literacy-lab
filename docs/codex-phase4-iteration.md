# Codex Phase 4 工作目标

> 上一轮（`codex-next-iteration.md` 中的 Phase 1/2/3）已完成约 70%。本文档先列出尚未达成的遗留项作为前置任务，再展开 Phase 4 的核心新功能：**问卷阶段高跳过率触发二轮访谈 + 补题机制**。

## 2026-04-29 前置 Gap 完成记录

本节记录 Codex multi-agent workflow 对 Phase 4 前置遗留 Gap 的实际落地状态。下面「上一轮完成情况审计」中的 G1/G2/G3 是实施前审计结论，当前代码已修复：

- **G1 A/B 真合并：已完成。** AI-MBTI `/api/chat` 与 `/api/chat/stream` 现在由单一 researcher 调用同时产出自然回复 `textBlocks` 与结构化 `toolUses`；`src/lib/agents.ts` 已删除，AI-MBTI chat path 不再使用 `AGENT_A_SYSTEM` / `buildAgentAPrompt` / 第二次 `createClaudeMessageStream`。
- **G2 Prompt caching：已完成。** `src/lib/claude.ts` 支持 `string | text block[]` system prompt；Anthropic provider 保留 `cache_control: { type: "ephemeral" }`，OpenAI-compatible provider 会降级拼成纯文本；`ENABLE_PROMPT_CACHE=1` 默认开启。
- **G3 Quote evidence：已完成。** researcher tool schema 要求 `newEvidence`，`SessionEvidence` 区分 `quote` / `summary`，报告阶段优先引用 SessionState 中的用户原话 quote，并按维度优先匹配。
- **额外修复：流式体感与报告兜底。** `/api/chat/stream` 服务端现在分片发送多个 `delta`，不再只发送一整段文本；`parseJsonObjectFromModel` 在 shape 校验失败时会抛错，避免 `/api/report` 返回 200 但缺少 `summary`；报告 fallback 文案不再暴露“兜底版本”。

已验证：`npm run typecheck`、`npm run lint`、`npm run check:llm`、`npm run check:llm-tools`、`TEST_BASE_URL=http://localhost:3010 npm run test:browser`、`npm run build` 均通过；真实 `/api/chat/stream` 烟测返回多段 delta、Opus researcher、16 题问卷与 quote evidence；真实 `/api/report` 烟测返回模型生成 summary、recommendations 与 promptTemplates。

---

## 0. 上一轮完成情况审计

### 已完成

- `src/lib/researcher.ts`：tool schema、`UPDATE_SESSION_STATE_TOOL`、`GENERATE_QUESTIONNAIRE_TOOL`、`buildResearcherToolPrompt`、`agentBOutputFromToolUses` 都到位。
- `INTERVIEW_OPENING_MESSAGE` 是固定字符串，第一轮服务端不调模型。
- `src/lib/claude.ts`：新增 `ClaudeTool`、`ClaudeToolChoice`、`createClaudeMessageWithTools`，Anthropic 与 OpenAI-compatible 两套实现。
- `src/lib/sessionState.ts`：`createInitialSessionState`、`applySessionStatePatch`、`summarizeSessionStateForPrompt`、`pruneOldTranscript` 全部就位；evidence 与 openProbes 都有合并去重。
- `src/lib/types.ts`：`SessionState`、`SessionPhase`、`SessionEvidence`、`SessionStatePatch` 类型完整。
- `/interview` 页面：`useState` + `useRef` 维护 sessionState，`sessionStorage` 持久化，请求/响应都带 sessionState。
- `/api/report/route.ts`：接收 sessionState，并通过 `summarizeSessionStateForPrompt` 喂给报告 LLM。
- `src/lib/hqAgents.ts` 顶部加了 `[archived]` 注释。
- 首页只保留 AI-MBTI 入口，HQ 入口已下线，文案提示「能力成熟度补充模块正在重构中」。

### 原未完成 / 偏离设计的 3 个 Gap（已在 2026-04-29 修复）

**G1. A/B 双调用并未真正合并（核心遗留）**

`src/app/api/chat/stream/route.ts` 当前流程是：
1. 先调用 `createClaudeMessageWithTools` 让 researcher 通过 tool use 更新 state；
2. 再用 `createClaudeMessageStream` 让 `AGENT_A_MODEL` + `AGENT_A_SYSTEM` 流式生成自然回复。

也就是说，researcher 只替代了原 Agent B 的"出题/出 state"职责，Agent A 的"说人话"调用仍然存在。结果：

- 每轮仍然两次模型调用，没消除原本想消除的串行延迟。
- `agents.ts` 完整保留（`AGENT_A_SYSTEM`、`buildAgentAPrompt`），导入处也都还在用。
- `directive` 概念仍在 `researcher.ts` 里被用于驱动 Agent A（`directiveSchema`、`parseDirective`）。
- env 仍是 `CLAUDE_AGENT_A_MODEL` / `CLAUDE_AGENT_B_MODEL`，没有合并为 `CLAUDE_RESEARCHER_MODEL`，默认模型也未改成 Opus。
- `RESEARCHER_FALLBACK_MODEL` 没加。

**G2. Prompt caching 未启用**

`createClaudeMessageWithTools` 把 `system` 作为字符串直接发出，没用 Anthropic 的 `cache_control` block 形态。SessionState 序列化也没拆出可缓存前缀。

**G3. Evidence 链是退化实现**

`sessionState.ts` 的 `evidenceFromAgentBOutput` 只是把 `analysis.background_summary` 作为单条 weak evidence 写进去，没有从用户原话中抽取 quote。结果 `evidence[]` 装的全是 LLM 的二手总结，而不是设计文档里期望的"用户原话片段 + 维度信号"。报告阶段就拿不到差异化的证据。

> 这三个 Gap 都和本轮 Phase 4 强耦合：高跳过率触发的二轮访谈需要"什么领域已经聊过"的可信记忆（依赖 G3 真 evidence）；二轮重生成 16 题需要 researcher 角色清晰统一（依赖 G1 真合并）；多轮模型调用累积起来 token 成本敏感（依赖 G2 缓存）。所以下面会把它们作为前置任务一起做。

---

## Phase 4：高跳过率触发二轮访谈 + 补题

### 产品动机

现在问卷有 16 题、每维 4 题。如果用户对其中相当一部分点击「不了解 / 没想好」，说明 Agent B 生成的题目和用户实际场景错位——可能是访谈两轮没问到位、可能是 targetContext 推断错了。`reportScoring.ts` 现在通过 `confidence` 标记低信心维度，但**只是记录、不影响后续流程**，用户最终还是拿到一份信心度低的报告，体验差。

新机制：当总跳过率 ≥ 30%（或单维度跳过 ≥ 50%）时，自动进入「补题恢复流程」——回到访谈阶段做 1-2 轮针对性追问，重生成针对用户真实领域的 16 题第二轮问卷，最终用两轮答题合并计分。

### 验收标准

- 第一轮 16 题答完后，服务端检测跳过率，触发条件命中时不直接出报告，转入「补题访谈」阶段。
- 补题访谈不是简单重跑通用访谈，而是基于第一轮跳过题，定向追问用户更熟悉/更有兴趣的领域。
- 补题访谈后生成新一轮 16 题问卷（维度结构同第一轮），且题目绑定补访谈得到的新 targetContext。
- 第一轮的有效答案保留，第二轮补题答案合并；最终报告信心度提升，evidence 同时引用两轮内容。
- 用户全程透明，知道自己进入了"二轮"，且可以选择"跳过补题、直接出报告"。
- `/test-lab` 增加「补题触发」与「合并计分」两个 case。

### 关键设计

**1. 触发判定（服务端确定性）**

新增 `src/lib/skipRateRecovery.ts`：

```ts
export type RecoveryTrigger =
  | { triggered: false }
  | {
      triggered: true;
      reason: "global_skip" | "dimension_skip";
      globalSkipRate: number;        // 0~1
      dimensionStats: Record<Dimension, { answered: number; skipped: number; rate: number }>;
      mostSkippedDimensions: Dimension[];
    };

const GLOBAL_SKIP_THRESHOLD = 0.3;
const DIMENSION_SKIP_THRESHOLD = 0.5;

export function evaluateSkipRecovery(answers: QuestionnaireAnswer[]): RecoveryTrigger;
```

判定逻辑：

- 总跳过率 ≥ 0.3 → 触发，reason = `global_skip`。
- 任何单维度跳过率 ≥ 0.5（即 4 题中跳 ≥ 2）→ 触发，reason = `dimension_skip`，并在 `mostSkippedDimensions` 列出该维度。
- 二者同时满足 → 仍按 `global_skip`，但 `mostSkippedDimensions` 也填上。
- 计算时把"未作答"和"显式跳过"都算作跳过。

**2. SessionPhase 扩展**

`src/lib/types.ts` 中：

```ts
export type SessionPhase =
  | "interview"
  | "questionnaire"
  | "recovery_interview"   // 新增：补题访谈
  | "recovery_questionnaire" // 新增：补题问卷
  | "report";

export interface SessionState {
  // ...原字段
  recovery?: {
    trigger: RecoveryTrigger;
    firstRoundAnswers: QuestionnaireAnswer[];
    refinedTargetContext?: TargetContext;
    secondQuestionnaire?: QuestionnaireQuestion[];
    secondRoundAnswers?: QuestionnaireAnswer[];
    skipRequested?: boolean;  // 用户主动跳过补题
  };
}
```

**3. 流程图（服务端视角）**

```
interview (round 0) → interview (round 1) → questionnaire (16 题)
                                                    ↓
                                          evaluateSkipRecovery()
                                          ┌─────────┴─────────┐
                                          ↓ triggered=false   ↓ triggered=true
                                          report           recovery_interview
                                                                ↓ 1-2 轮追问
                                                           recovery_questionnaire (16 题)
                                                                ↓
                                                              report
                                            （报告合并两轮答案）
```

**4. Recovery interview 的 prompt 设计**

新增 `RECOVERY_INTERVIEW_TOOL`（在 `researcher.ts` 中）：

- 输入：第一轮 sessionState + 跳过题清单 + `mostSkippedDimensions`。
- 模型任务：定向追问 1-2 轮，目标是找到用户**真正熟悉、有亲身经验**的领域，并产出 `refinedTargetContext` + 新一批 `evidence`。
- 不是"再问一遍职业身份"，而是"看你之前有 X 题选了不了解，能否说说在 Y 这件事上你常用 AI 做什么？"——具体追问由模型基于 skipped 题面生成。
- prompt 里要明示：「不要再让用户回答自己不熟悉的事情；目标是找到他实际有经验的协作场景，把问卷从理论问题改造成他真实做过的事」。
- **Propose-then-confirm 模式**（来自 Claude Code Insights 启发）：与其单纯反问 "你常用 AI 做什么"，不如先**给一个基于跳过题反推的猜测**，让用户确认或纠正。例如："看你在「用 AI 推进产品方案」这类题上多次选'不了解'，但前面提到你是医生——是不是这些题离你日常太远了？你最常拿 AI 做的其实是科研写作吗？"。把"等用户回答"换成"提一个假设让用户回答 yes/no"，能显著降低用户疲劳和流程中断率。`buildRecoveryInterviewPrompt` 中要求模型每次追问都包含一句"你的猜测"。

`buildRecoveryInterviewPrompt`：

```ts
export function buildRecoveryInterviewPrompt(
  state: SessionState,
  trigger: RecoveryTrigger,
  recoveryRound: number  // 0 表示第一句追问，1 表示第二句
): string;
```

提示要求模型在 prompt 里说明：跳过题集中在哪些场景、哪些维度。

**5. Recovery questionnaire 生成**

`GENERATE_QUESTIONNAIRE_TOOL` 复用，但在 `buildResearcherToolPrompt` 里新增 `mode: "first" | "recovery"`：

- recovery 模式下，prompt 要求模型把第一轮被跳过的题面作为反例，新题不能再用类似场景；优先绑定补访谈得到的 `refinedTargetContext.recentUse`。
- 维度结构和题数保持一致（16 题，每维 4 题，每维至少各一道反向）。
- 第一轮已答的题，第二轮也要重新出，但场景可以换——这样合并时同维度有更多有效样本。

**6. 合并计分**

`src/lib/reportScoring.ts` 增加 `mergeRoundAnswers`：

- 优先用第二轮有效答案；第一轮跳过的题如果在第二轮答了，记入第二轮；第一轮答了第二轮也答的题，取**两轮均值**（不要丢弃，因为两轮都是有效信号）；只有第一轮答、第二轮没出的题，保留第一轮。
- `confidence` 重新计算时，分母用合并后的有效答案总数。
- DimensionReport 增加 `roundsUsed: 1 | 2` 字段，前端显示「基于 N 道有效回答（含 1 轮补题）」。

**7. 前端体验**

`src/app/interview/page.tsx`：

- 第一轮答完后，如果触发 recovery：
  - 不直接跳到 `/report`，弹一个轻量提示卡片：「这一轮里你对一些题目还不太确定。我们可以再聊 1-2 句，把题目调整得更贴合你常做的事情，要不要试试？」
  - 给两个按钮：「再聊一下」「直接出报告」。
- 选择「再聊一下」→ 进入 recovery_interview 模式（UI 上仍是聊天界面，但顶部 banner 提示"正在帮你重新调整问卷"）。
- 选择「直接出报告」→ `sessionState.recovery.skipRequested = true`，正常跳报告，但报告页顶部加一行「样本量较少，结论为初步观察」。

**8. 报告页提示**

`src/app/report/page.tsx`：

- 如果用户走完了二轮，报告顶部加一行小字：「本结论结合了你两轮共 N 道有效回答」。
- 如果用户跳过了补题，加一行：「部分维度有效样本较少，建议作为参考方向，不代表稳定画像」。

### 与遗留 Gap 的合并落实

**G1（A/B 真合并）**：在做 Recovery 流程之前先做完。

- 把 `agents.ts` 中的 `AGENT_A_SYSTEM`、`buildAgentAPrompt` 全部迁移到 `researcher.ts`。
- 让 researcher 同时输出 tool_use（state 更新）和 text block（自然回复）：Anthropic API 单次调用即可同时产出两种 content block。`buildResearcherToolPrompt` 改成「请直接对用户说一句自然中文回复，并同时调用工具更新状态」。
- `chat/stream/route.ts` 改成单次 `createClaudeMessageWithTools` 调用，stream 渲染 textBlocks，最后一帧落 toolUses。删除第二次 `createClaudeMessageStream` 调用。
- env：`CLAUDE_AGENT_A_MODEL` / `CLAUDE_AGENT_B_MODEL` 合并为 `CLAUDE_RESEARCHER_MODEL`（默认 `claude-opus-4-6`）。保留 `CLAUDE_RESEARCHER_FALLBACK_MODEL`（当前同样默认 `claude-opus-4-6`）。
- 删除 `agents.ts`，更新 `selfTests.ts` 中的相关 import。

**G2（Prompt caching）**：在合并完 researcher 之后做。

- `createClaudeMessageWithTools` 的 `system` 字段改为接受 `string | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[]`。
- Anthropic provider：发请求时把 `system` 序列化成 array of blocks，对长前缀块加 `cache_control: { type: "ephemeral" }`。
- OpenAI-compatible provider：忽略 cache_control，按 string 拼接（兼容性优先）。
- `RESEARCHER_TOOL_SYSTEM` 和「SessionState 摘要前缀」分别加 `cache_control`。
- env 变量 `ENABLE_PROMPT_CACHE`，默认开，方便 A/B 调试。

**G3（Evidence 真落地）**：在 recovery 机制设计中顺便修。

- `UPDATE_SESSION_STATE_TOOL` 的 input_schema 中 `newEvidence` 字段改为强制要求 `quote` 是用户原话片段（≤120 字），并要求 `dimension`（聊天阶段允许为空表示纯背景）。
- 新增字段 `evidence_kind: "quote" | "summary"`，区分原话引用和模型摘录。
- prompt 显式要求：「每轮如果用户说了任何能体现 Relation/Workflow/Epistemic/RepairScope 倾向的具体行为，必须以 quote 形式落到 evidence 里，至少 1 条；不要只放 summary」。
- `report/route.ts` 中：evidence 优先取 `evidence_kind = "quote"` 的最近 4 条。

### 风险与回退

- **二轮访谈用户体验疲劳**：必须在 UI 上明确"再聊 1-2 句"而不是"再来一轮访谈"。语气和题目数量都要克制。
- **补题与第一轮重复出题**：靠 prompt 约束 + 服务端 dedup 双层防护——recovery 问卷生成后，比对第一轮 question 字符串相似度，相似度过高的题强制让模型重生成。
- **合并计分边界**：第一轮跳过、第二轮也跳过的题，依然按"该题对该维度无贡献"处理；维度有效答案 = 0 时，分数兜底回 50 并标 `confidence: "low"`，不让 NaN 漏出。
- **触发阈值过低导致频繁触发**：上线前用 fixture 跑 10 个 session 测验阈值；若误触发率高，逐步上调到 0.35 或单维度 0.6。

### 落地节奏

| 步骤 | 工作 | 预估 |
|------|------|------|
| 4.1 | 修 G1：合并 researcher，单 LLM 调用产出 text + tool_use | 1.5 天 |
| 4.2 | 修 G2：prompt caching | 0.5 天 |
| 4.3 | 修 G3：evidence quote schema | 0.5 天 |
| 4.4 | `evaluateSkipRecovery` + SessionPhase 扩展 | 0.5 天 |
| 4.5 | recovery_interview 工具与 prompt | 1 天 |
| 4.6 | recovery_questionnaire 生成（dedup + refined targetContext） | 1 天 |
| 4.7 | `mergeRoundAnswers` 合并计分 | 0.5 天 |
| 4.8 | `/interview` 弹窗 + banner + 跳过路径 | 1 天 |
| 4.9 | `/report` 顶部说明 + 报告 evidence 联动 | 0.5 天 |
| 4.10 | `/test-lab` 增加 4 个 case：触发判定 / 不触发 / 合并计分 / 跳过补题 | 0.5 天 |

总计约 7-8 天。

### 验收必跑

```bash
npm run typecheck
npm run lint
npm run check:llm
npm run test:browser
```

并手动跑：

1. **触发场景**：完成 16 题，其中故意跳过 6 题（跳过率 37.5%）→ 出现「再聊一下」提示。点击进入，正常完成 1-2 轮追问 + 16 题二轮 → 报告显示"基于两轮共 X 道有效回答"。
2. **不触发场景**：完成 16 题，跳过 2 题（跳过率 12.5%）→ 直接进入报告，无补题提示。
3. **用户主动跳过场景**：触发条件命中，但点击"直接出报告"→ 报告顶部出现"样本量较少，结论为初步观察"。
4. **维度集中跳过场景**：仅 RepairScope 维度 4 题中跳 3 题（其他维度全答）→ 触发 recovery，recovery_interview 的追问明显聚焦在修复行为上。

---

如果实现过程中发现本文档某处与代码现状冲突，以代码为准并在 `valuable-question.md` 追加一条说明。

---

## Phase 5：报告页体验升级（来自 Claude Code Insights 启发）

> 这一阶段排在 Phase 4 完成之后。灵感来源是 Claude Code Insights 报告（已暂存于 `.local-debug/usage-report.html`）的结构性表达——它即使在 0 messages 数据的情况下，也通过分章节、可复制 prompt、横向 TOC、轻量幽默封底等设计让"个人化报告"读起来有产品感。我们的 MBTI 报告目前结构偏单调，可以把这套范式吸过来。

### 产品动机

当前 `/report` 页面是一段总览 + 四张维度卡 + 一段建议 + 几个 prompt 模板的线性结构。问题：

- 用户看完 16 题问卷已经累了，进报告页又是一长卷，没有"先看摘要再下钻"的入口。
- evidence 散落在维度卡里，没有对应的"我做对了什么 / 我容易卡在哪里"二分视角。
- promptTemplates 现在每报告只生成 1-3 个，可复制但不密集；用户拿走的可操作物品偏少。
- 报告结尾突兀，缺少"轻松收束"的产品感。

### 验收标准

- 报告页顶部新增 "At a Glance"（速览）卡片，4 段固定结构，每段都有"see more →"锚点跳转到详细章节。
- 报告页加横向 TOC 条，至少包含 6 个锚点章节。
- 增加 "On the Horizon"（远期展望）章节，根据 `goalType` + 当前画像给出 6-12 个月的协作进化路径建议。
- 每个维度卡至少配 1 条可直接复制的 prompt（带 "Copy" 按钮和"使用场景"标签）；总共至少 4-5 条可复制 prompt。
- 增加 "我的 AI 协作宣言"模块（CLAUDE.md analog）：一段 100-200 字、可直接 paste 到 ChatGPT/Claude/Cursor 系统提示词的个人化指令。
- 报告底部增加 "Fun ending" 模块——一句结合用户人格 code 的轻松总结，区别于正式的总评。
- 长内容章节默认折叠（`<details>` 或自定义 collapsible），减少首屏压力。
- 每个维度卡显式标注 confidence 来源：「基于 4 道有效回答」/「样本量较少，初步观察」。
- 报告字段中的 LLM 推断项加上"由模型估算"灰色 tag。

### 关键改动点

**1. 报告数据结构扩展**

`src/lib/types.ts` 中 `FinalReport` 增加：

```ts
export interface FinalReport {
  // ...原字段
  glance?: {
    strengths: string;        // 你做对了什么
    frictions: string;        // 容易卡住的地方
    quickWin: string;         // 下一次值得试的一句话
    horizon: string;          // 远期展望（绑定 goalType）
  };
  horizonScenarios?: HorizonScenario[];     // 3 段未来工作流推荐
  collaborationManifesto?: string;          // 个人化系统提示词文本
  funEnding?: { headline: string; detail: string };
  promptTemplates: PromptTemplate[];        // 已存在，扩展为每维度至少 1 条
}

export interface HorizonScenario {
  title: string;
  possibility: string;        // 描述未来可能达到的协作状态
  startingTip: string;        // 现在能做的第一步
  prompt: string;             // 可直接复制的 prompt（用来"试试看"）
}
```

**2. RESEARCHER_REPORT_SYSTEM 升级**

报告 prompt 改造成"分段生成"——为了避免单次输出过大且字段漂移，把原本一次性出整份报告改为两次工具调用：

- `generate_report_core`：返回 summary、tags、dimensions 的 analysis、recommendations。这是必要骨架。
- `generate_report_extras`：返回 glance、horizonScenarios、collaborationManifesto、funEnding、扩展 promptTemplates。这些是体验性内容。

服务端在 `/api/report` 中并行触发两个 tool call（同一 LLM 调用，多 tool）；任一失败时降级到原结构，保证骨架还能出。

**3. At a Glance 卡片**

`/report` 顶部第一屏：

- 4 个固定段落：你的协作风格亮点 / 容易卡住的地方 / 下一次值得试的 / 远期展望。
- 每段 60-100 字，绑定 `targetContext` 和最高/最低分维度。
- 每段右下角一个 see-more 链接，锚点跳到对应详细章节。
- 视觉上参考 Claude Code Insights 的暖色 gradient 卡片（在我们 Raycast 暗色主题下改用 `from-raycast-red/15 to-raycast-yellow/10` 之类的低饱和叠层）。

**4. TOC 横向导航**

紧接 At a Glance 下方放一行扁平 chip：

- 速览 / 我的画像 / 维度解析 / 我做对了什么 / 容易卡住的地方 / 可复制 prompts / 远期展望 / 我的 AI 协作宣言。
- chip 点击平滑滚到对应锚点。
- 移动端可横向滚动，不要 wrap，避免占两行。

**5. "我做对了什么" + "容易卡住的地方"**

把当前维度卡里的 evidence 按性质二分：

- "做对了什么"：取自 sessionState.evidence 中 signal=strong 的正向片段 + 分数明确的维度。
- "容易卡住的地方"：取自跳过率较高的维度 + 报告中识别出的潜在风险点（例如 Trusting 极高 + Auditing 极低，可能导致漏验证 AI 输出）。
- 每条都要附"具体证据"——直接引用 evidence 中的 quote 或问卷题面，不要泛泛而谈。
- 这两段呼应 Claude Code Insights 的 "Impressive Things" 和 "Where Things Go Wrong"，**确保哪怕用户得分较低，也能找到正面解读**——原报告即使在 0 数据情况下也写出了"You're early in your Claude Code journey, which means you have a clean slate"这种鼓励性语言，值得借鉴。

**6. 可复制 prompt 模板密集化**

- 每个维度卡末尾固定挂 1 条针对该维度的 prompt（贴合该用户的 targetContext）。例如 Workflow=Framed 高分用户，Workflow 卡里挂"在你给我具体任务前，先用 1 句话复述目标 + 列 3 步计划"模板。
- 整体 promptTemplates 章节再放 2-3 条跨维度的通用模板。
- 每条 prompt 都有 Copy 按钮（沿用现有交互），Copy 反馈 2 秒后复位。
- 每条带"使用场景"标签：刚开始任务时 / 卡住时 / 收尾时 / 复盘时。

**7. On the Horizon 模块**

3 张卡片，按 `goalType` 个性化：

- 比如 goalType="research_writing" → 卡片标题"自动化文献综述流程"、"实时数据可视化助理"、"跨语言学术写作伙伴"。
- 每张卡内容：possibility（一段 60-100 字的未来场景）+ startingTip（一句"现在能做的第一步"）+ 可复制 prompt（让用户立刻试一下）。
- prompt 必须可直接 paste，不要再带占位符 placeholder 让用户自己替换。
- 模型生成时强调"6-12 个月后随着模型能力提升 + 你的工作习惯调整，可以达到"——把测评从"你现在是 X 型"扩展到"你 6 个月后可以变成 X+1 型"，给用户成长视角。

**8. "我的 AI 协作宣言"模块**

新增板块。模型基于人格 code + targetContext 生成 100-200 字的"个人化系统提示词"，可直接 paste 到 ChatGPT / Claude / Cursor 的 custom instructions / system prompt 字段。

例如对 IFAL（细节修补师）医生用户：

```
我是一名医生，主要用 AI 做科研写作和文献综述。
我习惯先给你具体的任务和约束，再让你执行。
请你在生成长文本前，先用 1 句话复述你理解的目标，然后给我 3 步写作计划。
我会偏好局部修改而不是大段重写——如果某段需要调整，请只改那一段并标注理由，不要顺手重组其他部分。
我倾向于审计你的输出，欢迎你在不确定的地方主动标注「需要核实」或给出参考来源。
```

页面上提供单独 Copy 按钮和"使用方法"小字（"粘贴到 ChatGPT Custom Instructions / Claude Projects 系统提示词 / Cursor Rules"）。

这是比单条 promptTemplate 更高密度的可携带产物——用户离开报告页时能带走一段长期生效的设置。

**9. 折叠交互**

参考 `.collapsible-section` / `<details>` 模式：

- 维度卡的 analysis 长文默认折叠，标题点击展开。
- "On the Horizon" 三张卡片中只有第一张默认展开。
- 移动端可用 `<details>` 标签原生实现，桌面端可加 framer-motion 平滑展开动画（项目已装 framer-motion）。

**10. Fun ending**

报告最后一屏放一个暖色 gradient 卡片，一句话调侃 + 一句解释：

- 例：「细节修补师与 AI 的关系：永远在调最后一个分号。」（headline）
- 「16 道题里你最确定的答案，全部和'局部修改'有关。这就是你的协作签名。」（detail）
- 模型生成时要求用户人格 code + 一两条最具代表性的 evidence 揉成轻松一句，避免说教。
- 视觉上沿用 Raycast 暗色主题的暖色叠层（`from-raycast-yellow/15 to-raycast-red/15`）。

**11. 模型估算 tag**

凡是 LLM 推断的字段（confidence、glance 文本、horizon scenarios），在 UI 上加一个灰色小角标：「由模型估算」。这是诚实声明，也降低用户对 LLM 输出的过度信任——契合 Anthropic 透明性产品风格。

### 与 Phase 4 的依赖关系

- 必须在 Phase 4 完成后做。Phase 4 的 evidence 真落地（G3）是 At-a-Glance 和"做对了什么/容易卡住的地方"模块的数据基础——没有 quote 就只能用问卷题面，体验会差很多。
- recovery 流程触发后的报告，At a Glance 的"快速建议"段要明确说"我们结合了你两轮的回答"或"部分维度样本较少，结论为初步观察"，与 recovery 机制联动。

### 可能踩的坑

- **报告 prompt 拆两段后 token 涨**：拆分 generate_report_core 与 generate_report_extras 后总 token 会涨 30-50%，但因为 system prompt 已经走了 caching（来自 G2），实际成本增量受控。监控前两周成本曲线再决定是否合并。
- **OpenAI-compatible 网关的 multi-tool**：部分网关对单次调用多 tool（report_core + report_extras）支持差，必要时退化为两次串行调用。
- **At a Glance 内容与 dimensions analysis 重复**：要求模型生成 At a Glance 时**不能直接复述维度文本**，而要做"全局综合判断"——用一句话穿起 2-3 个维度，体现交互效应（例如 Framed + Auditing 的组合 vs. 单独高分各自的含义）。
- **collaborationManifesto 政治正确风险**：模型可能写出"我应该做 X"过于命令式的口吻；prompt 里规定第一人称口吻+"我倾向于" / "请你"句式，避免变成命令清单。
- **horizonScenarios 过于乐观**：要求模型加上"前提是你保持当前学习节奏"或"如果模型能力达到 Y 水平"这类条件句，避免做出空头承诺。

### 落地节奏

| 步骤 | 工作 | 预估 |
|------|------|------|
| 5.1 | FinalReport 类型扩展 + report core/extras 拆分 | 0.5 天 |
| 5.2 | RESEARCHER_REPORT_SYSTEM 升级 + 双 tool prompt | 1 天 |
| 5.3 | `/report` 增加 At a Glance + TOC | 1 天 |
| 5.4 | "做对了什么" / "容易卡住的地方" 二分模块 | 0.5 天 |
| 5.5 | promptTemplates 密集化 + Copy 反馈 | 0.5 天 |
| 5.6 | On the Horizon 三卡片 | 0.5 天 |
| 5.7 | 我的 AI 协作宣言模块 | 0.5 天 |
| 5.8 | 折叠交互 + Fun ending + 模型估算 tag | 0.5 天 |
| 5.9 | `/test-lab` 新增报告体验 case（At a Glance 字段齐全 / horizon 数量为 3 / 宣言长度合理） | 0.5 天 |

总计约 5.5 天。

### 验收必跑

```bash
npm run typecheck
npm run lint
npm run check:llm
npm run test:browser
```

并手动跑：

1. 完成一次完整 16 题问卷 → 报告顶部出现 At a Glance 4 段、TOC 8 个 chip 可点击跳转。
2. 维度卡可折叠展开；每张维度卡末尾有 1 条可复制 prompt。
3. 报告中段出现"我做对了什么"和"容易卡住的地方"，每条都附具体 evidence quote 而非泛泛之词。
4. On the Horizon 出现 3 张卡片，绑定用户 goalType；每张都有可复制 prompt。
5. 我的 AI 协作宣言模块出现一段 100-200 字第一人称指令，Copy 按钮可用。
6. 报告底部 Fun ending 卡片出现，一句调侃 + 一句解释，色彩与正文区分。
7. 走完 Phase 4 recovery 流程后，At a Glance 的"快速建议"段提到"我们结合了你两轮的回答"。

---

如果 Phase 5 实现过程中发现 At a Glance / Horizon / 宣言这类 LLM 生成质量始终不稳定，先把 Fun ending 和 Manifesto 做扎实即可——它们对 token 消耗影响小、对用户离开页面时的"可携带产物"价值最大。其他模块在质量稳定后再上线，避免一次性放出多个粗糙体验拉低整体观感。
