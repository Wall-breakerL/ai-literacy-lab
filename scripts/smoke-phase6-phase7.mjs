#!/usr/bin/env node
/**
 * Active AI-MBTI flow smoke test.
 * Tests: 8+8 questionnaire generation, report generation, and feedback storage.
 *
 * Usage: node scripts/smoke-phase6-phase7.mjs
 * Requires: npm run dev (server running on localhost:3000)
 * Optional: RUN_LLM_SMOKE=1 to require model-backed generation instead of fallback.
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
  scenarioSummary: "The user wants AI help for shipping product features with planning and review.",
  granularity: "specific",
  avoidTopics: ["generic writing advice"],
  includeTopics: ["feature planning", "code review", "debugging"],
  userCorrectionQuote: "I want questions about real product work, not generic study habits.",
};

function createSessionState(sessionId = `smoke-active-flow-${Date.now()}`) {
  return {
    sessionId,
    turn: 1,
    phase: "questionnaire_batch1",
    background: {
      role: "Product-minded developer",
      tools: ["ChatGPT", "Qwen", "GitHub Copilot"],
      recentUse: "Using AI to plan, implement, and review a Next.js feature.",
      goal: "提高效率，并获得更多 idea/思路/选择/灵感",
      summary: "The user works on product engineering and wants practical AI collaboration patterns.",
    },
    evidence: [],
    openProbes: [],
    refinedTargetContext: {
      role: "Product-minded developer",
      tools: ["ChatGPT", "Qwen", "GitHub Copilot"],
      recentUse: "Using AI to plan, implement, and review a Next.js feature.",
      goal: "提高效率，并获得更多 idea/思路/选择/灵感",
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
      reverse: question.reverse ?? false,
      score,
      skipped: score == null,
      ...(score == null ? { skipReason: "unsure_or_not_applicable" } : {}),
    };
  });
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
  assertOneOf(question.questionType, ["universal", "semi_specific", "specific"], `${label}.questionType`);
}

function assertQuestionBatch(questions, mode, label) {
  assert.ok(Array.isArray(questions), `${label} must be an array`);
  assert.equal(questions.length, 8, `${label} must contain 8 questions`);

  for (const [index, question] of questions.entries()) {
    assertQuestion(question, `${label}[${index}]`);
  }

  const expectedTypeCounts =
    mode === "hybrid_batch1"
      ? { universal: 4, semi_specific: 4, specific: 0 }
      : { universal: 0, semi_specific: 4, specific: 4 };
  for (const [type, count] of Object.entries(expectedTypeCounts)) {
    assert.equal(
      questions.filter((question) => question.questionType === type).length,
      count,
      `${label} must include ${count} ${type} questions`
    );
  }

  for (const dimension of dimensions) {
    const items = questions.filter((question) => question.dimension === dimension);
    assert.equal(items.length, 2, `${label} must include 2 ${dimension} questions`);
    assert.equal(
      items.filter((question) => question.reverse).length,
      1,
      `${label} must include 1 reverse ${dimension} question`
    );
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
    if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`Cannot reach ${baseUrl}. Start the app with npm run dev first.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
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
    assert.ok(String(result.json.message).includes("点击按钮"), `${batchMode}.message should ask user to continue`);
    assertQuestionBatch(result.json.questions, batchMode, `${batchMode}.questions`);
    assertSessionState(result.json.sessionState, `${batchMode}.sessionState`);
    assert.equal(result.json.sessionState.phase, expectedPhase, `${batchMode}.sessionState.phase`);
    assertQuestionBatch(
      result.json.sessionState.questionnaireBatches[batchKey],
      batchMode,
      `${batchMode}.sessionState.questionnaireBatches.${batchKey}`
    );
    assert.equal(result.json.sessionState.questionnaire.length, existingQuestions.length + 8);
    assert.equal(typeof result.json.retryCount, "number", `${batchMode}.retryCount must be a number`);
    assertText(result.json.model, `${batchMode}.model`);
    assert.equal(typeof result.json.thinkDurationSec, "number", `${batchMode}.thinkDurationSec`);

    generated[batchKey] = result.json.questions;
    sessionState = result.json.sessionState;
    existingQuestions = result.json.sessionState.questionnaire;
  }

  console.log("ok questionnaire generate active 8+8 batches");
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
      messages: [{ role: "user", content: "I use AI for product planning and code review." }],
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
      personalityCode: "CFAG",
      role: "Product-minded developer",
      recentUse: "Using AI to plan, implement, and review a Next.js feature.",
      goal: "提高效率，并获得更多 idea/思路/选择/灵感",
      totalQuestions: 16,
      answeredQuestions: 14,
      skipRate: 0.125,
      summary: "The report was useful overall, but one scenario question felt too generic.",
      usefulParts: ["The prompt templates were directly reusable."],
      inaccurateParts: ["The report slightly overstated how much the user trusts AI output."],
      questionIssues: ["One question was too close to general productivity advice."],
      reportIssues: ["The summary needs a sharper link to product shipping decisions."],
      improvementSuggestions: ["Ask more about code review and release-risk decisions."],
      sentiment: "mixed",
      priority: "medium",
      feedbackTypes: ["report_issue", "question_issue", "prompt_template"],
      rawDialogue: [{ role: "user", content: "The generic productivity scenario did not fit my real work." }],
      createdAt: "2026-05-05T00:00:00.000Z",
    },
  });

  assert.equal(result.json.success, true, "feedback.success must be true");
  assertOneOf(result.json.storage, ["local", "notion"], "feedback.storage");
  console.log("ok structured feedback save");
}

await assertServerReady();
console.log(`smoke base url: ${baseUrl}`);

const { generated } = await smokeQuestionnaireGeneration();
await smokeReport(generated);
await smokeFeedback();

console.log("active AI-MBTI API smoke complete");
