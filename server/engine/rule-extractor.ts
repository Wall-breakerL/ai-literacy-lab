import { RuleSignalSchema, type RuleSignal } from "@/domain/probes/types";

const RULE_KEYWORDS: Array<{ signal: RuleSignal; keywords: string[] }> = [
  { signal: "direct_recommend", keywords: ["推荐", "直接选", "就选"] },
  { signal: "weight_first", keywords: ["权重", "优先级"] },
  { signal: "rubric_then_adjust", keywords: ["先打分", "再调整", "rubric"] },
  { signal: "multi_factor_reject", keywords: ["淘汰", "多因素", "不选"] },
  { signal: "spot_hidden_blocker", keywords: ["隐患", "阻塞", "硬伤"] },
  { signal: "ask_comparison_matrix", keywords: ["矩阵", "对比表"] },
  { signal: "rebuild_model", keywords: ["重建", "推翻重来"] },
  { signal: "reweight_existing_model", keywords: ["重新加权", "微调权重"] },
  { signal: "criteria_before_ideation", keywords: ["先定义标准", "先定 criteria"] },
  { signal: "direction_first_then_expand", keywords: ["先定方向", "再扩展"] },
  { signal: "flag_hidden_violation", keywords: ["违背 brief", "不符合"] },
  { signal: "restate_tone_rubric", keywords: ["语气", "不说教", "tone"] },
  { signal: "ask_cluster_matrix", keywords: ["聚类", "cluster"] },
  { signal: "reframe_naming_thesis", keywords: ["重写命名主张", "重构 naming"] },
  { signal: "synthesize_fragments", keywords: ["整合", "拼接", "组合"] },
  { signal: "brief_consistency_check", keywords: ["回到 brief", "核对来源", "证据"] },
  { signal: "accept_without_source_check", keywords: ["先信这个结论", "不用核对"] },
];

export function extractRuleSignals(userMessage: string): RuleSignal[] {
  const msg = userMessage.toLowerCase();
  const signals = RULE_KEYWORDS.filter((entry) => entry.keywords.some((keyword) => msg.includes(keyword.toLowerCase()))).map(
    (entry) => entry.signal,
  );
  return RuleSignalSchema.array().parse(Array.from(new Set(signals)));
}
