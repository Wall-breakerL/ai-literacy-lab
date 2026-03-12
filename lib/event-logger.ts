import type { ChatMessage } from "./types";
import type { EvalEventRecord } from "./types";
import type { EvalEvent } from "./types";

/**
 * Keyword/pattern rules to detect user-side behaviors from messages.
 * Only user messages are inspected; assistant messages provide context for turn index.
 */
const EVENT_PATTERNS: { event: EvalEvent; patterns: (string | RegExp)[] }[] = [
  { event: "goal_specified", patterns: ["目标", "想要", "需要", "希望", "帮我", "帮忙", "写一段", "选一个", "选课", "选工具", "请假", "申请", "问进度", "约 meeting"] },
  { event: "constraint_specified", patterns: ["不能", "不要", "必须", "尽量", "最好", "限制", "约束", "条件", "要求", "风格", "语气", "正式", "简短"] },
  { event: "recipient_specified", patterns: ["导师", "老师", "主管", "HR", "对方", "收件人", "给谁", "发给"] },
  { event: "context_added", patterns: ["因为", "由于", "背景", "情况是", "目前", "之前", "课程", "项目", "公司", "部门", "时间", "日期"] },
  { event: "example_added", patterns: ["例如", "比如", "像…这样", "参考", "类似", "举例"] },
  { event: "revision_requested", patterns: ["改一下", "改写", "再改", "换一种", "重新写", "调整", "润色", "简短一点", "正式一点"] },
  { event: "comparison_requested", patterns: ["对比", "比较", "区别", "哪个更好", "优缺点", "怎么选"] },
  { event: "verification_requested", patterns: ["确定吗", "核实", "确认", "来源", "依据", "真的吗", "会不会"] },
  { event: "risk_noticed", patterns: ["隐私", "敏感", "保密", "不要泄露", "注意边界", "个人信息的"] },
  { event: "sensitive_info_shared", patterns: ["身份证号", "手机号", "密码", "银行卡", "具体住址", "学号", "工号"] },
];

function matchText(text: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return text.includes(pattern);
  }
  return pattern.test(text);
}

export function extractEvents(messages: ChatMessage[]): EvalEventRecord[] {
  const records: EvalEventRecord[] = [];
  let turnIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "user") continue;

    const content = msg.content.trim().toLowerCase();
    const fullContent = msg.content;

    for (const { event, patterns } of EVENT_PATTERNS) {
      const matched = patterns.some((p) => matchText(fullContent, p));
      if (matched) {
        records.push({ event, turnIndex });
      }
    }
    turnIndex++;
  }

  return records;
}
