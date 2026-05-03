#!/usr/bin/env node
/**
 * Phase 6/7 integration smoke test.
 * Tests: interview flow, mid-dialog openings, questionnaire generation,
 * report generation, and feedback storage.
 *
 * Usage: node scripts/smoke-phase6-phase7.mjs
 * Requires: npm run dev (server running on localhost:3000)
 * Optional: RUN_LLM_SMOKE=1 to include LLM-based tests
 */

import assert from "node:assert/strict";

const baseUrl = (process.env.BASE_URL || process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const runLlmSmoke = process.env.RUN_LLM_SMOKE === "1";

const dimensions = ["Relation", "Workflow", "Epistemic", "RepairScope"];
const batchModes = [
  ["hybrid_batch1", "batch1", "questionnaire_batch1"],
  ["hybrid_batch2", "batch2", "questionnaire_batch2"],
];

const scenarioGuidance = {
  status: "refined",
  scenarioSummary: "The user wants AI help for shipping a small product feature with clearer planning and review.",
  granularity: "specific",
  avoidTopics: ["generic writing advice"],
  includeTopics: ["feature planning", "code review", "debugging"],
  userCorrectionQuote: "I want questions about real product work, not generic study habits.",
};

function createSessionState(sessionId = `smoke-phase6-phase7-${Date.now()}`) {
  return {
    sessionId,
    turn: 3,
    phase: "interview",
    background: {
      role: "Product-minded developer",
      tools: ["ChatGPT", "Claude", "GitHub Copilot"],
      recentUse: "Using AI to plan, implement, and review a Next.js feature.",
      goal: "Build a reliable AI workflow for product engineering without losing control of decisions.",
      goalStatus: "specific",
      goalType: "product_building",
      summary: "The user works on product engineering and wants practical AI collaboration patterns.",
    },
    evidence: [
      {
        turn: 1,
        dimension: "Workflow",
        quote: "I usually ask AI to make a plan first, then I check whether it fits the product goal.",
        signal: "strong",
        evidenceKind: "quote",
      },
      {
        turn: 2,
        dimension: "Epistemic",
        quote: "I do not want the model to hide uncertainty when it is guessing.",
        signal: "strong",
        evidenceKind: "quote",
      },
    ],
    openProbes: ["How should AI behave when the implementation path is unclear?"],
    refinedTargetContext: {
      role: "Product-minded developer",
      recentUse: "Using AI to plan, implement, and review a Next.js feature.",
      goal: "Build a reliable AI workflow for product engineering without losing control of decisions.",
      goalStatus: "specific",
      goalType: "product_building",
    },
    scenarioGuidance,
  };
}

function makeAnswers(questions, scores) {
  return questions.map((question, index) => {
    const score = scores[index % scores.length];
    return {
      dimension: question.dimension,
      question: question.question,
      scenario: question.scenario,
      reverse: Boolean(question.reverse),
      score,
      skipped: score == null,
      ...(score == null ? { skipReason: "unsure_or_not_applicable" } : {}),
    };
  });
}

function minimalQuestions(label) {
  const batch1 = dimensions.flatMap((dimension, dimensionIndex) => [
    {
      dimension,
      question: `${label} ${dimension} direct question`,
      scenario: dimensionIndex % 2 === 0 ? "习惯" : `${label} product work scenario`,
      reverse: false,
    },
    {
      dimension,
      question: `${label} ${dimension} reverse question`,
      scenario: dimensionIndex % 2 === 0 ? `${label} product work scenario` : "习惯",
      reverse: true,
    },
  ]);

  const batch2 = dimensions.flatMap((dimension, dimensionIndex) => [
    {
      dimension,
      question: `${label} ${dimension} complementary question 1`,
      scenario: dimensionIndex % 2 === 0 ? "习惯" : `${label} product work scenario`,
      reverse: false,
    },
    {
      dimension,
      question: `${label} ${dimension} complementary question 2`,
      scenario: dimensionIndex % 2 === 0 ? `${label} product work scenario` : "习惯",
      reverse: true,
    },
    {
      dimension,
      question: `${label} ${dimension} complementary question 3`,
      scenario: "习惯",
      reverse: false,
    },
    {
      dimension,
      question: `${label} ${dimension} complementary question 4`,
      scenario: `${label} product work scenario`,
      reverse: true,
    },
  ]);

  return label.includes("batch1") ? batch1 : batch2;
}

function assertRecord(value, label) {
  assert.equal(typeof value, "object", `${label} must be an object`);
  assert.notEqual(value, null, `${label} must not be null`);
}

function assertText(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function assertOneOf(value, allowed, label) {
  assert.ok(allowed.includes(value), `${label} must be one of ${allowed.join(", ")}`);
}

function assertModelSource(value, label) {
  assertOneOf(value, ["model", "fallback"], label);
  if (runLlmSmoke) {
    assert.equal(value, "model", `${label} must be model when RUN_LLM_SMOKE=1`);
  }
}

function assertQuestion(question, label) {
  assertRecord(question, label);
  assertOneOf(question.dimension, dimensions, `${label}.dimension`);
  assertText(question.question, `${label}.question`);
  assertText(question.scenario, `${label}.scenario`);
  assert.equal(typeof question.reverse, "boolean", `${label}.reverse must be boolean`);
}

function assertQuestionBatch(questions, label) {
  assert.ok(Array.isArray(questions), `${label} must be an array`);

  // hybrid_batch1: 8 题, hybrid_batch2: 16 题
  const expectedLength = label.includes("batch1") ? 8 : 16;
  const expectedHabits = label.includes("batch1") ? 4 : 8;
  const expectedPerDimension = label.includes("batch1") ? 2 : 4;

  assert.equal(questions.length, expectedLength, `${label} must contain ${expectedLength} questions`);

  for (const [index, question] of questions.entries()) {
    assertQuestion(question, `${label}[${index}]`);
  }

  assert.equal(
    questions.filter((question) => question.scenario === "习惯").length,
    expectedHabits,
    `${label} must include ${expectedHabits} habit questions`
  );

  for (const dimension of dimensions) {
    const items = questions.filter((question) => question.dimension === dimension);
    assert.equal(items.length, expectedPerDimension, `${label} must include ${expectedPerDimension} ${dimension} questions`);
    const reverseCount = items.filter((question) => question.reverse).length;
    assert.ok(reverseCount >= 1 && reverseCount < expectedPerDimension, `${label} must include mixed direction ${dimension} questions`);
  }
}

function assertSessionState(value, label) {
  assertRecord(value, label);
  assertText(value.sessionId, `${label}.sessionId`);
  assert.equal(typeof value.turn, "number", `${label}.turn must be a number`);
  assertText(value.phase, `${label}.phase`);
  assertRecord(value.background, `${label}.background`);
  assert.ok(Array.isArray(value.evidence), `${label}.evidence must be an array`);
  assert.ok(Array.isArray(value.openProbes), `${label}.openProbes must be an array`);
}

function assertReportShape(value) {
  assertRecord(value, "report response");
  assertText(value.summary, "report.summary");
  assert.ok(Array.isArray(value.tags), "report.tags must be an array");
  assertRecord(value.styleOverview, "report.styleOverview");
  assertText(value.styleOverview.corePattern, "report.styleOverview.corePattern");
  assertText(value.styleOverview.strengthArea, "report.styleOverview.strengthArea");
  assertText(value.styleOverview.growthDirection, "report.styleOverview.growthDirection");
  assertText(value.collaborationManifesto, "report.collaborationManifesto");
  assertRecord(value.collaborationSignature, "report.collaborationSignature");
  assertText(value.collaborationSignature.headline, "report.collaborationSignature.headline");
  assertText(value.collaborationSignature.detail, "report.collaborationSignature.detail");
  assert.ok(Array.isArray(value.recommendations), "report.recommendations must be an array");
  assert.ok(Array.isArray(value.promptTemplates), "report.promptTemplates must be an array");
  assert.ok(Array.isArray(value.dimensions), "report.dimensions must be an array");
  assert.equal(value.dimensions.length, 4, "report.dimensions must contain 4 dimensions");
  for (const dimension of dimensions) {
    const item = value.dimensions.find((entry) => entry.dimension === dimension);
    assertRecord(item, `report.dimensions.${dimension}`);
    assert.equal(typeof item.score, "number", `report.dimensions.${dimension}.score must be a number`);
    assertText(item.analysis, `report.dimensions.${dimension}.analysis`);
    assert.ok(Array.isArray(item.evidence), `report.dimensions.${dimension}.evidence must be an array`);
  }
}

async function postJson(path, body, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  const allowedStatuses = options.allowedStatuses ?? [200];
  if (!allowedStatuses.includes(response.status)) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error(`${path} returned HTTP ${response.status}, expected ${allowedStatuses.join(" or ")}`);
  }
  return { response, json };
}

async function assertServerReady() {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`Cannot reach ${baseUrl}. Start the app with npm run dev first.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function smokeOpening() {
  const questions = minimalQuestions("mid-dialog-batch1");
  const baseSession = {
    ...createSessionState("smoke-opening"),
    questionnaireBatches: {
      batch1: questions,
    },
    batchAnswers: {
      batch1: makeAnswers(questions, [null, 5, null, 4]),
    },
  };

  const opening = await postJson("/api/mid-dialog/opening", {
    sessionState: baseSession,
    completedBatchKey: "batch1",
    answers: baseSession.batchAnswers.batch1,
  });
  assertText(opening.json.message, "opening.message");
  assertModelSource(opening.json.source, "opening.source");
  assert.ok(typeof opening.json.model === "string" && opening.json.model.length > 0, "opening.model");
  assert.ok(typeof opening.json.thinkDurationSec === "number", "opening.thinkDurationSec");
  assert.equal(opening.json.dialogKey, "dialog1", "opening.dialogKey");
  assert.ok(Array.isArray(opening.json.warnings), "opening.warnings must be an array");

  console.log("ok single mid-dialog opening payload");
}

async function smokeQuestionnaireGeneration() {
  let sessionState = createSessionState("smoke-questionnaire");
  let existingQuestions = [];
  const generated = {};

  for (const [batchMode, batchKey, expectedPhase] of batchModes) {
    const result = await postJson("/api/questionnaire/generate", {
      sessionState,
      batchMode,
      existingQuestions,
      scenarioGuidance,
    });

    assert.equal(result.json.batchMode, batchMode, `${batchMode}.batchMode`);
    assertModelSource(result.json.source, `${batchMode}.source`);
    assertText(result.json.message, `${batchMode}.message`);
    assert.ok(
      String(result.json.message).includes("点击按钮"),
      `${batchMode}.message 应提示点击按钮进入作答`
    );
    assertQuestionBatch(result.json.questions, `${batchMode}.questions`);
    assertSessionState(result.json.sessionState, `${batchMode}.sessionState`);
    assert.equal(result.json.sessionState.phase, expectedPhase, `${batchMode}.sessionState.phase`);
    assertQuestionBatch(result.json.sessionState.questionnaireBatches[batchKey], `${batchMode}.sessionState.questionnaireBatches.${batchKey}`);
    assert.ok(Array.isArray(result.json.sessionState.questionnaire), `${batchMode}.sessionState.questionnaire must be an array`);
    const expectedMinLength = batchMode === "hybrid_batch1" ? 8 : existingQuestions.length + 16;
    assert.ok(result.json.sessionState.questionnaire.length >= expectedMinLength, `${batchMode}.sessionState.questionnaire should include generated questions`);
    assert.equal(typeof result.json.retryCount, "number", `${batchMode}.retryCount must be a number`);
    assert.ok(
      typeof result.json.model === "string" && result.json.model.length > 0,
      `${batchMode}.model must be a non-empty string`
    );
    assert.ok(typeof result.json.thinkDurationSec === "number", `${batchMode}.thinkDurationSec`);

    generated[batchKey] = result.json.questions;
    sessionState = result.json.sessionState;
    existingQuestions = result.json.sessionState.questionnaire;
  }

  console.log("ok questionnaire generate hybrid 8+16 batches");
  return { sessionState, generated };
}

async function smokeReport(generated) {
  const sessionState = {
    ...createSessionState("smoke-report"),
    phase: "questionnaire_batch2",
    questionnaireBatches: generated,
    questionnaire: Object.values(generated).flat(),
    batchAnswers: {
      batch1: makeAnswers(generated.batch1, [5, 4, 2, 3]),
      batch2: makeAnswers(generated.batch2, [4, 5, null, 2]),
    },
  };

  const result = await postJson(
    "/api/report",
    {
      identity: "Product-minded developer",
      messages: [
        { role: "user", content: "I use AI for product planning and code review." },
        { role: "assistant", content: "I will connect the report to practical engineering workflows." },
      ],
      sessionState,
    },
    { allowedStatuses: [200, 503] }
  );

  if (result.response.status === 503 && result.json?.error === "configuration") {
    assert.equal(runLlmSmoke, false, "report must not skip missing LLM configuration when RUN_LLM_SMOKE=1");
    console.log("skip report shape: missing LLM configuration");
    return;
  }

  assertReportShape(result.json);
  console.log("ok report with sessionState.batchAnswers-only fallback");
}

async function smokeFeedback() {
  const result = await postJson("/api/feedback", {
    draft: {
      sessionId: "smoke-feedback",
      personalityCode: "CEFL",
      role: "Product-minded developer",
      recentUse: "Using AI to plan, implement, and review a Next.js feature.",
      goal: "Build a reliable AI workflow for product engineering without losing control of decisions.",
      totalQuestions: 24,
      answeredQuestions: 21,
      skipRate: 0.125,
      summary: "The report was useful overall, but one scenario question felt too generic for product engineering work.",
      usefulParts: ["The prompt templates were directly reusable.", "The workflow dimension matched the user's actual process."],
      inaccurateParts: ["The report slightly overstated how much the user trusts AI output."],
      questionIssues: ["One question was too close to general productivity advice."],
      reportIssues: ["The summary needs a sharper link to product shipping decisions."],
      improvementSuggestions: ["Ask more about code review and release-risk decisions."],
      sentiment: "mixed",
      priority: "medium",
      feedbackTypes: ["report_issue", "question_issue", "prompt_template"],
      rawDialogue: [
        { role: "assistant", content: "Which part felt least useful?" },
        { role: "user", content: "The generic productivity scenario did not fit my real work." },
      ],
      createdAt: "2026-04-30T00:00:00.000Z",
    },
  });

  assert.equal(result.json.success, true, "feedback.success must be true");
  assertOneOf(result.json.storage, ["local", "notion"], "feedback.storage");
  if (result.json.storage === "local") {
    assertText(result.json.file, "feedback.file");
  }
  if (result.json.storage === "notion") {
    assertText(result.json.url, "feedback.url");
  }
  if (result.json.warning != null) {
    assertText(result.json.warning, "feedback.warning");
  }

  console.log("ok structured feedback save");
}

async function smokeFeedbackChat() {
  if (!runLlmSmoke) {
    console.log("skip feedback chat: set RUN_LLM_SMOKE=1 to call the LLM");
    return;
  }

  const result = await postJson("/api/feedback/chat", {
    context: {
      sessionId: "smoke-feedback-chat",
      identity: "Product-minded developer",
      personalityCode: "CEFL",
      personalityName: "Collaborative Explorer",
      role: "Product-minded developer",
      recentUse: "Using AI to plan, implement, and review a Next.js feature.",
      goal: "Build a reliable AI workflow for product engineering without losing control of decisions.",
      totalQuestions: 24,
      answeredQuestions: 21,
      skipRate: 0.125,
      reportSummary: "The user is exploratory but wants explicit uncertainty and review checkpoints.",
      reportTags: ["exploratory", "review-oriented"],
      collaborationManifesto: "I want AI to help me move faster while keeping key product decisions explicit.",
      promptTemplateTitles: ["Plan before implementation", "Review risk checklist"],
    },
    messages: [
      { role: "assistant", content: "What part of the report should we improve first?" },
      { role: "user", content: "Make the questions more specific to product engineering and code review." },
    ],
  });

  assertOneOf(result.json.action, ["ask_followup", "ready_to_save"], "feedbackChat.action");
  assertText(result.json.assistantMessage, "feedbackChat.assistantMessage");
  if (result.json.draft != null) {
    assertRecord(result.json.draft, "feedbackChat.draft");
    assertText(result.json.draft.sessionId, "feedbackChat.draft.sessionId");
    assertText(result.json.draft.summary, "feedbackChat.draft.summary");
    assert.ok(Array.isArray(result.json.draft.feedbackTypes), "feedbackChat.draft.feedbackTypes must be an array");
  }

  console.log("ok feedback chat LLM smoke");
}

await assertServerReady();
console.log(`smoke base url: ${baseUrl}`);

await smokeOpening();
const { generated } = await smokeQuestionnaireGeneration();
await smokeReport(generated);
await smokeFeedback();
await smokeFeedbackChat();

console.log("phase6/phase7 API smoke complete");
