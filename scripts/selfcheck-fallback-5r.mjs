#!/usr/bin/env node
/**
 * Self-check: repeatedly calls the active 8+8 questionnaire generator and
 * reports model/fallback source rates. This script intentionally starts from
 * local intake-style session state instead of the removed legacy chat routes.
 *
 * Usage:
 *   node scripts/selfcheck-fallback-5r.mjs
 *   SELFCHECK_ROUNDS=5 BASE_URL=http://127.0.0.1:3001 node scripts/selfcheck-fallback-5r.mjs
 */

const baseUrl = (process.env.BASE_URL || process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const pauseMs = Number.parseInt(process.env.SELFCHECK_PAUSE_MS ?? "600", 10) || 600;
const roundsCap = Math.max(1, Math.min(Number.parseInt(process.env.SELFCHECK_ROUNDS ?? "10", 10) || 10, 99));
const dimensions = ["Relation", "Workflow", "Epistemic", "RepairScope"];

const personas = [
  {
    id: "product_eng",
    role: "后端工程师",
    tools: ["Copilot", "ChatGPT"],
    recentUse: "用 AI 写 Next.js 接口和单测",
    scenario: ["API 设计", "单测", "代码审查"],
  },
  {
    id: "designer",
    role: "UI 设计师",
    tools: ["Figma AI", "ChatGPT"],
    recentUse: "用 AI 写组件说明和多语言文案",
    scenario: ["Figma", "文案", "多语言"],
  },
  {
    id: "student",
    role: "研究生",
    tools: ["Claude", "ChatGPT"],
    recentUse: "用 AI 读论文和整理开题思路",
    scenario: ["文献综述", "开题", "方法对比"],
  },
  {
    id: "manager",
    role: "项目经理",
    tools: ["ChatGPT"],
    recentUse: "用 AI 写会议纪要和行动项清单",
    scenario: ["会议纪要", "行动项", "对外沟通"],
  },
  {
    id: "indie",
    role: "独立开发者",
    tools: ["Cursor", "Claude"],
    recentUse: "用 AI 写落地页文案、邮件序列和排查部署报错",
    scenario: ["落地页", "邮件营销", "部署排错"],
  },
  {
    id: "data_analyst",
    role: "数据分析师",
    tools: ["ChatGPT", "Qwen"],
    recentUse: "用 AI 写 SQL 初稿和解释异常波动",
    scenario: ["SQL", "指标口径", "异常分析"],
  },
  {
    id: "teacher",
    role: "高中老师",
    tools: ["ChatGPT"],
    recentUse: "用 AI 出课堂例题变式和作文评语草稿",
    scenario: ["命题变式", "作文评语", "家长会"],
  },
  {
    id: "legal_ops",
    role: "法务运营",
    tools: ["Claude", "ChatGPT"],
    recentUse: "用 AI 对比合同条款和整理模板差异",
    scenario: ["条款对比", "监管更新", "风险清单"],
  },
  {
    id: "clinical_research",
    role: "临床协调员",
    tools: ["ChatGPT"],
    recentUse: "用 AI 整理随访话术和入组筛选表",
    scenario: ["随访话术", "入组筛选", "伦理材料"],
  },
  {
    id: "support_engineer",
    role: "客服技术支持",
    tools: ["ChatGPT", "Copilot"],
    recentUse: "用 AI 根据工单日志猜测根因和整理排查步骤",
    scenario: ["工单分析", "复现步骤", "升级策略"],
  },
];

const rounds = Math.min(roundsCap, personas.length);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function assertServerReady() {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`无法连接 ${baseUrl}，请先在本机执行: npm run dev`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function createSessionState(persona, sessionId) {
  return {
    sessionId,
    turn: 1,
    phase: "questionnaire_batch1",
    background: {
      role: persona.role,
      tools: persona.tools,
      recentUse: persona.recentUse,
      goal: "提高效率，并获得更多 idea/思路/选择/灵感",
    },
    evidence: [],
    openProbes: [],
    refinedTargetContext: {
      role: persona.role,
      tools: persona.tools,
      recentUse: persona.recentUse,
      goal: "提高效率，并获得更多 idea/思路/选择/灵感",
    },
    scenarioGuidance: {
      status: "refined",
      scenarioSummary: persona.recentUse,
      granularity: "specific",
      avoidTopics: ["泛泛的写作业建议"],
      includeTopics: persona.scenario,
      userCorrectionQuote: "希望题目贴近我真实工作里怎么用 AI。",
    },
  };
}

function isQuestionnaireOk(data, batchMode) {
  if (!data || typeof data !== "object") return false;
  if (data.batchMode !== batchMode) return false;
  if (!Array.isArray(data.questions) || data.questions.length !== 8) return false;
  const shapeOk = data.questions.every(
    (question) =>
      question &&
      typeof question.question === "string" &&
      typeof question.reverse === "boolean" &&
      ["universal", "semi_specific", "specific"].includes(question.questionType)
  );
  if (!shapeOk) return false;
  return dimensions.every((dimension) => {
    const items = data.questions.filter((question) => question.dimension === dimension);
    return items.length === 2 && items.filter((question) => question.reverse).length === 1;
  });
}

async function runQuestionnaire(persona, sessionId) {
  const results = [];
  let state = createSessionState(persona, sessionId);
  let existingQuestions = [];

  for (const batchMode of ["hybrid_batch1", "hybrid_batch2"]) {
    await sleep(pauseMs);
    const res = await postJson("/api/questionnaire/generate", {
      sessionState: state,
      batchMode,
      existingQuestions,
      scenarioGuidance: state.scenarioGuidance,
    });
    if (!res.response.ok || !isQuestionnaireOk(res.json, batchMode)) {
      results.push({ batchMode, ok: false, status: res.response.status, json: res.json });
      return { ok: false, results };
    }
    results.push({
      batchMode,
      ok: true,
      source: res.json.source === "fallback" ? "fallback" : "model",
      questionCount: res.json.questions.length,
      model: res.json.model,
      validationIssue: res.json.validationIssue ?? null,
      warningsCount: Array.isArray(res.json.warnings) ? res.json.warnings.length : 0,
    });
    state = res.json.sessionState;
    existingQuestions = state?.questionnaire ?? existingQuestions;
  }

  return { ok: true, results };
}

await assertServerReady();

console.log("selfcheck-fallback-active-flow");
console.log({ baseUrl, pauseMs, rounds, personaIds: personas.slice(0, rounds).map((persona) => persona.id) });

const summary = [];

for (let i = 0; i < rounds; i += 1) {
  const persona = personas[i];
  const sessionId = `selfcheck-${persona.id}-${Date.now()}`;
  process.stdout.write(`\n[${i + 1}/${rounds}] ${persona.id} ... `);

  const qgen = await runQuestionnaire(persona, sessionId);
  if (!qgen.ok) {
    console.log("questionnaire FAIL");
    summary.push({ persona: persona.id, questionnaireOk: false });
    console.error(JSON.stringify(qgen.results).slice(0, 800));
    continue;
  }

  const fallbackCount = qgen.results.filter((result) => result.source === "fallback").length;
  console.log(`q_src=[${qgen.results.map((result) => result.source).join(",")}]`);
  summary.push({
    persona: persona.id,
    questionnaireOk: true,
    questionnaireBatch1: qgen.results[0]?.source,
    questionnaireBatch2: qgen.results[1]?.source,
    questionnaireFallbacks: fallbackCount,
  });
  await sleep(Math.max(200, pauseMs));
}

const fallbackTotal = summary.reduce((sum, item) => sum + (item.questionnaireFallbacks ?? 0), 0);
const okRuns = summary.filter((item) => item.questionnaireOk).length;
const denominator = okRuns * 2;

console.log("\n=== 汇总 ===");
console.table(
  summary.map((item) => ({
    persona: item.persona,
    questionnaireOk: item.questionnaireOk ? "yes" : "no",
    batch1: item.questionnaireBatch1 ?? "",
    batch2: item.questionnaireBatch2 ?? "",
  }))
);
console.log(
  `\n问卷生成 fallback 率: ${denominator ? ((fallbackTotal / denominator) * 100).toFixed(1) : "n/a"}%（${fallbackTotal}/${denominator} 次 /api/questionnaire/generate 返回 source=fallback）`
);
