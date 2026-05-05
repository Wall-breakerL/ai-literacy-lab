# AI-MBTI 报告内容优化备忘

## 0. 本轮目标

第一批测试者反馈「报告内容僵硬」，这个问题不能只理解成报告页 UI 或某一句文案不好。当前报告由三层共同生成：

- 服务端确定性计分与画像判定。
- Qwen 生成解释、建议和 prompt 模板。
- 服务端再补全 / 覆盖部分可携带内容，最后由报告页渲染。

本文件先整理当前真实报告生成链路，再提出内容层改造方案。当前不改四维模型、不改人格设计、不重排报告页视觉结构。

和 `docs/process-update.md` 的边界保持一致：

- 模型只负责问卷生成和报告生成。
- 信息收集页和中途反馈页后续仍由本地结构化，不让 Qwen 做表单归一化。
- 报告页格式优化暂缓，本轮先讨论报告内容如何更自然、更像用户的真实结果。

## 1. 当前报告生成链路

### 1.1 前端报告页

入口在 `src/app/report/page.tsx`。

报告页从 `sessionStorage` 读取：

- `ai_mbti_history`
- `ai_mbti_identity`
- `ai_mbti_answers`
- `ai_mbti_target_context`
- `ai_mbti_session_state`

然后调用 `/api/report`：

```ts
fetch("/api/report", {
  method: "POST",
  body: JSON.stringify({ messages, identity, questionnaireAnswers, targetContext, sessionState }),
})
```

前端最多尝试 2 次，单次超时 75 秒。拿到报告后：

- 用 `buildScoreAudit` 生成答题与计分明细。
- 用 `buildStyleOverview` 组织「关于你 3 个值得记住的发现」。
- 用 `buildManifestoText` 组织「适合你的工作流」。
- 用 `buildSignature` 组织协作签名。
- 把完整报告传给 `ReportStoryExperience` 做幻灯片、海报和完整解读展示。

### 1.2 `/api/report` 的确定性部分

入口在 `src/app/api/report/route.ts`。

请求进入后，服务端先做确定性处理：

- `resolveReportQuestionnaireAnswers`：合并扁平答案、`sessionState.answers`、`sessionState.batchAnswers`。
- `scoreQuestionnaireAnswers`：把答案折算成四维分数。
- `getPersonalityCode` / `getPersonalityProfile`：根据四维分数确定 16 型人格画像。
- `normalizeTargetContext`：合并 `sessionState.refinedTargetContext`、请求体 `targetContext` 和从聊天记录推断出的上下文。
- `withSessionQuoteEvidence`：把 `SessionState.evidence` 里的用户原话合并到维度证据。

这一层的原则是正确的：分数、人格、目标上下文不交给模型重算，模型只负责表达。

### 1.3 Qwen 报告生成部分

报告提示词在 `src/lib/reportAgent.ts` 的 `REPORT_SYSTEM`。

当前模型被要求生成：

- `summary`
- `tags`
- `styleOverview`
- `collaborationManifesto`
- `collaborationSignature.detail`
- `overallAdvice`
- `recommendations`
- `promptTemplates`
- 每个维度的 `analysis`

工具 schema 在 `src/app/api/report/route.ts` 的 `GENERATE_REPORT_TOOL`。它强制模型调用 `generate_ai_mbti_report`，要求返回完整结构化字段。

用户 prompt 会塞入：

- 用户身份。
- 服务端已计算的四维结果。
- 服务端已确定的人格画像。
- 目标上下文。
- 所有问卷回答。
- 访谈记忆摘要。
- 可引用的用户原话证据。

当前设计的优点是稳定、可控；缺点是模型一次要完成太多不同写作任务，容易变成「按字段交作业」。

### 1.4 服务端后处理与覆盖

模型输出不是直接返回给前端，而是继续被服务端处理。

`completePortableArtifacts` 会处理：

- `styleOverview`
- `collaborationManifesto`
- `collaborationSignature`

需要特别注意：

- `collaborationManifesto` 当前始终由服务端固定生成，模型写了也会被覆盖。
- `styleOverview.growthDirection` 当前也会被替换成 `getPersonalityNextAction(personality.code)`。
- `collaborationSignature.headline` 固定来自人格画像，模型只保留 `detail`。

`completeAdviceBundle` 会处理：

- `overallAdvice`
- `recommendations`
- `promptTemplates`

如果模型没写或结构异常，就使用固定兜底文案。

### 1.5 页面展示结构

`src/components/ReportStoryExperience.tsx` 当前展示为：

1. 人格头像与名称。
2. 四维光谱。
3. 人格故事页。
4. 「关于你 3 个值得记住的发现」。
5. Prompt 模板与适合的工作流。
6. 海报。
7. 完整维度解读。
8. 答题与计分明细。
9. 反馈入口。

`DimensionCard` 中每个维度默认折叠，展开后显示「模型分析」。如果模型分析为空，会使用本地 fallback：

```text
从当前数据看，{维度} 有 {有效题数} 题有效，分数为 {score}，更接近「{tendencyLabel}」。主要依据是 {evidence}。
```

这类 fallback 清楚但明显偏机械。

## 2. 为什么报告会显得僵硬

### 2.1 模型一次承担了太多写作任务

当前 Qwen 单次输出要同时写总评、标签、三张风格卡、协作宣言、签名、建议、prompt 模板、四个维度分析。每个字段又有长度、证据、语气、禁用词、结构化 schema 限制。

结果是模型容易优先满足格式，而不是把用户当作一个真实的人来解释。

### 2.2 schema 和实际后处理存在职责冲突

`GENERATE_REPORT_TOOL` 仍然要求 `collaborationManifesto`，而 `completePortableArtifacts` 会始终用服务端固定工作流覆盖它。

`REPORT_SYSTEM` 要求模型写 `styleOverview.growthDirection`，但服务端和前端实际都使用 `getPersonalityNextAction` 的固定句子。

这会造成两个问题：

- 模型浪费 token 写不会被展示的内容。
- 开发者后续调 prompt 时容易误判，以为某段生效了，实际上被服务端覆盖。

### 2.3 过多「防僵硬」规则反而制造了僵硬

`REPORT_SYSTEM` 已经明确要求「专家感 + 极强亲和力」「像懂你的朋友一句话点破」「可以带轻微俏皮」。但同时又有很多强约束：

- 每条 60-80 字。
- 必须引用分数、有效回答数量、用户原话或题目证据。
- 必须包含特定短语，例如「从本次回答看」。
- 不能写真实表现、长期能力、常见错误。
- 不能说「你应该 / 你需要」。

这些限制单独看都有道理，但叠在一起后，模型会写出很安全、很像报告模板的句子。

### 2.4 证据输入还不够像真实故事

当前报告 prompt 会给所有问卷回答，但问卷本身如果已经僵硬，报告引用题面时也会继续僵硬。

新流程会把前两轮聊天替换成信息收集页，并把中途对话替换成反馈页。这样报告应该优先吃到：

- 用户填写的职业 / 身份。
- 用户填写的具体 AI 使用经历。
- 第一轮问卷作答情况。
- 中途反馈里的真实吐槽、修正场景和希望聚焦点。
- 第二轮问卷作答情况。

如果报告仍然只把这些内容压成「目标上下文 + 问卷题面」，它会错过最像人的材料。

### 2.5 维度解析像计分说明，不像用户洞察

当前维度分析要求「必须结合分数、有效回答数量和至少一个证据」。这保证可信度，但容易写成：

```text
该维度得分为 62，基于 6 道有效回答，说明你更接近……
```

用户会理解这是怎么判出来的，但不一定会觉得「这说的是我」。

报告需要把计分说明和用户洞察拆开：

- 计分说明可以放在答题与计分明细里。
- 维度解析应该先讲行为模式，再给证据和解释。

## 3. 报告内容的新目标

报告不应该只是「测评结果陈述」，而应该回答用户的四个问题：

1. 我大概是哪种 AI 协作风格？
2. 为什么系统会这么判断？
3. 这对我下次使用 AI 有什么实际帮助？
4. 哪些结论只是初步观察，不能被当成绝对标签？

建议把报告内容目标改成：

```text
确定性层负责：分数、人格、倾向、置信度、证据来源。
模型层负责：把这些事实讲成人话，写出具体场景感和下一步动作。
页面层负责：把可信度、来源和可执行内容分区呈现。
```

## 4. 建议的新报告内容合同

### 4.1 模型只写真正需要生成的文本

建议把 Qwen 输出合同收窄为：

```ts
type ReportNarrativeDraft = {
  summary: string;
  openingInsight: string;
  dimensionAnalyses: Array<{
    dimension: Dimension;
    userPattern: string;
    evidenceExplanation: string;
    caveat?: string;
  }>;
  overallAdvice: string;
  recommendations: Array<{
    title: string;
    detail: string;
  }>;
  promptTemplates: PromptTemplate[];
  signatureDetail?: string;
};
```

不建议继续让模型输出：

- `personality`
- `targetContext`
- `score`
- `tendencyLabel`
- `collaborationManifesto`
- `styleOverview.growthDirection`
- `colors`
- `avatarPrompt`

这些要么已经由服务端确定，要么当前会被服务端覆盖。

### 4.2 明确哪些字段由服务端固定生成

建议在代码和文档中明确字段所有权：

| 字段 | 建议所有者 | 说明 |
|---|---|---|
| 四维分数 | 服务端 | 模型不重算 |
| 16 型人格 | 服务端 | 模型不决定 |
| `collaborationManifesto` | 服务端 | 固定工作流即可，不再要求模型输出 |
| `styleOverview.growthDirection` | 二选一 | 要么服务端固定，要么交给模型，不要两边都写 |
| `collaborationSignature.headline` | 服务端 | 来自人格画像 |
| `collaborationSignature.detail` | 模型 + 校验 | 需要有用户证据和「从本次回答看」边界 |
| `promptTemplates` | 模型 | 最需要个性化和场景感 |

### 4.3 维度分析改成「行为模式 + 证据 + 边界」

当前维度分析偏像分数解释。建议改成三段式，但不一定在 UI 上拆三段：

```text
行为模式：先讲这个维度在用户实际用 AI 时可能表现为什么动作。
证据解释：引用用户原话、题目回答或两轮差异解释为什么这么判断。
边界提示：说明这不是能力等级，只是本次回答中的协作倾向。
```

示例目标语气：

```text
你更像是先把 AI 放进同一个讨论桌的人：不会只丢任务等结果，也会期待它补充盲区。这个判断主要来自你在几道伙伴协作题上的高分，以及中途反馈里希望题目更贴近真实场景的表达。需要注意的是，它说明的是你更愿意和 AI 共创，不等于每次都会信任 AI 的输出。
```

### 4.4 建议与 prompt 模板要绑定真实任务

报告最有用的部分不是「你是什么类型」，而是「下次怎么问 AI」。

后续 prompt 模板应该优先使用：

1. 信息收集页的具体 AI 使用经历。
2. 中途反馈页里用户希望第二轮聚焦的真实场景。
3. 四维中偏离 50 最明显的 1-2 个倾向。

不要把 prompt 模板写成通用填空表。模板应该像用户下次真的会复制的一段话。

## 5. Prompt 更新方向

### 5.1 减少抽象口吻要求，增加写作任务

当前 prompt 有很多「不要僵硬」类规则。下一版可以少写抽象风格词，多写具体任务：

```text
每段先写一个用户会做的动作，再解释这个动作对应哪条维度倾向。
如果只能引用题目，就把题目改写成自然场景，不要直接复述题干。
不要连续三段都用「从...来看」开头。
建议只写一个最值得尝试的动作，不要列泛化原则。
```

### 5.2 把输入材料整理成「高信号摘要」

不要把全部问卷回答原样堆给模型后让它自己找重点。服务端应先整理：

- 最强两个维度。
- 最弱 / 最接近 50 的维度。
- 每个维度 1-2 条最高信号证据。
- 跳过题比例。
- 第一轮和第二轮是否出现明显变化。
- 信息收集页原文。
- 中途反馈页原文。

然后 prompt 让模型基于这些高信号材料写报告。

### 5.3 增加报告文案质量校验

建议新增 `src/lib/reportContentValidation.ts`，做轻量规则检查：

- 禁止连续多个段落使用同一句式开头。
- 禁止空词密集出现：高效、稳定、持续优化、实现价值、综合能力、赋能等。
- 禁止无证据判断真实工作表现。
- 禁止把缺失目标写成「当前目标是更有效地使用 AI」。
- 禁止 placeholder：`[任务目标]`、`[你的场景]`。
- 检查 prompt 模板是否能直接复制使用。

校验失败时可以让模型重试一次，或只替换失败字段，而不是整份报告 fallback。

## 6. 与新流程的对齐

结合 `docs/process-update.md`，后续报告生成应明确读取这些来源：

| 来源 | 用途 |
|---|---|
| 信息收集页职业 / 身份 | 用于报告开头和任务语境，不做模型归一化 |
| 信息收集页具体 AI 使用经历 | 用于 prompt 模板和建议 |
| 第一轮问卷答案 | 用于初步风格采样 |
| 中途反馈页整体感受 | 用于解释问卷可信度和第二轮校准方向 |
| 中途反馈页题目问题反馈 | 用于避免把不贴近的题目当成强证据 |
| 中途反馈页希望聚焦场景 | 用于第二轮问卷和最终建议 |
| 第二轮问卷答案 | 用于最终计分与校准 |

报告内容要能处理一个重要情况：

```text
第一轮答案和第二轮答案不一致时，不要强行平均成一个标签。
应该解释为：用户在不同场景下的 AI 协作方式可能不同，本次分数是两轮综合结果。
```

这会让报告更诚实，也更像真人分析。

## 7. 建议实施顺序

1. 先清理 `/api/report` 的字段所有权：不再要求模型输出会被服务端覆盖的字段。
2. 把 `REPORT_SYSTEM` 从「全字段报告写作」改成「叙事层写作」。
3. 在 `/api/report` 内整理高信号输入摘要，减少直接堆全部问卷回答。
4. 增加报告文案质量校验，只针对失败字段重试或替换。
5. 把新流程的信息收集页和中途反馈页原文纳入报告 prompt。
6. 最后再评估报告页 UI 是否需要重排。

## 8. 本轮不做的事

- 不改变 AI-MBTI 四维定义。
- 不改变 16 型人格设计。
- 不改变确定性计分逻辑。
- 不让模型归一化表单。
- 不重写报告页视觉结构。
- 不把报告生成拆成多个模型调用，除非单次输出质量仍然不稳定。

## 9. 后续需要讨论的问题

1. `styleOverview.growthDirection` 到底由服务端固定，还是交给模型个性化？
2. `collaborationManifesto` 是否继续作为报告页展示字段，还是降级成固定「推荐工作流」？
3. 维度分析是否需要在数据结构里拆成 `userPattern` / `evidenceExplanation` / `caveat`？
4. 新流程中的中途反馈是否应该成为报告证据，还是只作为第二轮问卷生成依据？
5. 报告是否要显式展示「本次报告基于哪些输入」？

当前建议：先做内容合同和 prompt 链路收窄，再决定报告页模块是否重排。
