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

  // 画像页
  profile: {
    title: "选一下你的画像",
    subtitle: "我们会据此分配更适合你的任务场景，评估标准对所有用户一致。",
    roleLegend: "身份 / 使用场景",
    levelLegend: "AI 使用熟练度",
    roleStudent: "学生",
    roleGeneral: "通用（职场 / 生活）",
    levelNovice: "新手",
    levelIntermediate: "有一定经验",
    cta: "进入场景",
  },

  // 对话页
  chat: {
    taskLabel: "本关任务",
    taskPlaceholder: "在下方输入消息，和助手自然对话完成任务即可。",
    inputPlaceholder: "输入消息…",
    send: "发送",
    endConversation: "结束并查看结果",
    ending: "正在提交…",
    endingHint: "正在评分，请稍候（约 10–30 秒）",
    expandThinking: "展开思考过程",
    collapseThinking: "收起思考过程",
    loading: "加载中",
    loadFailed: "加载失败，请刷新重试",
    errorFallback: "抱歉，暂时无法回复，请稍后再试。",
  },

  // 结果页
  result: {
    title: "评估结果",
    noData: "没有找到本次评估数据，从首页重新开始吧。",
    backHome: "返回首页",
    totalLabel: "总分（加权）",
    totalHint: "满分 100，按五维权重换算",
    dimensionsTitle: "五维得分",
    evidenceLabel: "证据",
    flagsTitle: "标记",
    suggestionsTitle: "建议",
    metaToggle: "关于本次评估（版本信息）",
    metaCollapse: "收起",
    cta: "再测一次",
  },

  // 通用
  common: {
    redirecting: "正在跳转…",
  },
} as const;
