# Codex 下一阶段工作目标

> 目标读者：Codex（接手实现的工程 agent）。本文档把当前讨论得出的三项优化整理成可执行任务，交付节奏建议按 Phase 1 → 2 → 3 顺序推进，每个 Phase 内部任务可并行。

## 0. 背景与动机

当前实现存在三个被识别出的问题：

1. **Agent 拆分已经超出必要**：A/B 拆分原本是为了让便宜模型说话、贵模型出 JSON。改接 Opus 后这个动机消失，两次串行调用反而拉长延迟、放大失败面、让 directive 中间表示成为噪声。
2. **没有独立 memory 层**：每轮把整个 transcript 拼进 user prompt，模型每次重新写 `background_summary`；`evidence` 只能在问卷阶段从题面里取，访谈中的有用片段被丢弃；后续 session 复用不可能。
3. **AI-HQ 体感僵硬**：probe 是关键词匹配式打分，价值预设偏程序员、不绑定用户场景；与 AI-MBTI 并列入口，反而互相分散用户注意力和团队精力。

本轮优化目标：**把产品收敛到 AI-MBTI 单一主线，把 agent 收敛到单角色 + tool use，把记忆收敛到显式 SessionState。**

---

## Phase 1：单 Agent + Tool Use 改造

### 目标

用一个角色「AI 协作风格研究员」替代当前 Agent A + Agent B 的串行调用；模型同时负责自然对话和结构化状态更新；结构化部分通过 Anthropic tool use 触发，而不是 JSON-tail 解析。

### 验收标准

- `/api/chat/stream` 一次 LLM 调用就能完成"出聊天回复 + 更新 state"，不再做 B → A 的两次串行。
- 服务端依然能拿到结构化 `targetContext`、`background_summary`、`evidence`，并据此决定何时进入问卷阶段。
- 进入问卷阶段后再触发一次单独调用生成 16 题问卷（与第 3 轮分开，避免 tool use 强行塞进对话轮）。
- 模型彻底罢工时，`FALLBACK_QUESTIONNAIRE` 兜底路径仍然有效。
- 现有 `/test-lab` 烟测继续通过，新增针对 tool use 解析的烟测。

### 关键改动点

**1. 新建 `src/lib/researcher.ts`，替代 `src/lib/agents.ts`**

- 导出 `RESEARCHER_SYSTEM`：合并 `AGENT_A_SYSTEM` 的访谈语气要求 + `AGENT_B_SYSTEM` 的四维定义、计分方向、targetContext schema。
- 删除 directive 概念（probe_new / probe_deep / conclude），让模型直接通过自然对话推进。
- 删除"两轮就进问卷"的硬规则在 prompt 里的表述，改成由服务端轮数判断。
- 保留 `QUESTIONNAIRE_ENTRY_ROUND = 2`。
- 保留 `RESEARCHER_REPORT_SYSTEM`（原 `AGENT_B_REPORT_SYSTEM`），逻辑不变，只去掉 directive/dimension-advice 残留措辞。

**2. 定义 tool schema**

在 `researcher.ts` 中定义两个工具：

```ts
export const UPDATE_SESSION_STATE_TOOL = {
  name: "update_session_state",
  description: "在每次自然回复用户的同时，沉淀本轮新增的用户背景、目标、维度信号到 session state。",
  input_schema: {
    type: "object",
    properties: {
      backgroundPatch: {
        type: "object",
        properties: {
          role: { type: "string" },
          tools: { type: "array", items: { type: "string" } },
          recentUse: { type: "string" },
          goal: { type: "string" },
          goalStatus: { type: "string", enum: ["specific", "generic", "missing"] },
          goalType: {
            type: "string",
            enum: [
              "product_building",
              "research_writing",
              "learning",
              "coding_system",
              "business_decision",
              "daily_efficiency",
              "creative_work",
              "other",
            ],
          },
        },
      },
      newEvidence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dimension: {
              type: "string",
              enum: ["Relation", "Workflow", "Epistemic", "RepairScope"],
            },
            quote: { type: "string", description: "用户原话或精炼摘录" },
            signal: { type: "string", enum: ["strong", "weak"] },
          },
          required: ["quote"],
        },
      },
      openProbes: {
        type: "array",
        items: { type: "string" },
        description: "本轮没问到、希望问卷阶段重点覆盖的话题",
      },
    },
  },
};

export const GENERATE_QUESTIONNAIRE_TOOL = {
  name: "generate_questionnaire",
  description: "基于当前 session state 输出 16 道（每维 4 题）或 20 道（每维 5 题）专属问卷。",
  input_schema: {
    /* QuestionnaireQuestion[]，结构沿用 src/lib/types.ts 中的 QuestionnaireQuestion */
  },
};
```

只在轮数 ≥ `QUESTIONNAIRE_ENTRY_ROUND` 时把 `generate_questionnaire` 加入 tools 列表，避免模型在前两轮乱触发。

**3. 改写 `src/lib/claude.ts`**

- 新增 `createClaudeMessageWithTools({ model, system, messages, tools, toolChoice })` 辅助：返回 `{ textBlocks: string[], toolUses: { name, input }[], stopReason }`。
- Anthropic provider 直接走 `/messages`，把 `tools` 字段传上去；OpenAI-compatible provider 走 `/chat/completions` 的 `tools` + `tool_choice`，二者结构差异在这一层吸收。
- 流式接口 `createClaudeMessageStream` 增加 yield `{ type: "text", delta }` 和 `{ type: "tool_use", name, partialInput }` 两种事件，前端只渲染 text。
- `stripHiddenReasoning` 在 tool use 模式下不再需要——thinking block 是 API 层显式分类的，按 `block.type !== "thinking"` 过滤即可。这块代码可以瘦身。

**4. 改写 `src/app/api/chat/stream/route.ts`**

伪代码：

```ts
const { messages, sessionState, roundCount } = body;
const phase = roundCount >= QUESTIONNAIRE_ENTRY_ROUND ? "generate_questionnaire" : "interview";

const tools = phase === "generate_questionnaire"
  ? [GENERATE_QUESTIONNAIRE_TOOL]
  : [UPDATE_SESSION_STATE_TOOL];

const result = await createClaudeMessageWithTools({
  model: RESEARCHER_MODEL,
  system: RESEARCHER_SYSTEM,
  messages: buildResearcherMessages(messages, sessionState, phase),
  tools,
  toolChoice: phase === "generate_questionnaire" ? { type: "tool", name: "generate_questionnaire" } : "auto",
});

// 流式部分边收边推 delta；tool_use 在最后一帧落地
const newState = applyStatePatch(sessionState, result.toolUses);
const questions = phase === "generate_questionnaire"
  ? extractQuestions(result.toolUses) ?? FALLBACK_QUESTIONNAIRE
  : undefined;
```

第一轮开场白改成**服务端直接返回固定字符串**，不调模型，避免每次 token 浪费和漂移。

**5. 删除/迁移**

- `buildAgentAPrompt`、`buildAgentBPrompt`、directive 相关分支：迁移到 `researcher.ts` 的 `buildResearcherMessages`，简化为「persona system + state 序列化 + 新消息 + 本轮任务说明」三段。
- `agents.ts` 整体在 Phase 1 结束后删除，导入处全部迁移。
- env 变量：`CLAUDE_AGENT_A_MODEL` / `CLAUDE_AGENT_B_MODEL` 二选一保留为 `CLAUDE_RESEARCHER_MODEL`，默认值 `claude-opus-4-6`。`.env.local.example` 同步更新。

### 风险与回退

- Opus 单点故障：保留 `FALLBACK_QUESTIONNAIRE`，并在 `researcher.ts` 留一个 `RESEARCHER_FALLBACK_MODEL`（默认 `claude-sonnet-4-6`），调用失败时降级。
- Streaming + tool use 在 OpenAI-compatible 网关上的兼容性参差不齐：兼容层失败时自动降级到非流式调用。

---

## Phase 2：SessionState Memory 层

### 目标

把 transcript 重复输入 + 每轮重写摘要的现状，替换成显式 `SessionState`，作为单 agent 的"记忆"。

### 验收标准

- `SessionState` 在 `src/lib/types.ts` 中有完整类型，跨访谈/问卷/报告三个阶段共享。
- 单轮 prompt token 量不再随对话长度线性增长（transcript 一旦被总结就从 prompt 中移除，仅保留最近 1 轮原文）。
- Report 阶段能直接引用 `evidence[]` 中的用户原话作为依据，而不只是问卷题面。
- `.local-debug/interview-runs/*.json` 增加每轮 `stateBefore` / `statePatch` / `stateAfter` 三段，便于回放。

### 关键改动点

**1. `SessionState` 类型**

放进 `src/lib/types.ts`：

```ts
export interface SessionState {
  sessionId: string;
  turn: number;
  phase: "interview" | "questionnaire" | "report";
  background: {
    role: string;
    tools: string[];
    recentUse: string;
    goal: string;
    goalStatus: GoalStatus;
    goalType: GoalType;
  };
  evidence: {
    turn: number;
    dimension?: Dimension;
    quote: string;
    signal: "strong" | "weak";
  }[];
  openProbes: string[];
  questionnaire?: QuestionnaireQuestion[];
  answers?: QuestionnaireAnswer[];
}

export type SessionStatePatch = Partial<
  Pick<SessionState["background"], "role" | "tools" | "recentUse" | "goal" | "goalStatus" | "goalType">
> & {
  newEvidence?: SessionState["evidence"];
  openProbes?: string[];
};
```

**2. State 工具函数**

新建 `src/lib/sessionState.ts`：

- `createInitialState(sessionId): SessionState`
- `applyStatePatch(state, patches: SessionStatePatch[]): SessionState`：合并多个 tool_use 触发的 patch，evidence 用 append + 去重，background 字段非空覆盖。
- `summarizeTranscriptForState(state): string`：把 state 序列化成模型可读的紧凑 markdown，喂给下一轮 prompt。
- `pruneOldTranscript(messages, keepLastN = 2)`：除最近 N 轮外，旧的 user/assistant 消息被替换为单条「（上文已总结到 state）」占位。

**3. 客户端持久化（MVP）**

- 在 `/interview` 页面用 `useState` + `useRef` 维护 `SessionState`，每次 fetch 时序列化在 body 里送给 `/api/chat/stream`。
- 不引入 KV/DB，session 跨刷新会丢——MVP 阶段接受这个取舍。
- `valuable-question.md` 里追加一条记录：服务端持久化推迟到 Phase 4。

**4. Prompt caching 启用**

- `RESEARCHER_SYSTEM` 较长且稳定，符合 Anthropic prompt caching 的成本回收门槛。在 `createClaudeMessageWithTools` 里给 system block 加 `cache_control: { type: "ephemeral" }`。
- 同时给「state 序列化」那段也加 cache_control，因为同一 session 内两次调用之间 state 增量不大，部分前缀可复用。

**5. Report 阶段联动**

- `/api/report` 接收 `SessionState` 而不是裸 transcript + answers。
- `RESEARCHER_REPORT_SYSTEM` 的 prompt 显式要求 evidence 字段优先引用 `state.evidence` 中标注 `signal=strong` 的 quote；问卷题面作为第二来源。
- `mergeScoredDimensions` 现在 evidence 取自问卷题，可以扩展为合并 state evidence 和题面 evidence，去重后取前 2-3 条。

### 风险与回退

- patch 合并冲突：当模型在同一轮多次更新 `goal` 时，按"最后一次非空覆盖"处理，记日志。
- token 预算：state 序列化要有上限（建议 evidence 保留最近 12 条，更老的入"压缩历史"）。

---

## Phase 3：聚焦 MBTI 主线，HQ 下线

### 目标

把 AI-HQ 入口和首页位置撤掉，代码保留作为 v0.1 归档。释放出的产品力压在 MBTI 报告体验和访谈质量上。

### 验收标准

- 首页 (`src/app/page.tsx`) 不再露出 `/hq-interview` 入口；可访问但不主动引导。
- `/hq-interview` 和 `/hq-report` 路由保留，页面顶部加一行说明：「AI-HQ 模块正在重构中，下版本会以 AI-MBTI 报告补充模块的形式回来。」
- `npm run test:browser` 中的 HQ 相关 case 暂时跳过，标 `it.skip` 或挪到独立的 `selfTests.archive.ts`。
- README 的「页面结构」段落把 `/hq-interview` 和 `/hq-report` 标记为 `(archived)`。
- `valuable-question.md` 追加一条决策：HQ 暂存、未来作为 MBTI 子模块回归。

### 关键改动点

**1. 首页文案重写**

- 把 AI-MBTI 作为唯一主 CTA。
- 移除 AI-HQ 入口卡片或按钮。
- 在最底部放一段非常小的「正在开发：能力成熟度补充模块」预告，避免给当前用户造成负担。

**2. 不删代码**

- `src/lib/hqAgents.ts`、`src/lib/hqScoring.ts`、`src/app/api/hq-chat/*`、`src/app/api/hq-report/*` 保留。
- 在每个 HQ 文件顶部加一行注释：

  ```
  // [archived] AI-HQ v0.1 — pending rework as MBTI capability sub-module. See docs/codex-next-iteration.md §Phase 3.
  ```

**3. 后续重构方向（不在本轮范围）**

- HQ 的 5 段访谈应改成「跟 MBTI 同一段对话同时抽取 HQ 探针」，而不是独立流程。
- L1-L3 等级在新模块里降级成「成熟度补充建议」，避免给用户考试评分感。
- probe 的"提到关键词加分"改成「LLM 语义判定 + 给出证据 quote」，对齐 SessionState.evidence 模式。

---

## 落地节奏建议

| Phase | 预估工时 | 依赖 | 备注 |
|-------|----------|------|------|
| 1. 单 agent + tool use | 3-4 天 | 无 | 改完先在 dev 环境跑 5 个 fixture session |
| 2. SessionState memory | 2-3 天 | Phase 1 完成 | report 联动那一步要 Phase 1 提供的 evidence 链 |
| 3. HQ 下线 | 0.5 天 | 无 | 可与 Phase 1 并行 |

## 验收必跑清单

完成全部 Phase 后，以下命令必须全部通过：

```bash
npm run typecheck
npm run lint
npm run check:llm           # Opus 端点连通
npm run test:browser        # /test-lab ALL PASS（HQ case 标 skip）
```

并手动跑一遍：

1. 首页 → AI-MBTI 访谈：第 1 轮固定开场白、第 2 轮自然追问、第 3 轮进入问卷且题目绑定 role/recentUse。
2. 完成 16 题（其中至少跳过 2 题）→ 报告页：四维分数显示置信度，evidence 至少有 1 条来自访谈原话而非问卷题面。
3. `/hq-interview` 顶部出现 archived 提示，但流程仍可走完不报错。

## 可能踩的坑（提前提示）

- **Opus 输出中文 + tool_use 同时存在时**，部分 OpenAI-compatible 网关会把 tool 调用塞进 `message.content` 字符串里而不是 `tool_calls` 字段。在 `claude.ts` 兼容层里两边都看一下。
- **Streaming 时 tool_use 的 input 是分片的**，partial JSON。Anthropic SDK 风格是把 `input_json_delta` 累积到 stop_reason=tool_use 时再 parse。前端不要试图在中间渲染。
- **Prompt caching 命中需要前缀完全一致**——动态拼接的 state 序列化要保证字段顺序稳定。建议固定 key 顺序，不要依赖 `JSON.stringify` 的对象键自然顺序。
- **`.local-debug/interview-runs/` 增加 stateBefore/After 后单文件会变大**，注意继续保留 `.gitignore`，并考虑加一个 `.local-debug/.cleanup.sh` 定期清理 7 天以上的旧文件。

---

如果实现过程中发现本文档某条与代码现状冲突，以代码为准并在 `valuable-question.md` 追加一条说明，不要静默修改本文档。
