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
      "请描述被测者的身份背景（系统会自动提取为结构化维度存入记忆库）。保存后选择场景；也可跳过，使用系统默认身份。",
    promptLabel: "被测者身份说明",
    promptPlaceholder: "请描述被测者的身份背景，例如：年级，专业、对话目标、对 AI 工具的熟悉程度等。系统会自动提取关键维度存入记忆库，方便后续横向分析。",
    saveContinue: "下一步，选择场景",
    saving: "保存中…",
    hint: "保存后会在服务端写入 data/runtime/identities/（本地开发）。",
    skip: "跳过，直接选择默认场景",
  },

  selectScenario: {
    title: "选择场景",
    subtitle: "描述你希望练习的场景类型，系统会匹配合适场景或生成新场景。",
    promptLabel: "场景需求",
    promptPlaceholder: "例：我想练习和 AI 一起完成一份课程调研计划，并讨论哪些结论必须人工核验。",
    submit: "进入对话",
    skip: "跳过，使用默认场景",
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
    // two-phase
    phaseHelperLabel: "第一阶段：AI 协作任务",
    phaseTalkLabel: "第二阶段：深度讨论",
    phaseSwitchTitle: "任务阶段完成",
    phaseSwitchDescription: "接下来进入讨论环节。输入你想聊的问题（可留空使用默认引导）。",
    talkPromptLabel: "下一段想聊什么？",
    talkPromptPlaceholder: "例：我想聊 AI 什么时候该信、什么时候必须人工核验。",
    goTalk: "进入讨论",
    goTalkDefault: "留空并使用默认引导",
    finishHelper: "完成任务，进入讨论",
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
    phaseScoresTitle: "两段子分（研究参考）",
    phaseHelper: "Helper 阶段",
    phaseTalk: "Talk 阶段",
    phaseWeight: "权重",
    phaseEvents: "阶段事件",
    talkPrompt: "Talk Prompt",
    researcherToggle: "研究者视图（事件 / 原始 JSON）",
    cta: "再测一轮（进入对话）",
    ctaHint: "使用当前浏览器里保存的身份（若有）直接进入下一轮；要重填身份说明请从首页点「开始评估」。",
  },

  // 通用
  common: {
    redirecting: "正在跳转…",
  },
} as const;
