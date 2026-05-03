# V6.0 核心设计：AI-MBTI 访谈评估系统

## 1. 核心定位

AI-MBTI 是一个纯粹的“AI 使用风格 / 协作习惯”分析工具。它不评估真实工作能力，不把用户包装成高低等级，而是通过访谈、定制题目和报告，帮助用户看清自己如何与 AI 建立关系、推进任务、验证输出和修复偏差。

FAA / AI-HQ 能力成熟度模块已从主链路移出。AI-HQ v0.1 页面和代码保留为 archived compatibility，不在 v6.0 主流程扩展。

## 2. 当前交互场景

当前 v6.0 主流程是单 researcher flow，不再是运行时 Agent A / Agent B 双代理协作。

1. **背景访谈**：researcher 先问职业或身份，再追问主要 AI 使用场景。前两轮只收集背景、recentUse 和当前目标，不直接判断四维倾向。
2. **Phase 6 第一部分问卷**：生成 `hybrid_batch1`，8 道题。
3. **中途对话**：询问第一部分题目感受、跳过原因和第二部分真实使用场景，写入 `scenarioGuidance` / `refinedTargetContext`。
4. **Phase 6 第二部分问卷**：生成 `hybrid_batch2`，16 道题。
5. **报告生成**：服务端确定性计分，LLM 只写解释、建议、prompt 模板和报告文案。
6. **Phase 7 反馈**：报告底部增加 1-2 轮反馈对话，整理成结构化反馈并写入 Notion；未配置或写入失败时保存到 `.local-debug/feedback/`。

旧版 “16/20 道单次问卷” 和 “Agent A/B 通信协议” 属于 legacy design。代码中仍保留兼容入口，但文档和新迭代应以两部分 24 题为准。

## 3. 评估模型

四个维度均输出 0-100 分：

| 维度 | 0 分端 | 100 分端 |
|---|---|---|
| Relation | Instrumental 工具型 | Collaborative 伙伴型 |
| Workflow | Framed 框架型 | Exploratory 探索型 |
| Epistemic | Auditing 审计型 | Trusting 信任型 |
| RepairScope | Global 全局重评型 | Local 局部调整型 |

四维高低组合形成 16 型代码，例如 `CEAL`。人格名称、tagline、协作签名 headline 和头像提示词来自 `src/lib/personalityProfiles.ts`，不是由模型临场发明。

## 4. Phase 6 问卷设计

总题数固定为 24 题，第一部分 8 题、第二部分 16 题：

- `hybrid_batch1`：8 题，4 道习惯题 + 4 道场景题。
- `hybrid_batch2`：16 题，8 道习惯题 + 8 道场景题，结合中途对话和第一部分题目做互补。

每部分结构固定：

- `hybrid_batch1` 中 Relation / Workflow / Epistemic / RepairScope 各 2 题，每维 1 正向 + 1 反向。
- `hybrid_batch2` 中 Relation / Workflow / Epistemic / RepairScope 各 4 题，每维 2 正向 + 2 反向。
- 两部分合计后，每个维度 6 题，其中 3 道正向、3 道反向。
- `reverse=false` 代表认同越强越靠近高端：Collaborative / Exploratory / Trusting / Local。
- `reverse=true` 代表认同越强越靠近低端：Instrumental / Framed / Auditing / Global。

题目生成失败或校验失败时，使用两套本地 fallback batch。旧版 16 题 fallback 仅为 legacy 单问卷路径保留。

## 5. 中途对话机制

中途对话不是闲聊，而是 Phase 6 的校准机制。

`dialog1` 在第一部分问卷后触发，重点了解：

- 用户觉得第一部分题目是否贴近。
- 跳过题是否因为题意不清、没有类似经历，或对这个方向不感兴趣。
- 第二部分题目应围绕哪些真实 AI 使用场景。

中途对话只追一轮。除非用户明确退出，否则用户回复后即写入结构化字段并生成第二部分问卷。

结构化输出使用 `ScenarioGuidance`：

```ts
type MidDialogueStatus =
  | "confirmed"
  | "refined"
  | "abstract_scenarios"
  | "needs_more_context"
  | "exit_requested";

interface ScenarioGuidance {
  status: MidDialogueStatus;
  scenarioSummary: string;
  granularity: "specific" | "balanced" | "abstract";
  avoidTopics: string[];
  includeTopics: string[];
  userCorrectionQuote?: string;
}
```

用户修正必须进入结构化字段，不能只留在 transcript 中。

## 6. 计分与置信度

计分逻辑在 `src/lib/reportScoring.ts`，LLM 不重算分数。

- 用户选择 1-6 分。
- `reverse=false`：`(score - 1) * 20`。
- `reverse=true`：`(6 - score) * 20`。
- 「不了解 / 没想好」是 skip，不是第 7 档，不进入平均分。
- 每个维度有效答案 `>= 4`：high confidence。
- 每个维度有效答案 `2-3`：medium confidence。
- 每个维度有效答案 `< 2`：low confidence。
- 如果请求没有扁平 `questionnaireAnswers`，报告入口会先看 `sessionState.answers`，再兜底展开 `sessionState.batchAnswers`。

## 7. 报告结构

报告由服务端合并固定画像、确定性分数和 LLM 解释文本。

核心输出：

- `summary`：一两句话总体评语。
- `personality`：服务端注入的 16 型画像。
- `styleOverview`：核心模式、优势场景、成长方向。
- `collaborationManifesto`：第一人称协作偏好文本。
- `collaborationSignature`：headline 来自固定 profile，detail 来自本次回答证据。
- `dimensions`：四维分数、倾向、证据、有效题数、跳过题数、confidence 和分析。
- `recommendations` / `promptTemplates`：绑定用户目标的下一步建议和可复制模板。

报告必须明确“从本次回答看”，避免把问卷结果包装成永久人格或真实能力结论。

## 8. 当前关键代码

| 文件 | 作用 |
|---|---|
| `src/lib/researcher.ts` | researcher prompt、tool schema、批次问卷和中途对话逻辑 |
| `src/lib/sessionState.ts` | `SessionState`、批次答案展平、phase helper |
| `src/lib/questionnaireValidation.ts` | 8+16 批次、24 题总卷、场景有效性和去重校验 |
| `src/lib/fallbackQuestionnaire.ts` | 两部分 fallback 问卷和 legacy 16 题 fallback |
| `src/app/api/questionnaire/generate/route.ts` | Phase 6 8+16 批次生成接口 |
| `src/app/api/mid-dialog/opening/route.ts` | 中途对话开场生成接口 |
| `src/app/interview/page.tsx` | 访谈、两部分问卷、中途对话前端状态机 |
| `src/lib/reportScoring.ts` | 服务端确定性计分 |
| `src/app/api/report/route.ts` | 报告生成入口 |
| `src/lib/feedbackAgent.ts` | Phase 7 反馈对话整理 |
| `src/lib/feedbackStorage.ts` | Notion 写入和本地 fallback |

## 9. 验证边界

当前仓库没有声明 API 级端到端测试。`npm run test:browser` 打开 `/test-lab` 并读取结构化 self-test 摘要确认 AI-MBTI self-tests 是否全部通过。覆盖范围包括 Phase 6 批次结构、24 题计分、跳过题、confidence、batchAnswers 报告兜底、中途对话文本安全、人格 code、报告可携带产物和目标上下文兜底。
