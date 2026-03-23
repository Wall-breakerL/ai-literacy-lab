/**
 * 前端展示文案集中管理，统一语气：友好、简短、不学术化。
 */

export const copy = {
  // 首页
  home: {
    title: "AI 交互素养评估",
    subtitle: "在自然、轻松的任务对话中，看看你与 AI 协作解决问题的能力。",
    cta: "开始评估",
  },

  setup: {
    title: "身份与入场",
    subtitle:
      "请为被测者配置身份说明（仅作隐藏上下文，不会逐字展示给对方）。保存后直接进入对话；也可跳过，使用系统默认身份。",
    tabPrompt: "粘贴身份说明",
    tabForm: "结构化表单",
    promptLabel: "身份说明（给研究者用）",
    promptPlaceholder: "例：被测者为大三学生，常写课程报告，对引用规范不熟……",
    saveContinue: "保存并开始对话",
    saving: "保存中…",
    hint: "保存后会在服务端写入 data/runtime/identities/（本地开发）。",
    skip: "跳过，直接开始（无自定义身份）",
  },

  // 对话页
  chat: {
    taskLabel: "情境提示",
    taskPlaceholder: "在下方输入消息，自然回复对方即可。",
    inputPlaceholder: "输入消息…",
    send: "发送",
    endConversation: "先告一段落",
    goDebrief: "结束对话，回答几个简短问题",
    ending: "正在提交…",
    endingHint: "正在整理反馈，请稍候（约 10–30 秒）",
    debriefTitle: "收尾小问题",
    debriefHint: "用于补充了解你对 AI 协作的想法，没有标准答案。",
    submitResult: "提交并查看反馈",
    debugProbes: "研究者：探针摘要",
    expandThinking: "展开思考过程",
    collapseThinking: "收起思考过程",
    loading: "加载中",
    loadFailed: "加载失败，请刷新重试",
    errorFallback: "抱歉，暂时无法回复，请稍后再试。",
  },

  // 结果页
  result: {
    title: "对话反馈",
    noData: "没有找到本次会话数据，从首页重新开始吧。",
    legacyUnsupported: "当前版本仅展示 v2 蓝图评测结果。请完成一轮新对话后再查看。",
    backHome: "返回首页",
    totalLabel: "综合分（加权）",
    totalHint: "满分 100；v2 为两层七维加权",
    dimensionsTitle: "各维度表现",
    layerA: "协作行为层",
    layerB: "AI 理解能力层",
    evidenceLabel: "证据",
    flagsTitle: "标记",
    suggestionsTitle: "建议",
    blindSpotsTitle: "可关注的盲点",
    nextTitle: "下一步场景建议",
    metaToggle: "版本与复现信息",
    metaCollapse: "收起",
    researcherToggle: "研究者视图（事件 / 原始 JSON）",
    cta: "再测一轮（进入对话）",
    ctaHint: "使用当前浏览器里保存的身份（若有）直接进入下一轮；要重填身份说明请从首页点「开始评估」。",
  },

  // 通用
  common: {
    redirecting: "正在跳转…",
  },
} as const;
