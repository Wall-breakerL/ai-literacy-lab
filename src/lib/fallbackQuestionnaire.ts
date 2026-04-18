import type { QuestionnaireQuestion } from "@/lib/types";

/**
 * 当 Agent B 未返回 nextQuestions 时使用：每维 4 题（含正反向），共 16 题，对齐 interview-flow-design 规格下限。
 */
export const FALLBACK_QUESTIONNAIRE: QuestionnaireQuestion[] = [
  // Relation ×4
  {
    dimension: "Relation",
    scenario: "你需要完成一项比较重要的学习任务时",
    question: "我更愿意把 AI 当作可以一起讨论、打磨思路的搭档，而不是只会执行指令的工具。",
    reverse: false,
  },
  {
    dimension: "Relation",
    scenario: "时间紧、只想快速拿到结果时",
    question: "我通常让 AI「照我说的做就行」，不会花时间和它讨论多余的东西。",
    reverse: true,
  },
  {
    dimension: "Relation",
    scenario: "遇到不太有把握的问题时",
    question: "我希望 AI 能主动帮我拆解、追问，而不只是给一段答案就结束。",
    reverse: false,
  },
  {
    dimension: "Relation",
    scenario: "用完 AI 之后",
    question: "我很少关心「协作过程」，主要看输出能不能用。",
    reverse: true,
  },
  // Workflow ×4
  {
    dimension: "Workflow",
    scenario: "开始一个新任务前",
    question: "我习惯先把目标、步骤和约束写清楚，再让 AI 在框架里动手。",
    reverse: false,
  },
  {
    dimension: "Workflow",
    scenario: "面对一个有点模糊的需求",
    question: "我更喜欢先扔一个大概想法给 AI，边试边改，而不是先列完整方案。",
    reverse: true,
  },
  {
    dimension: "Workflow",
    scenario: "协作写文档或写代码时",
    question: "我会先定目录/接口/清单，再让 AI 填充，避免一开始就发散。",
    reverse: false,
  },
  {
    dimension: "Workflow",
    scenario: "探索一个不熟悉的领域时",
    question: "我宁愿快速试几种提法，也不太想先写一大份规格说明。",
    reverse: true,
  },
  // Epistemic ×4
  {
    dimension: "Epistemic",
    scenario: "AI 给出一个看起来合理的结论时",
    question: "我通常会再查证、对比其他来源，而不是直接采用。",
    reverse: false,
  },
  {
    dimension: "Epistemic",
    scenario: "赶进度、结果看起来没问题时",
    question: "我经常直接使用 AI 的答案，不再额外验证。",
    reverse: true,
  },
  {
    dimension: "Epistemic",
    scenario: "涉及风险或重要决策时",
    question: "我会刻意检查 AI 的推理链条和引用是否靠谱。",
    reverse: false,
  },
  {
    dimension: "Epistemic",
    scenario: "日常琐事或非关键任务",
    question: "我倾向于相信 AI 的表述，很少挑错。",
    reverse: true,
  },
  // RepairScope ×4
  {
    dimension: "RepairScope",
    scenario: "发现 AI 输出有明显错误时",
    question: "我倾向于在现有结果上局部修改、迭代，而不是推倒重来。",
    reverse: false,
  },
  {
    dimension: "RepairScope",
    scenario: "多轮对话里越改越乱时",
    question: "我更愿意清空上下文、重新描述问题，从头再试一遍。",
    reverse: true,
  },
  {
    dimension: "RepairScope",
    scenario: "AI 生成的内容需要大改时",
    question: "我会一块块改，尽量保留可用的部分。",
    reverse: false,
  },
  {
    dimension: "RepairScope",
    scenario: "结果离预期差很远时",
    question: "我第一反应是整段删掉、换提问方式重来，而不是微调句子。",
    reverse: true,
  },
];
