# 问题修复决策：董事长类型过多与 reverse 处理

## 当前结论

本轮不在 active 主流程中引入反向题。

active 流程保持：

- `hybrid_batch1`：8 题，四维各 2 题，4 道通用题 + 4 道半具体题。
- `hybrid_batch2`：8 题，四维各 2 题，4 道半具体题 + 4 道具体题。
- 两批合计 16 题。
- 所有 active 题目均为 `reverse: false`。

`reverse: true` 只作为 legacy 兼容计分能力保留。报告计分仍支持旧数据里的反向题，但新生成的 active 问卷不生成反向题。

## 为什么不采用反向题方案

之前的方案希望通过“每维 2 正 2 反”缓解用户全选高分导致 CFAG 偏多的问题。但实际落地时会带来三个风险：

1. 题目可读性下降：反向题容易写成否定句、绕弯题或陷阱题。
2. 生成稳定性下降：模型需要同时满足场景、题型、维度和正反向分布，失败后更容易走 fallback。
3. 代码合同冲突：当前生成归一化会强制 `reverse=false`，如果 prompt 和校验继续要求反向题，会导致模型输出被校验打回。

因此当前修复方向是保持 active 全正向，并通过报告评分和低区分度保护减少“董事长”误判。

## 代码合同

需要保持一致的地方：

- `src/lib/researcher.ts`：问卷 prompt 明确“正反向分布：全部 reverse=false”。
- `src/lib/questionnaireValidation.ts`：active batch 和 16 题总卷都要求每维反向题数量为 0。
- `src/app/api/questionnaire/generate/route.ts`：校验错误提示使用“全正向”。
- `src/lib/fallbackQuestionnaire.ts`：`FALLBACK_QUESTIONNAIRE_BATCHES` 全部 `reverse=false`。
- `src/lib/reportScoring.ts`：继续兼容 legacy `reverse=true`，使用 `5 - score` 翻转。

## 后续如果重新考虑反向题

只有在重新设计题库、题面质量校验和 A/B 数据验证后，才应重新引入 active 反向题。届时必须同时修改：

- prompt 合同。
- fallback 题库。
- batch 校验。
- self-tests 和 smoke tests。
- 报告解释文案，避免用户感觉题目互相矛盾。
