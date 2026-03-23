import type { ChatMessage } from "../types";

/** v2 事件：协作行为 + AI 理解相关可观察线索 */
export type EvalEventV2 =
  | "goal_specified"
  | "constraint_specified"
  | "recipient_specified"
  | "context_added"
  | "example_added"
  | "revision_requested"
  | "comparison_requested"
  | "verification_requested"
  | "risk_noticed"
  | "sensitive_info_shared"
  | "uncertainty_acknowledged"
  | "source_requested"
  | "freshness_checked"
  | "model_variability_noted"
  | "hallucination_detected"
  | "human_review_required"
  | "delegation_boundary_set"
  | "reflection_articulated"
  | "overtrust_signal"
  | "anthropomorphism_signal"
  | "debrief_meta_awareness";

export type EvalEventRecordV2 = {
  event: EvalEventV2;
  turnIndex?: number;
};

const PATTERNS: { event: EvalEventV2; patterns: (string | RegExp)[] }[] = [
  { event: "goal_specified", patterns: ["目标", "想要", "需要", "希望", "帮我", "帮忙", "写一段", "选一个", "选课", "选工具", "请假", "申请", "问进度", "约 meeting", "分工", "deadline"] },
  { event: "constraint_specified", patterns: ["不能", "不要", "必须", "尽量", "最好", "限制", "约束", "条件", "要求", "风格", "语气", "正式", "简短"] },
  { event: "recipient_specified", patterns: ["导师", "老师", "主管", "HR", "对方", "收件人", "给谁", "发给"] },
  { event: "context_added", patterns: ["因为", "由于", "背景", "情况是", "目前", "之前", "课程", "项目", "公司", "部门", "时间", "日期"] },
  { event: "example_added", patterns: ["例如", "比如", "像…这样", "参考", "类似", "举例"] },
  { event: "revision_requested", patterns: ["改一下", "改写", "再改", "换一种", "重新写", "调整", "润色", "简短一点", "正式一点"] },
  { event: "comparison_requested", patterns: ["对比", "比较", "区别", "哪个更好", "优缺点", "怎么选"] },
  { event: "verification_requested", patterns: ["确定吗", "核实", "确认", "来源", "依据", "真的吗", "会不会", "查一下", "验证"] },
  { event: "risk_noticed", patterns: ["隐私", "敏感", "保密", "不要泄露", "注意边界", "个人信息", "版权", "学术诚信", "抄袭"] },
  { event: "sensitive_info_shared", patterns: ["身份证号", "手机号", "密码", "银行卡", "具体住址", "学号", "工号"] },
  { event: "uncertainty_acknowledged", patterns: ["不确定", "可能不对", "也许", "我不太确定", "不敢说死"] },
  { event: "source_requested", patterns: ["出处", "链接", "哪篇", "谁说的", "引用", "参考文献"] },
  { event: "freshness_checked", patterns: ["最新", "几时", "过期", "版本", "更新时间", "还有效吗"] },
  { event: "model_variability_noted", patterns: ["换模型", "不同提示", "再生成", "每次不一样", "随机"] },
  { event: "hallucination_detected", patterns: ["编造", "幻觉", "没这回事", "查无", "假的"] },
  { event: "human_review_required", patterns: ["人工", "自己核对", "交给", "导师看", "同事确认"] },
  { event: "delegation_boundary_set", patterns: ["不适合 AI", "AI 做不到", "我得自己", "不能全信", "只能辅助"] },
  { event: "reflection_articulated", patterns: ["下次", "以后", "改进", "复盘", "学到", "我会"] },
  { event: "overtrust_signal", patterns: ["肯定对", "完全相信", "不用查", "AI 说的就算"] },
  { event: "anthropomorphism_signal", patterns: ["它觉得", "他想的", "AI 认为", "它故意"] },
];

function matchText(text: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return text.includes(pattern);
  }
  return pattern.test(text);
}

export function extractEventsV2(messages: ChatMessage[]): EvalEventRecordV2[] {
  const records: EvalEventRecordV2[] = [];
  let turnIndex = 0;
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const full = msg.content;
    const lower = full.trim().toLowerCase();
    if (full.includes("[收尾反思]") || full.includes("收尾反思")) {
      records.push({ event: "debrief_meta_awareness", turnIndex });
    }
    for (const { event, patterns } of PATTERNS) {
      if (patterns.some((p) => matchText(lower, p) || matchText(full, p))) {
        records.push({ event, turnIndex });
      }
    }
    turnIndex++;
  }
  return records;
}
