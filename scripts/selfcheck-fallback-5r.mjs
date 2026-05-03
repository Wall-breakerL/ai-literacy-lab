#!/usr/bin/env node
/**
 * 自检：每轮 = 模拟访谈（3×/api/chat）+ 两部分问卷（2×/api/questionnaire/generate），
 * 统计问卷 fallback 率与聊天 deterministic 兜底率。
 *
 * 轮数：`SELFCHECK_ROUNDS`（默认 10，不超过内置 persona 数量）。
 *
 * 前置：`.env.local` 已配置 LLM；本机已启动 `npm run dev`。
 *
 * Usage:
 *   node scripts/selfcheck-fallback-5r.mjs
 *   SELFCHECK_ROUNDS=5 BASE_URL=http://127.0.0.1:3001 node scripts/selfcheck-fallback-5r.mjs
 */

const baseUrl = (process.env.BASE_URL || process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const pauseMs = Number.parseInt(process.env.SELFCHECK_PAUSE_MS ?? "600", 10) || 600;
const roundsCap = Math.max(
  1,
  Math.min(
    Number.parseInt(process.env.SELFCHECK_ROUNDS ?? "10", 10) || 10,
    99
  )
);

const scenarioGuidanceTemplate = (summary, includeTopics) => ({
  status: "refined",
  scenarioSummary: summary,
  granularity: "specific",
  avoidTopics: ["泛泛的写作业建议"],
  includeTopics: includeTopics,
  userCorrectionQuote: "希望题目贴近我真实工作里怎么用 AI。",
});

const personas = [
  {
    id: "product_eng",
    q1: "我是做后端的，最近在用 Copilot 和 ChatGPT 写 Next.js 里的接口和单测，想提高交付速度但不想被模型带偏。",
    q2: "我一般先让模型列接口改动清单，我自己再对照需求改一版，然后才让它补测试。可以进入下一部分测评吗？",
    scenario: scenarioGuidanceTemplate(
      "在真实产品迭代里用 AI 做接口设计与单测，强调可控与复核。",
      ["API 设计", "单测", "代码审查"]
    ),
  },
  {
    id: "designer",
    q1: "我做 UI，日常用 Figma 插件和 ChatGPT 写组件说明、把设计稿里的文案改成多语言版本。",
    q2: "我会让 AI 先给三版文案我选，再自己改语气；有时候它给的太营销了我得重写。想继续做测评。",
    scenario: scenarioGuidanceTemplate(
      "视觉与文案协作流程里用 AI 加速迭代与多语言。",
      ["Figma", "文案", "多语言"]
    ),
  },
  {
    id: "student",
    q1: "我是研究生，主要用 AI 帮我读论文、总结方法部分，自己再对照原文检查。",
    q2: "写开题时我会让模型列研究问题，导师意见我会手动改一轮再给模型润色。可以进入问卷吗？",
    scenario: scenarioGuidanceTemplate(
      "学术阅读与开题写作中把 AI 当辅助而非代写。",
      ["文献综述", "开题", "方法对比"]
    ),
  },
  {
    id: "manager",
    q1: "我带一个小团队，用 AI 写会议纪要、跟进项清单，但决策还是人来做。",
    q2: "我会把会议录音丢给模型出初稿，再自己删掉敏感信息、改成对外的版本。继续测评吧。",
    scenario: scenarioGuidanceTemplate(
      "会议与项目管理场景下用 AI 减负，强调信息脱敏与定稿权在人。",
      ["会议纪要", "行动项", "对外沟通"]
    ),
  },
  {
    id: "indie",
    q1: "独立开发，用 AI 写落地页文案、邮件序列，还有排查部署报错。",
    q2: "上线前我会让模型过一遍用户常见问题，我再按真实工单改一版 FAQ。进入下一部分。",
    scenario: scenarioGuidanceTemplate(
      "增长与运维里用 AI 加速文案与排错，保留人工事实核对。",
      ["落地页", "邮件营销", "部署排错"]
    ),
  },
  {
    id: "data_analyst",
    q1: "我做数据分析，用 AI 写 SQL 初稿、解释异常波动，但指标口径我会自己核对数仓文档。",
    q2: "出报表前我会让模型列假设，我再拉明细验证，确认后才给业务方。可以继续测评问卷吗？",
    scenario: scenarioGuidanceTemplate(
      "数据查询与报表场景里用 AI 提速，强调口径与抽样复核。",
      ["SQL", "指标口径", "异常分析"]
    ),
  },
  {
    id: "teacher",
    q1: "高中老师，用 AI 出课堂例题变式、批改作文的评语草稿，分数和评语最终我手写定稿。",
    q2: "家长会材料我会让模型列提纲，再按班级真实情况改一版。想进入下一部分测评。",
    scenario: scenarioGuidanceTemplate(
      "教学备课与家校沟通里用 AI 减负，强调教育场景真实性。",
      ["命题变式", "作文评语", "家长会"]
    ),
  },
  {
    id: "legal_ops",
    q1: "法务运营，用 AI 把合同条款对比成表格草稿，但法律效力结论我只信律师最终审读。",
    q2: "模板更新我会让模型标出差异点，我再对照监管新规逐条改。进入问卷部分吧。",
    scenario: scenarioGuidanceTemplate(
      "合同与合规材料准备中用 AI 做初筛与对比，定稿权在专业审查。",
      ["条款对比", "监管更新", "风险清单"]
    ),
  },
  {
    id: "clinical_research",
    q1: "临床协调员，用 AI 整理随访话术、患者提醒短信草稿，伦理批件里的措辞我不用模型改。",
    q2: "入组筛选我会让模型先列 inclusion 对照表，我再和 PI 一起核对原始病历。继续测评。",
    scenario: scenarioGuidanceTemplate(
      "临床研究协调里用 AI 处理沟通草稿与表格，敏感结论不交给模型。",
      ["随访话术", "入组筛选", "伦理材料"]
    ),
  },
  {
    id: "support_engineer",
    q1: "客服技术支援，用 AI 根据工单日志猜可能根因、给出排查步骤，最后是否升级由我判断。",
    q2: "我会让模型先复现用户操作路径，我再在沙箱里验证一遍再给回复。可以进下一部分吗？",
    scenario: scenarioGuidanceTemplate(
      "工单驱动的技术支持里用 AI 加速定位，强调沙箱验证与客户沟通边界。",
      ["工单分析", "复现步骤", "升级策略"]
    ),
  },
];

const rounds = Math.min(roundsCap, personas.length);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postJson(path, body, options = {}) {
  const maxAttempts = options.maxAttempts ?? 5;
  const retryStatuses = new Set([404, 429, 502, 503, 504]);
  let last = { response: { ok: false, status: 0 }, json: null };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text };
    }
    last = { response, json };
    if (response.ok) return last;
    if (retryStatuses.has(response.status) && attempt < maxAttempts) {
      await sleep(1500 * attempt);
      continue;
    }
    return last;
  }
  return last;
}

function isChatOk(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.agentAMessage !== "string") return false;
  if (typeof data.isComplete !== "boolean") return false;
  const out = data.agentBOutput;
  if (!out || typeof out !== "object") return false;
  const dir = out.directive;
  if (!dir || typeof dir.action !== "string") return false;
  if (data.nextPhase === "questionnaire") return true;
  const analysis = out.analysis;
  if (analysis != null && typeof analysis !== "object") return false;
  return true;
}

async function assertServerReady() {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`无法连接 ${baseUrl}，请先在本机执行: npm run dev`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runChat(sessionId, persona) {
  const debugSessionId = `selfcheck-${sessionId}`;
  const startedAt = new Date().toISOString();
  const chatLog = [];

  const c0 = await postJson("/api/chat", {
    messages: [],
    roundCount: 0,
    debugSessionId,
    debugStartedAt: startedAt,
  });
  if (!c0.response.ok) {
    return { ok: false, stage: "chat_round_0", status: c0.response.status, json: c0.json, chatLog };
  }
  if (!isChatOk(c0.json)) {
    return { ok: false, stage: "chat_round_0_shape", json: c0.json, chatLog };
  }
  chatLog.push({
    round: 0,
    agentAModel: c0.json.agentAModel,
    nextPhase: c0.json.nextPhase,
    openingLen: (c0.json.agentAMessage || "").length,
  });
  let sessionState = c0.json.sessionState;
  await sleep(pauseMs);

  const c1 = await postJson("/api/chat", {
    messages: [{ role: "user", content: persona.q1 }],
    roundCount: 1,
    sessionState,
    debugSessionId,
    debugStartedAt: startedAt,
  });
  if (!c1.response.ok) {
    return { ok: false, stage: "chat_round_1", status: c1.response.status, json: c1.json, chatLog };
  }
  if (!isChatOk(c1.json)) {
    return { ok: false, stage: "chat_round_1_shape", json: c1.json, chatLog };
  }
  chatLog.push({
    round: 1,
    agentAModel: c1.json.agentAModel,
    nextPhase: c1.json.nextPhase,
    msgLen: (c1.json.agentAMessage || "").length,
  });
  sessionState = c1.json.sessionState;
  const a1 = String(c1.json.agentAMessage ?? "").trim() || "（本轮无可见助手正文）";
  await sleep(pauseMs);

  const c2 = await postJson("/api/chat", {
    messages: [
      { role: "user", content: persona.q1 },
      { role: "assistant", content: a1 },
      { role: "user", content: persona.q2 },
    ],
    roundCount: 2,
    sessionState,
    debugSessionId,
    debugStartedAt: startedAt,
  });
  if (!c2.response.ok) {
    return { ok: false, stage: "chat_round_2", status: c2.response.status, json: c2.json, chatLog };
  }
  if (!isChatOk(c2.json)) {
    return { ok: false, stage: "chat_round_2_shape", json: c2.json, chatLog };
  }
  chatLog.push({
    round: 2,
    agentAModel: c2.json.agentAModel,
    nextPhase: c2.json.nextPhase,
    msgLen: (c2.json.agentAMessage || "").length,
  });
  sessionState = c2.json.sessionState;

  const chatDeterministicTurns = chatLog.filter(
    (row) => row.round >= 1 && row.agentAModel === "deterministic"
  ).length;

  return {
    ok: true,
    sessionState,
    nextPhase: c2.json.nextPhase,
    chatLog,
    chatDeterministicTurns,
  };
}

function enrichSessionForQuestionnaire(sessionState, persona) {
  const merged = {
    ...sessionState,
    scenarioGuidance: sessionState.scenarioGuidance ?? persona.scenario,
    refinedTargetContext: sessionState.refinedTargetContext ?? {
      role: sessionState.background?.role ?? "用户",
      recentUse: sessionState.background?.recentUse ?? "",
      goal: sessionState.background?.goal ?? "",
      goalStatus: sessionState.background?.goalStatus ?? "specific",
      goalType: sessionState.background?.goalType ?? "skill_building",
    },
  };
  return merged;
}

async function runQuestionnaire(sessionState, persona) {
  const results = [];
  let state = enrichSessionForQuestionnaire(sessionState, persona);
  let existingQuestions = [];

  for (const batchMode of ["hybrid_batch1", "hybrid_batch2"]) {
    await sleep(pauseMs);
    const res = await postJson("/api/questionnaire/generate", {
      sessionState: state,
      batchMode,
      existingQuestions,
      scenarioGuidance: persona.scenario,
    });
    if (!res.response.ok) {
      results.push({ batchMode, ok: false, status: res.response.status, json: res.json });
      return { ok: false, results };
    }
    const { source, questions, sessionState: nextState, warnings, validationIssue } = res.json;
    results.push({
      batchMode,
      ok: true,
      source: source === "fallback" ? "fallback" : "model",
      questionCount: Array.isArray(questions) ? questions.length : 0,
      model: res.json.model,
      validationIssue: validationIssue ?? null,
      warningsCount: Array.isArray(warnings) ? warnings.length : 0,
    });
    state = nextState;
    existingQuestions = nextState?.questionnaire ?? existingQuestions;
  }
  return { ok: true, results };
}

await assertServerReady();

console.log("selfcheck-fallback");
console.log({ baseUrl, pauseMs, rounds, personaIds: personas.slice(0, rounds).map((p) => p.id) });

const summary = [];

for (let i = 0; i < rounds; i += 1) {
  const persona = personas[i];
  const sessionId = `${persona.id}-${Date.now()}`;
  process.stdout.write(`\n[${i + 1}/${rounds}] ${persona.id} … `);

  const chat = await runChat(sessionId, persona);
  if (!chat.ok) {
    console.log("FAIL", chat.stage, chat.status ?? "");
    summary.push({
      persona: persona.id,
      chatOk: false,
      chatStage: chat.stage,
      questionnaireFallbacks: 0,
      questionnaireTotal: 0,
      chatDeterministicTurns: 0,
    });
    if (chat.json) console.error(JSON.stringify(chat.json).slice(0, 500));
    continue;
  }

  const qDet = chat.chatDeterministicTurns > 0;
  const qgen = await runQuestionnaire(chat.sessionState, persona);
  if (!qgen.ok) {
    console.log("questionnaire FAIL");
    summary.push({
      persona: persona.id,
      chatOk: true,
      nextPhase: chat.nextPhase,
      chatDeterministic: qDet,
      questionnaireOk: false,
    });
    console.error(JSON.stringify(qgen.results).slice(0, 800));
    continue;
  }

  const fb = qgen.results.filter((r) => r.source === "fallback").length;
  console.log(
    `chat nextPhase=${chat.nextPhase ?? "—"} chatDet=${qDet} q_src=[${qgen.results.map((r) => r.source).join(",")}]`
  );
  summary.push({
    persona: persona.id,
    chatOk: true,
    nextPhase: chat.nextPhase,
    chatDeterministic: qDet,
    questionnaireBatch1: qgen.results[0]?.source,
    questionnaireBatch2: qgen.results[1]?.source,
    questionnaireFallbacks: fb,
  });
  await sleep(Math.max(200, pauseMs));
}

const qFb = summary.reduce((a, s) => a + (s.questionnaireFallbacks ?? 0), 0);
const chatDetRounds = summary.filter((s) => s.chatDeterministic).length;

console.log("\n=== 汇总 ===");
console.table(
  summary.map((s) => ({
    persona: s.persona,
    chatOk: s.chatOk ? "yes" : "no",
    nextPhase: s.nextPhase ?? "",
    chatDet: s.chatDeterministic ? "yes" : "no",
    batch1: s.questionnaireBatch1 ?? "",
    batch2: s.questionnaireBatch2 ?? "",
  }))
);

const okRuns = summary.filter((s) => s.chatOk && s.questionnaireBatch1).length;
const denomQ = okRuns * 2;
console.log(
  `\n问卷生成 fallback 率: ${denomQ ? ((qFb / denomQ) * 100).toFixed(1) : "n/a"}%（${qFb}/${denomQ} 次 /api/questionnaire/generate 返回 source=fallback）`
);
console.log(
  `访谈（round1/2）出现 researcher 兜底 deterministic: ${okRuns ? ((chatDetRounds / okRuns) * 100).toFixed(1) : "n/a"}%（${chatDetRounds}/${okRuns} 个 persona 至少一次 agentAModel=deterministic）`
);
console.log(
  "\n说明：问卷 fallback 来自 /api/questionnaire/generate；deterministic 表示该次 /api/chat 在 researcher 多次重试仍失败后使用内置兜底文案。"
);
