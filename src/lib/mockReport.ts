import type { FinalReport } from "./types";

/**
 * 生成模拟报告数据，用于快速预览报告页面效果
 */
export function generateMockReport(): FinalReport {
  return {
    summary:
      "你是天生的研究搭档，喜欢和 AI 一起探索未知领域。你相信快速试错的力量，不会被完美主义束缚。在协作中，你给 AI 足够的空间去尝试，同时保持敏捷的迭代节奏。你擅长在小步快跑中发现机会，在局部优化中积累成果。",

    personality: {
      code: "CETL",
      name: "研究搭档",
      tagline: "一起探索，快速迭代",
      signatureHeadline: "研究搭档：一起探索，快速迭代",
      avatarPrompt: "A minimalist geometric avatar representing collaborative exploration and agile iteration",
      colors: {
        primary: "#ff6363",
        secondary: "#07080a",
        accent: "#5fc992",
      },
    },

    dimensions: [
      {
        dimension: "Relation",
        label: "关系定位",
        score: 68,
        tendency: "Collaborative",
        tendencyLabel: "伙伴型",
        evidence: [
          "在访谈中提到「希望 AI 能主动提供建议」",
          "倾向于给 AI 一定的自主空间",
          "把 AI 视为协作伙伴而非纯粹工具",
        ],
        analysis:
          "你倾向于把 AI 视为协作伙伴，欢迎它主动提供建议和补充思路。你会给 AI 一定的自主空间，而不是把它当作纯粹的执行工具。这种关系定位让你更容易与 AI 形成互补，但也需要你在关键决策点保持主导权。",
        advice:
          "在复杂任务开始前，明确告诉 AI 哪些部分你希望它主动发挥，哪些部分需要等待你的指令。这样可以避免 AI 过度主动或过于保守。",
      },
      {
        dimension: "Workflow",
        label: "工作流程",
        score: 42,
        tendency: "Structured",
        tendencyLabel: "框架型",
        evidence: [
          "习惯先定义清晰的框架和步骤",
          "倾向于明确交付标准后再执行",
          "重视任务边界的清晰度",
        ],
        analysis:
          "你倾向于先定义清晰的框架、步骤和交付标准，再让 AI 执行。这种方式让任务边界明确，减少返工，但可能会错过一些意外的创新路径。你的优势在于能快速建立可控的协作节奏。",
        advice:
          "在框架型工作流中，可以预留 10-20% 的探索空间。比如在完成核心任务后，让 AI 提出 2-3 个「如果换个角度」的备选方案，既保持可控，又不失灵活。",
      },
      {
        dimension: "Epistemic",
        label: "认知态度",
        score: 58,
        tendency: "Trusting",
        tendencyLabel: "信任型",
        evidence: [
          "对 AI 输出保持适度信任",
          "会快速验证关键部分而非逐字审计",
          "倾向于相信 AI 的判断能力",
        ],
        analysis:
          "你对 AI 输出保持适度信任，会快速验证关键部分而非逐字审计。这让协作效率较高，但需要你对 AI 的能力边界有清晰认知，避免在高风险场景下过度依赖。",
        advice:
          "建立一个「关键检查点清单」：对于事实性陈述、代码逻辑、数据引用等高风险内容，养成快速抽查的习惯。对于创意、文案、初稿等低风险内容，可以更放心地信任。",
      },
      {
        dimension: "RepairScope",
        label: "修复范围",
        score: 72,
        tendency: "Local",
        tendencyLabel: "局部型",
        evidence: [
          "遇到问题时倾向于局部调整",
          "较少推翻整体方案重来",
          "重视迭代速度和效率",
        ],
        analysis:
          "遇到问题时，你更倾向于局部调整而非推翻重来。这种方式让迭代速度快，但需要警惕「补丁堆积」——当局部修改超过 3 次仍未解决问题时，可能是方向性问题，需要重新审视整体方案。",
        advice:
          "设定一个「重构触发器」：如果同一个模块被修改超过 3 次，或者修改开始互相冲突，主动问 AI「如果重新设计这部分，你会怎么做？」，评估是否需要局部重构。",
      },
    ],

    tags: ["框架型", "伙伴协作", "信任验证", "局部迭代"],

    overallAdvice:
      "你的协作模式已经相对成熟，核心优势在于「框架 + 信任」的组合。下一步可以尝试在低风险任务中适度放开探索空间，让 AI 有机会提出你未曾考虑的方案。同时，建立一套轻量的「关键检查点」机制，在保持效率的同时降低信任风险。",

    recommendations: [
      {
        title: "在项目启动时明确协作边界",
        detail:
          "开始复杂任务前，用 1-2 分钟告诉 AI：「这个任务的目标是 X，我希望你主动处理 A 和 B，但 C 部分需要等我确认后再继续。」这样可以避免 AI 过度主动或过于保守。",
      },
      {
        title: "为探索预留 10-20% 的空间",
        detail:
          "在完成核心任务后，可以问 AI：「如果换个角度，还有哪些可能的方案？」这样既保持了框架的可控性，又能捕捉到一些意外的创新思路。",
      },
      {
        title: "建立轻量的关键检查点",
        detail:
          "对于事实性陈述、代码逻辑、数据引用等高风险内容，养成快速抽查的习惯。可以让 AI 在输出时主动标注「需要验证」的部分，降低你的认知负担。",
      },
    ],

    promptTemplates: [
      {
        title: "项目启动模板",
        useCase: "开始复杂任务时使用",
        prompt:
          "我需要完成 [具体任务]。目标是 [预期结果]。请先复述我的目标，然后列出你准备采用的步骤、关键假设，以及需要我确认的信息。先给出可用版本，再等待我反馈。",
      },
      {
        title: "局部修复模板",
        useCase: "遇到问题需要调整时使用",
        prompt:
          "当前方案在 [具体位置] 遇到了 [具体问题]。请提供一个局部修复方案，只改动必要的部分，并说明改动理由和可能的副作用。",
      },
      {
        title: "探索备选方案模板",
        useCase: "完成核心任务后，寻找更多可能性",
        prompt:
          "当前方案已经可用。如果换个角度思考，还有哪些备选方案？请列出 2-3 个不同方向的思路，每个用一句话说明核心差异和适用场景。",
      },
    ],

    targetContext: {
      role: "产品经理",
      recentUse: "需求文档撰写、用户故事梳理",
      goal: "提升需求沟通效率，减少开发返工",
      goalStatus: "specific",
      goalType: "product_building",
    },

    styleOverview: {
      corePattern: "框架型 + 伙伴协作 + 局部迭代",
      strengthArea: "在有明确目标的结构化任务中，你能快速建立高效的协作节奏",
      growthDirection: "尝试在低风险任务中放开探索空间，捕捉更多创新可能性",
    },

    collaborationManifesto:
      "我是一名产品经理，主要用 AI 做需求文档撰写和用户故事梳理。我习惯先明确目标和框架，再给 AI 探索空间。请你在开始前复述目标，并给出简短计划。我倾向于局部调整而非推翻重来，欢迎你把需要我确认的信息清楚标注出来。",

    collaborationSignature: {
      headline: "CETL · 框架探索者",
      detail: "先定框架，再让 AI 自由发挥。在结构与灵活之间找到平衡点。",
    },
  };
}
