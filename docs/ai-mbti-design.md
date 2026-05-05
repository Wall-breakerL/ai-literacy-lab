# V6.0 核心设计：AI-MBTI 访谈评估系统

## 1. 核心定位

AI-MBTI 是一个纯粹的“AI 使用风格 / 协作习惯”分析工具。它不评估真实工作能力，不把用户包装成高低等级，而是通过访谈、定制题目和报告，帮助用户看清自己如何与 AI 建立关系、推进任务、验证输出和修复偏差。

FAA / AI-HQ 能力成熟度模块已从主链路移出。独立 AI-HQ runtime 已删除，核心维度设计保留在 `docs/phase2-aihq-design.md`。

## 2. 当前交互场景

当前 v6.0 主流程是 intake -> active questionnaire -> report，不再是运行时双代理协作。

1. **信息收集页**：本地收集职业或身份、常用 AI 工具和近期 AI 使用经历，生成 `SessionState`。
2. **Phase 6 第一部分问卷**：生成 `hybrid_batch1`，8 道题。
3. **中途反馈页**：收集第一部分题目感受、题目问题和第二部分真实使用场景，写入 `scenarioGuidance` / `refinedTargetContext`。
4. **Phase 6 第二部分问卷**：生成 `hybrid_batch2`，8 道题。
5. **报告生成**：服务端确定性计分，LLM 只写解释、建议、prompt 模板和报告文案。
6. **Phase 7 反馈**：报告底部提供结构化反馈入口并写入 Notion；未配置或写入失败时保存到 `.local-debug/feedback/`。

旧版 “16/20 道单次问卷”、聊天式背景访谈和 “双代理通信协议” 属于 legacy design。文档和新迭代应以 intake + 两部分 16 题主动问卷为准。

## 3. 评估模型

四个维度均输出 0-20 原始分和 0-100 展示百分比：

| 维度 | 0 分端 | 20 分端 |
|---|---|---|
| Relation | Instrumental 工具型 | Collaborative 伙伴型 |
| Workflow | Exploratory 探索型 | Framed 框架型 |
| Epistemic | Trusting 信任型 | Auditing 审计型 |
| RepairScope | Local 局部调整型 | Global 全局重评型 |

四维高低组合形成 16 型代码，例如 `CEAL`。人格名称、tagline、协作签名 headline 和头像提示词来自 `src/lib/personalityProfiles.ts`，不是由模型临场发明。

## 4. Phase 6 问卷设计

总题数固定为 16 题，第一部分 8 题、第二部分 8 题：

- `hybrid_batch1`：8 题，4 道通用题 + 4 道半具体题。
- `hybrid_batch2`：8 题，4 道半具体题 + 4 道具体题，结合中途反馈和第一部分题目做互补。

每部分结构固定：

- `hybrid_batch1` 中 Relation / Workflow / Epistemic / RepairScope 各 2 题，每维 1 道 `universal` + 1 道 `semi_specific`。
- `hybrid_batch2` 中 Relation / Workflow / Epistemic / RepairScope 各 2 题，每维 1 道 `semi_specific` + 1 道 `specific`。
- 两部分合计后，每个维度 4 题，全部 `reverse=false`。
- `reverse=false` 代表认同越强越靠近高端：Collaborative / Framed / Auditing / Global。

题目生成失败或校验失败时，使用两套本地 fallback batch。旧版 16 题 fallback 仅为 legacy 单问卷路径保留。

## 5. 中途对话机制

中途反馈不是闲聊，而是 Phase 6 的校准机制。

`/mid-feedback` 在第一部分问卷后触发，重点了解：

- 用户觉得第一部分题目是否贴近。
- 跳过题是否因为题意不清、没有类似经历，或对这个方向不感兴趣。
- 第二部分题目应围绕哪些真实 AI 使用场景。

中途反馈提交后即写入结构化字段并生成第二部分问卷。

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

- 用户选择 0-5 分。
- `reverse=false`：按原始 0-5 分累加。
- `reverse=true`：legacy 兼容路径中按 `5 - score` 计分，active 主流程不生成反向题。
- 「不了解 / 没想好」是 skip，但按 2.5 分贡献中位数，不计入有效题数。
- 每个维度满分 20 分，报告同时输出 `scorePercent` 供展示。
- confidence 同时看有效题数和分数离中点的距离；有效题不足或接近中点时降为 low。
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
| `src/lib/questionnaireValidation.ts` | 8+8 批次、16 题总卷、题型分布和去重校验 |
| `src/lib/fallbackQuestionnaire.ts` | 两部分 fallback 问卷和 legacy 16 题 fallback |
| `src/app/api/questionnaire/generate/route.ts` | Phase 6 8+8 批次生成接口 |
| `src/app/intake/page.tsx` | 信息收集页 |
| `src/app/mid-feedback/page.tsx` | 中途反馈页 |
| `src/app/interview/page.tsx` | 两部分问卷生成和作答状态机 |
| `src/lib/reportScoring.ts` | 服务端确定性计分 |
| `src/app/api/report/route.ts` | 报告生成入口 |
| `src/lib/feedbackStorage.ts` | Notion 写入和本地 fallback |

## 9. 验证边界

`npm run test:browser` 打开 `/test-lab` 并读取结构化 self-test 摘要确认 AI-MBTI self-tests 是否全部通过。覆盖范围包括 Phase 6 批次结构、16 题计分、跳过题、confidence、batchAnswers 报告兜底、中途反馈、人格 code、报告可携带产物和目标上下文兜底。`npm run smoke:phase6-phase7` 覆盖本地 API smoke。
