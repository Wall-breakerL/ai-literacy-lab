#!/usr/bin/env node

const endpoint =
  process.env.QUESTIONNAIRE_GENERATE_URL ??
  "http://127.0.0.1:3000/api/questionnaire/generate?debug=1";

const batch1Questions = [
  {
    dimension: "Relation",
    scenario: "通用",
    question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具。",
    questionType: "universal",
    reverse: false,
  },
  {
    dimension: "Relation",
    scenario: "做事",
    question: "做事时，我更习惯直接给 AI 明确指令，让它按要求快速产出结果。",
    questionType: "semi_specific",
    reverse: true,
  },
  {
    dimension: "Workflow",
    scenario: "通用",
    question: "用 AI 时，我习惯先明确目标，再开始对话。",
    questionType: "universal",
    reverse: false,
  },
  {
    dimension: "Workflow",
    scenario: "完成任务",
    question: "完成任务时，我更喜欢先让 AI 探索几个方向，再决定怎么推进。",
    questionType: "semi_specific",
    reverse: true,
  },
  {
    dimension: "Epistemic",
    scenario: "通用",
    question: "AI 给出答案后，我通常会先验证再使用。",
    questionType: "universal",
    reverse: false,
  },
  {
    dimension: "Epistemic",
    scenario: "做判断",
    question: "做判断时，AI 给出的结论只要读起来合理，我通常会先采用再说。",
    questionType: "semi_specific",
    reverse: true,
  },
  {
    dimension: "RepairScope",
    scenario: "通用",
    question: "AI 出错时，我更愿意重新描述问题，而不是只改局部。",
    questionType: "universal",
    reverse: false,
  },
  {
    dimension: "RepairScope",
    scenario: "出错时",
    question: "结果偏离预期时，我习惯在现有内容上一点点调整，保留还能用的部分。",
    questionType: "semi_specific",
    reverse: true,
  },
];

const sessionState = {
  sessionId: `batch2-debug-${Date.now()}`,
  turn: 2,
  phase: "mid_dialog1",
  background: {
    role: "学生",
    tools: ["ChatGPT", "Claude", "Cursor"],
    recentUse: "写代码和修改课程项目",
    goal: "提高效率，并获得更多 idea/思路/选择/灵感",
  },
  evidence: [
    {
      turn: 1,
      dimension: "Workflow",
      quote: "我经常让 AI 先给一个初稿，再看哪里要改。",
      signal: "weak",
      evidenceKind: "quote",
    },
  ],
  openProbes: [],
  questionnaireBatches: {
    batch1: batch1Questions,
  },
  questionnaire: batch1Questions,
  scenarioGuidance: {
    status: "refined",
    scenarioSummary: "写代码和修改课程项目",
    granularity: "specific",
    avoidTopics: ["泛泛写作"],
    includeTopics: ["代码评审", "修改课程项目"],
    userCorrectionQuote: "第二部分更希望围绕代码评审，不要问泛泛写作。",
  },
};

const payload = {
  sessionState,
  batchMode: "hybrid_batch2",
  existingQuestions: batch1Questions,
  scenarioGuidance: sessionState.scenarioGuidance,
};

function summarizeQuestions(questions) {
  const dimensions = ["Relation", "Workflow", "Epistemic", "RepairScope"];
  const types = ["universal", "semi_specific", "specific"];
  return {
    count: Array.isArray(questions) ? questions.length : 0,
    types: Object.fromEntries(
      types.map((type) => [type, questions.filter((question) => question.questionType === type).length])
    ),
    dimensions: Object.fromEntries(
      dimensions.map((dimension) => {
        const items = questions.filter((question) => question.dimension === dimension);
        return [
          dimension,
          {
            count: items.length,
            reverse: items.filter((question) => question.reverse).length,
          },
        ];
      })
    ),
  };
}

function summarizeAttempts(attempts = []) {
  return attempts.map((attempt) => ({
    attempt: attempt.attempt,
    model: attempt.model,
    stopReason: attempt.stopReason,
    parsedQuestionCount: attempt.parsedQuestionCount,
    validationIssue: attempt.validationIssue,
    shape: summarizeQuestions(attempt.parsedQuestions ?? []),
  }));
}

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  const summary = {
    endpoint,
    status: response.status,
    source: body.source,
    model: body.model,
    retryCount: body.retryCount,
    validationIssue: body.validationIssue,
    warnings: body.warnings,
    questions: summarizeQuestions(body.questions ?? []),
    attempts: summarizeAttempts(body.debug?.attempts),
    routeValidationIssue: body.debug?.routeValidationIssue,
    upstreamError: body.debug?.upstreamError,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!response.ok || body.source === "fallback") {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
