# Codex Phase 6 工作目标

> **Phase 4 删除**，改为 Phase 6：分批问卷 + 中途对话机制。目标：让用户在答题过程中有机会与 Agent 沟通，调整题目场景，避免"大量跳过"或"硬着头皮答完不适合的题"。

## 0. 背景与动机

当前问题：
- 用户在答 16 题问卷时，如果题目场景与自己实际情况不符，只能选择"不了解/没想好"跳过，或硬着头皮选一个
- 没有渠道在答题中途告诉 Agent"这些题不适合我"
- 最终可能导致高跳过率或低质量答案，报告信心度低

Phase 6 方案：
- 将 16 题扩展为 24 题，分三批放出（8+8+8）
- 每批答完后进入中途对话，Agent 用开放式问题了解题目与用户真实场景的偏差，用户可以反馈并调整后续题目
- 固定 24 题，必须答完才能出报告，避免"答多少题才够"的复杂逻辑

## 1. 核心流程

```
访谈（2 轮）
↓
生成第一批 8 题习惯题
↓
用户答第一批（习惯题）
↓
【对话 1】Agent 用开放式问题校准接下来要询问的场景
- Agent 根据第一批跳过率灵活调整询问深度
- 用户如果说不合适，说明自己实际场景
↓
生成第二批 8 题场景题（基于对话 1 调整后的场景）
↓
用户答第二批（场景题）
↓
【对话 2】Agent 用开放式问题收集场景题反馈和调整方向
- Agent 根据第二批跳过率灵活调整询问深度
- 用户反馈，Agent 调整混合题的场景
↓
生成第三批 8 题混合题（4 习惯 + 4 场景）
↓
用户答第三批（混合题）
↓
24 题全部答完 → 生成报告（基于 24 题计分）
```

## 2. 题目分配策略

### 2.1 总体结构

- **总题数**：24 题
- **每维题数**：6 题（3 正向 + 3 反向）
- **分批**：3 批，每批 8 题

### 2.2 每批分配

**第一批：8 题习惯题**
- 每维 2 题（1 正向 + 1 反向）
- 全部是习惯题（scenario 字段填 "习惯"）
- 例如："你平时让 AI 帮忙时，会先定好框架还是边聊边调整？"

**第二批：8 题场景题**
- 每维 2 题（1 正向 + 1 反向）
- 全部是场景题（scenario 字段填具体情境）
- 基于对话 1 调整后的场景生成
- 例如："在写科研报告时，你会先列好大纲让 AI 填充，还是让 AI 先写一版你再改？"

**第三批：8 题混合题**
- 每维 2 题（1 习惯 + 1 场景）
- 固定比例：4 习惯 + 4 场景
- 场景题基于对话 2 的反馈调整

### 2.3 正反向分配

每批 8 题中：
- 每维 2 题：1 正向 + 1 反向
- 保证每批都覆盖四维的正反向，样本均衡

## 3. 中途对话设计

### 3.1 对话 1：场景校准

**触发时机**：用户答完第一批 8 题习惯题后

**Agent A 的任务**：
1. 告知用户接下来会询问的场景（基于访谈时的 targetContext）
2. 用开放式问题了解用户对这个场景的看法和真实使用场景
3. 根据第一批跳过率灵活调整询问深度

**灵活调整策略**：
- **跳过率 < 25%（8 题中跳 < 2 题）**：简短确认
  - "接下来我会更多问你在科研写作中使用 AI 的情况。你觉得这个方向和你平时的使用方式有什么接近或不一样的地方？"
  - 用户说"继续"或补充一句真实场景即可
  
- **跳过率 25-50%（8 题中跳 2-4 题）**：详细询问
  - "刚才有几道题你选了'不了解'。接下来我会更多问科研写作场景，你觉得刚才哪些题不太贴近你？你平时主要用 AI 做什么？"
  
- **跳过率 > 50%（8 题中跳 > 4 题）**：深入沟通
  - "看起来刚才不少题都不太好回答。你觉得问题主要偏在哪里？你平时更希望围绕哪些 AI 使用场景来回答？"

**用户反馈处理**：
- 如果用户说"继续"或没有提供新场景：按原 targetContext 生成第二批场景题
- 如果用户说"不适合，我主要做 X"：更新 targetContext，基于新场景生成第二批场景题

**输出**：
- 更新后的 `targetContext`（如果用户提供了新场景）
- 传递给第二批问卷生成

### 3.2 对话 2：场景反馈校准

**触发时机**：用户答完第二批 8 题场景题后

**Agent A 的任务**：
1. 用开放式问题询问用户对场景题的感受
2. 收集用户建议
3. 根据第二批跳过率灵活调整询问深度

**灵活调整策略**：
- **跳过率 < 25%**：简短确认
  - "刚才这批题更多围绕你的具体使用场景。你觉得哪些题比较贴近你？有没有哪类场景你更希望后面继续问？"
  
- **跳过率 25-50%**：详细询问
  - "刚才有几道场景题你选了'不了解'。你觉得是场景方向不太对，还是题目问得太具体？你平时会怎么描述这类 AI 使用场景？"
  
- **跳过率 > 50%**：深入沟通
  - "看起来这批场景题对你来说仍然不太好回答。你觉得哪些场景偏离最多？你更希望接下来围绕什么任务、工具或工作流来问？"

**用户反馈处理**：
- 如果用户说"继续"、"挺好的"或没有提供新建议：按当前 targetContext 生成第三批混合题
- 如果用户说"场景还是不太对"：再次调整 targetContext，基于新场景生成第三批混合题
- 如果用户说"场景太具体了"：第三批混合题的场景部分改为更抽象的场景

**输出**：
- 最终调整后的 `targetContext`
- 传递给第三批问卷生成

### 3.3 对话的强制性

- 两次对话都是**必须的**，不允许跳过
- 但对话可以很简短（用户说"继续"或"没问题"即可）
- 目的：给用户表达"不适合"和补充真实场景的机会，即使他们不主动说

## 4. 问卷生成策略

### 4.1 分三次生成

**第一次生成**：访谈后
- 生成第一批 8 题习惯题
- 基于访谈时的 targetContext
- 工具：`GENERATE_QUESTIONNAIRE_TOOL`，mode: "habit_batch"

**第二次生成**：对话 1 后
- 生成第二批 8 题场景题
- 基于对话 1 调整后的 targetContext
- 工具：`GENERATE_QUESTIONNAIRE_TOOL`，mode: "scenario_batch"

**第三次生成**：对话 2 后
- 生成第三批 8 题混合题（4 习惯 + 4 场景）
- 基于对话 2 调整后的 targetContext
- 工具：`GENERATE_QUESTIONNAIRE_TOOL`，mode: "mixed_batch"

### 4.2 题目去重

**问题**：三次生成可能导致题目重复

**防护**：
- 每次生成时，把前面已生成的题目 question 文本传给模型
- Prompt 要求："不要生成与以下题目相似的问题：[已有题目列表]"
- 服务端检查字符串相似度（阈值 0.7），如果重复率 > 30%，重新生成（最多 1 次）

### 4.3 兜底机制

**如果模型生成失败或格式不合格**：
- 第一批：使用固定的 8 题习惯题兜底问卷
- 第二批：使用固定的 8 题场景题兜底问卷（通用场景）
- 第三批：使用固定的 8 题混合题兜底问卷

兜底问卷存放在 `src/lib/fallbackQuestionnaire.ts`，扩展为三批。

## 5. SessionState 扩展

### 5.1 新增字段

`src/lib/types.ts` 中 `SessionState` 增加：

```ts
export interface SessionState {
  // ...原字段
  questionnaireBatches?: {
    batch1?: QuestionnaireQuestion[];  // 第一批 8 题习惯题
    batch2?: QuestionnaireQuestion[];  // 第二批 8 题场景题
    batch3?: QuestionnaireQuestion[];  // 第三批 8 题混合题
  };
  batchAnswers?: {
    batch1?: QuestionnaireAnswer[];    // 第一批答案
    batch2?: QuestionnaireAnswer[];    // 第二批答案
    batch3?: QuestionnaireAnswer[];    // 第三批答案
  };
  midDialogues?: {
    dialog1?: Message[];               // 对话 1 记录
    dialog2?: Message[];               // 对话 2 记录
  };
  refinedTargetContext?: TargetContext;  // 对话后调整的 targetContext
}
```

### 5.2 Phase 字段扩展

```ts
export type SessionPhase =
  | "interview"
  | "questionnaire_batch1"      // 第一批答题
  | "mid_dialog1"               // 对话 1
  | "questionnaire_batch2"      // 第二批答题
  | "mid_dialog2"               // 对话 2
  | "questionnaire_batch3"      // 第三批答题
  | "report";
```

## 6. API 路由改动

### 6.1 `/api/chat/stream` 改动

**新增逻辑**：
- 当 `phase === "mid_dialog1"` 或 `phase === "mid_dialog2"` 时，使用 researcher 的对话模式
- Researcher 需要知道：
  - 当前是对话 1 还是对话 2
  - 第一批/第二批的跳过率
  - 已有的 targetContext
- Researcher 输出：
  - 自然对话回复
  - 更新后的 `targetContext`（通过 tool use）

### 6.2 `/api/questionnaire/generate` 新增

**新增独立路由**：生成问卷的逻辑从 `/api/chat/stream` 中拆出来

**输入**：
```ts
{
  sessionState: SessionState;
  batchMode: "habit_batch" | "scenario_batch" | "mixed_batch";
  existingQuestions: string[];  // 已生成的题目，用于去重
}
```

**输出**：
```ts
{
  questions: QuestionnaireQuestion[];  // 8 题
}
```

**逻辑**：
- 调用 researcher 的 `GENERATE_QUESTIONNAIRE_TOOL`
- 传入 batchMode 和 existingQuestions
- 检查去重，如果重复率高，重新生成（最多 1 次）
- 如果失败，返回兜底问卷

## 7. 前端改动

### 7.1 `/interview` 页面

**新增状态**：
- `currentBatch: 1 | 2 | 3`
- `isInMidDialog: boolean`

**流程控制**：
1. 用户答完第一批 8 题 → 自动进入对话 1（`phase = "mid_dialog1"`）
2. 对话 1 结束 → 调用 `/api/questionnaire/generate` 生成第二批 → 进入第二批答题
3. 用户答完第二批 8 题 → 自动进入对话 2（`phase = "mid_dialog2"`）
4. 对话 2 结束 → 调用 `/api/questionnaire/generate` 生成第三批 → 进入第三批答题
5. 用户答完第三批 8 题 → 跳转到 `/report`

**UI 提示**：
- 顶部显示进度："第 1/3 批"、"第 2/3 批"、"第 3/3 批"
- 对话阶段显示："正在调整题目场景..."

### 7.2 `/report` 页面

**计分改动**：
- 基于 24 题全部答案计分
- 每维 6 题（3 正向 + 3 反向）
- 跳过题不计入，但不影响报告生成（因为 24 题足够大）

**Confidence 标注**：
- 每维有效答案 ≥ 4：高信心
- 每维有效答案 2-3：中信心
- 每维有效答案 < 2：低信心（标记"样本不足"）

## 8. Researcher Prompt 改动

### 8.1 中途对话 Prompt

新增 `buildMidDialogPrompt`：

```ts
export function buildMidDialogPrompt(params: {
  dialogType: "dialog1" | "dialog2";
  sessionState: SessionState;
  skipRate: number;  // 上一批的跳过率
  messages: Message[];  // 当前对话历史
}): string;
```

**Prompt 要求**：
- 对话 1：告知场景，用开放式问题校准接下来要询问的方向，根据跳过率调整询问深度
- 对话 2：用开放式问题收集场景题反馈和调整方向，根据跳过率调整询问深度
- 语气自然、简短，不要让用户觉得"又要聊很久"
- 如果用户说"继续"或"没问题"，直接结束对话，不要追问

### 8.2 问卷生成 Prompt

扩展 `GENERATE_QUESTIONNAIRE_TOOL`：

**新增 input_schema 字段**：
```ts
{
  batchMode: {
    type: "string",
    enum: ["habit_batch", "scenario_batch", "mixed_batch"],
    description: "生成模式：习惯题批次 / 场景题批次 / 混合题批次"
  },
  existingQuestions: {
    type: "array",
    items: { type: "string" },
    description: "已生成的题目文本，不要生成相似的"
  }
}
```

**Prompt 要求**：
- habit_batch：只生成习惯题，scenario 字段填 "习惯"
- scenario_batch：只生成场景题，scenario 字段填具体情境，基于 targetContext
- mixed_batch：生成 4 习惯 + 4 场景，场景基于 targetContext
- 每批 8 题：每维 2 题（1 正向 + 1 反向）
- 不要生成与 existingQuestions 相似的题目

## 9. 可能踩的坑

### 9.1 用户在对话中说"我不想答了"

**问题**：用户在对话 1 或对话 2 中说"题目都不适合我，我不想答了"

**处理**：
- Agent A 温和引导："我们可以调整题目场景，你平时主要用 AI 做什么？"
- 如果用户坚持不答，允许退出，但不生成报告（因为题数不够）
- UI 上显示："至少需要完成 24 题才能生成报告"

### 9.2 三次生成导致题目风格不一致

**问题**：第一批、第二批、第三批的题目可能风格差异大

**防护**：
- Prompt 中强调："保持与前面题目相同的提问风格和难度"
- 把第一批的 2-3 道题作为示例传给第二批、第三批生成

### 9.3 对话 2 后用户还是说不满意

**问题**：对话 2 后用户说"场景还是不对"

**处理**：
- Agent A："我会按你刚才说的方向继续收窄第三批题目。如果后面仍然有不贴近的地方，也可以在报告页反馈。"
- 不再继续调整，直接生成第三批
- 避免无限循环调整

### 9.4 Token 成本

**估算**：
- 第一批生成：~500 tokens 输出
- 对话 1：~200 tokens 输出
- 第二批生成：~500 tokens 输出
- 对话 2：~200 tokens 输出
- 第三批生成：~500 tokens 输出
- 总计：~1900 tokens 输出（相比原 16 题一次生成的 ~800 tokens，增加约 1100 tokens）

**可接受**：
- 生成问卷的成本相比生成报告（~2000 tokens）还是小很多
- 且 system prompt 走了 caching，输入 token 成本受控

## 10. 落地节奏

| 步骤 | 工作 | 预估 |
|------|------|------|
| 6.1 | SessionState 扩展（questionnaireBatches / batchAnswers / midDialogues） | 0.5 天 |
| 6.2 | 兜底问卷扩展为三批（8+8+8） | 0.5 天 |
| 6.3 | buildMidDialogPrompt + 中途对话逻辑 | 1 天 |
| 6.4 | GENERATE_QUESTIONNAIRE_TOOL 扩展（batchMode / existingQuestions） | 1 天 |
| 6.5 | `/api/questionnaire/generate` 新增路由 + 去重逻辑 | 1 天 |
| 6.6 | `/interview` 页面流程控制（三批 + 两次对话） | 1.5 天 |
| 6.7 | `/report` 页面计分改为 24 题 + confidence 标注 | 0.5 天 |
| 6.8 | `/test-lab` 新增 case（三批生成 / 去重 / 跳过率触发灵活询问） | 0.5 天 |

总计约 6.5 天。

## 11. 验收必跑

```bash
npm run typecheck
npm run lint
npm run check:llm
npm run test:browser
```

并手动跑：

1. **正常流程**：完成访谈 → 答第一批 8 题（跳过 1 题）→ 对话 1 简短确认 → 答第二批 8 题（跳过 0 题）→ 对话 2 简短确认 → 答第三批 8 题 → 报告显示"基于 23 道有效回答"
2. **高跳过率流程**：第一批跳过 5 题 → 对话 1 详细询问 → 用户说"我主要做临床诊断" → 第二批场景题明显调整 → 跳过率降低
3. **场景不满意流程**：第二批跳过 6 题 → 对话 2 深入沟通 → 用户说"场景还是不对" → 第三批再次调整
4. **题目去重**：三批题目中没有明显重复的题面

## 12. 与 Phase 5 的关系

- Phase 6 可以独立于 Phase 5 实施
- 如果 Phase 5 已完成，报告页的 "我的 AI 协作宣言" 和 "Style Overview" 基于 24 题生成，样本量更大，质量更高
- Phase 6 的中途对话记录（midDialogues）可以作为报告的额外 evidence 来源

---

如果 Phase 6 实现过程中发现中途对话的用户参与度很低（大部分用户只说"继续"），可以考虑简化为：
- 只保留对话 1（场景确认）
- 删除对话 2（场景满意度确认）
- 第三批混合题直接基于对话 1 的 targetContext 生成

但建议先上线完整版本，观察 1-2 周真实数据再决定是否简化。
