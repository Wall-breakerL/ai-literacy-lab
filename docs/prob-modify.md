# 问题修复决策：董事长类型过多与 reverse 处理

## 当前结论

active 主流程正式引入反向题。

active 流程保持 16 题结构不变：

- `hybrid_batch1`：8 题，四维各 2 题，4 道通用题 + 4 道半具体题。
- `hybrid_batch2`：8 题，四维各 2 题，4 道半具体题 + 4 道具体题。
- 每批每个维度 1 道 `reverse=false` + 1 道 `reverse=true`。
- 两批合计后，每个维度 4 题，其中 2 正向、2 反向。

`reverse=true` 表示该题高分指向维度低端，计分时由服务端自动使用 `5 - score` 翻转。题目文案仍必须是自然的一阶陈述，不能写成否定句、陷阱题或绕弯题。

## 为什么需要反向题

之前 active 问卷全部是 `reverse=false`。如果用户对“看起来正确”的好习惯都倾向高分，例如主动讨论、先定框架、验证输出、重新描述问题，四个维度会一起偏高，最终容易集中到 CFAG/董事长。

正反向平均后，同一维度会同时测两端行为：

- 高端行为：认同度高会增加该维度分数。
- 低端行为：认同度高会降低该维度分数。

这样全选高分不会再天然推高所有维度；用户必须在两端行为上表现出一致倾向，分数才会明显偏向某一端。

## 四维度方向

- Relation：高分 Collaborative 伙伴型；低分 Instrumental 工具型。
- Workflow：高分 Framed 框架型；低分 Exploratory 探索型。
- Epistemic：高分 Auditing 审计型；低分 Trusting 信任型。
- RepairScope：高分 Global 全局重评型；低分 Local 局部调整型。

## 代码合同

需要保持一致的地方：

- `src/lib/researcher.ts`：问卷 prompt 明确“每个维度 1 题 reverse=false，1 题 reverse=true”。
- `src/lib/fallbackQuestionnaire.ts`：`FALLBACK_QUESTIONNAIRE_BATCHES` 每批每维 1 正 1 反。
- `src/lib/questionnaireValidation.ts`：active batch 要求每维 1 道反向题；16 题总卷要求每维 2 道反向题。
- `src/app/api/questionnaire/generate/route.ts`：归一化保留模型输出的 `reverse`，最终校验负责拦截分布错误。
- `src/lib/reportScoring.ts`：`reverse=true` 使用 `5 - score` 翻转。
- `src/app/api/report/route.ts`：报告 prompt 提醒模型不要重算反向题分数，服务端已合并确定性分数。

## 验证方式

- 浏览器 self-test 应覆盖 fallback 结构、prompt 合同、batch validator 和反向题计分。
- API smoke 应覆盖两批问卷生成和报告生成。
- 手动检查全选高分、全选低分、正反向一致倾向时的人格分布是否更合理。
