import { RuleSignalSchema, type RuleSignal } from "@/domain/probes/types";

const RULE_KEYWORDS: Array<{ signal: RuleSignal; keywords: string[] }> = [
  { signal: "direct_delegate", keywords: ["你直接给", "你帮我定", "你替我决定"] },
  { signal: "criteria_first", keywords: ["先定标准", "先看标准", "先对齐约束"] },
  { signal: "ask_matrix", keywords: ["矩阵", "对比表", "2x2"] },
  { signal: "spot_hidden_blocker", keywords: ["隐患", "阻塞", "硬伤"] },
  { signal: "flag_hidden_violation", keywords: ["违背 brief", "不符合"] },
  { signal: "global_reset", keywords: ["推翻重来", "重做框架", "重开"] },
  { signal: "local_patch", keywords: ["微调", "局部修", "小改"] },
  { signal: "restate_brief", keywords: ["回到 brief", "重述需求", "再对齐 brief"] },
  { signal: "request_unknowns", keywords: ["哪些未知", "待确认", "不确定点"] },
  { signal: "conservative_assumption", keywords: ["保守假设", "先按最保守", "先按风险高处理"] },
  { signal: "compare_before_decide", keywords: ["先比较再定", "先对比后决策"] },
  { signal: "pick_by_vibe", keywords: ["凭感觉", "直觉选", "看着顺眼"] },
  { signal: "style_drift", keywords: ["太说教", "风格跑偏", "语气不对"] },
  { signal: "role_contract", keywords: ["你负责", "我负责", "分工"] },
  { signal: "brief_conflict_check", keywords: ["和 brief 冲突", "证据冲突", "来源冲突"] },
];

export function extractRuleSignals(userMessage: string): RuleSignal[] {
  const msg = userMessage.toLowerCase();
  const signals = RULE_KEYWORDS.filter((entry) => entry.keywords.some((keyword) => msg.includes(keyword.toLowerCase()))).map(
    (entry) => entry.signal,
  );
  return RuleSignalSchema.array().parse(Array.from(new Set(signals)));
}
