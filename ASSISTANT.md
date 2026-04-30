# ASSISTANT.md

This file provides guidance to the assistant (claude.ai/code) when working with code in this repository.

## Project Overview

**Human-AI Performance Lab** (`human-ai-performance-lab`, v6.0.0) — an AI-MBTI assessment system. Users chat with a single "researcher" agent for a lightweight background interview, then complete Phase 6's three 8-question batches: habit, scenario, and mixed. Two mid-dialogues between batches collect user feedback about fit and scenario granularity. The server deterministically scores four dimensions and the LLM writes a personalized report.

The four AI-MBTI dimensions (each scored 0–100):
- **Relation**: Instrumental ↔ Collaborative
- **Workflow**: Framed ↔ Exploratory
- **Epistemic**: Auditing ↔ Trusting
- **RepairScope**: Global ↔ Local

Note: AI-HQ v0.1 (the `/hq-interview`, `/hq-report` flow and `src/lib/hq*.ts`) is **archived** — keep working but do not extend. `/test-lab` currently skips the AI-HQ section in the UI.

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # production build
npm run start        # run production build
npm run lint         # next lint (ESLint, .eslintrc.json extends next/core-web-vitals)
npm run typecheck    # tsc --noEmit (strict TS)

npm run check:llm        # Verify LLM provider config + minimal chat call (reads .env.local)
npm run check:llm-tools  # Verify provider supports tool use (force a test tool call)
npm run test:browser     # Open /test-lab via Playwright; validates the structured self-test summary
npm run smoke:phase6-phase7  # API smoke against a running dev server; RUN_LLM_SMOKE=1 also tests feedback chat
```

There is no unit test runner; **self-tests live in `src/lib/selfTests.ts`** and are surfaced through the `/test-lab` page. To run a focused case, edit `selfTests.ts`, then load `/test-lab` or run `npm run test:browser`. Current visible coverage is AI-MBTI logic only: 1-6 scoring, skipped answers, Phase 6 24-question scoring/confidence, fallback batch validity, generic-scenario rejection, duplicate-question detection, `batchAnswers` report fallback, mid-dialogue visible-text safety, four-dimension fill-in, personality codes, 16-type config, Phase 5 portable artifacts, question text composition, and target-context fallback. This is not API E2E coverage.

## Architecture

### Stack
Next.js 14 App Router · TypeScript (strict) · Tailwind · Framer Motion · Recharts · react-markdown. Routing uses `/src/app/**`. Path alias `@/*` → `src/*`.

### Two LLM provider modes (see `src/lib/claude.ts`)
`LLM_PROVIDER` switches between:
- `openai-compatible` → calls `${OPENAI_COMPATIBLE_BASE_URL}/chat/completions`. Some gateways require `OPENAI_COMPATIBLE_FORCE_TEMPERATURE=1`.
- `anthropic` → calls `${ANTHROPIC_BASE_URL}/messages` with `ANTHROPIC_VERSION`.

`createClaudeMessageWithTools()` is the unified entrypoint and handles tool-use across both providers. Main AI-MBTI models are configured by `CLAUDE_RESEARCHER_MODEL`, `CLAUDE_RESEARCHER_FALLBACK_MODEL`, and `CLAUDE_RESEARCHER_MAX_TOKENS`. `ENABLE_PROMPT_CACHE=1` toggles prompt caching. `CLAUDE_AGENT_A_MODEL` / `CLAUDE_AGENT_B_MODEL` remain as legacy aliases for archived or compatibility paths.

### Single-agent "researcher" flow
The current AI-MBTI pipeline is **one agent (the researcher)** doing tool-augmented turns, not the older Agent A + Agent B split. Treat older 16/20 single-questionnaire and Agent A/B documentation as legacy unless explicitly updating compatibility code. Key modules:

- `src/lib/researcher.ts` — system prompt, tool schemas, batch-questionnaire prompts, mid-dialogue prompts, and parsing of tool-uses into `AgentBOutput`. The initial background boundary still uses `QUESTIONNAIRE_ENTRY_ROUND` (=2), but Phase 6 questionnaire generation is batch-driven after that.
- `src/lib/sessionState.ts` — canonical `SessionState` (background, evidence, openProbes, questionnaire, answers, phase, `questionnaireBatches`, `batchAnswers`, `midDialogues`, `refinedTargetContext`, `scenarioGuidance`). `applySessionStatePatch` advances state and `pruneOldTranscript` keeps prompt size bounded.
- `src/lib/targetContext.ts` — infers/normalizes the user's current goal so generated questions can bind to it; has fallback inference from messages.
- `src/lib/fallbackQuestionnaire.ts` + `src/lib/questionnaireValidation.ts` — Phase 6 has three 8-question fallback batches and validation for per-batch and 24-question totals. The legacy 16-question fallback remains for old single-questionnaire compatibility.
- `src/lib/reportScoring.ts` — **deterministic server-side scoring**. Reverse items are flipped here; "不了解/没想好" (skip) does not contribute. Confidence is high at >=4 valid answers per dimension, medium at 2-3, low below 2. The LLM never computes scores.
- `src/lib/reportAgent.ts` — given final scores + evidence, produces the report (summary, personality code, tags, dimension analyses, prompt templates).
- `src/lib/personalityProfiles.ts` — the 16-type code map (e.g. `IFAL` → "细节修补师").
- `src/lib/feedbackAgent.ts` + `src/lib/feedbackStorage.ts` — Phase 7 report feedback dialogue and Notion/local storage.

### API routes (`src/app/api/`)
- `chat/route.ts` and `chat/stream/route.ts` — main AI-MBTI conversation endpoint; `maxDuration = 60` (Vercel Pro). Uses `MAX_CHAT_RETRIES` (`CLAUDE_CHAT_MAX_RETRIES`, default 3) and `llmRetry`/`clientApiRetry`.
- `questionnaire/generate/route.ts` — Phase 6 batch generation; returns one 8-question batch and updated `SessionState`.
- `mid-dialog/opening/route.ts` — creates the first visible mid-dialogue prompt after batch 1 or batch 2.
- `questionnaire/route.ts` — legacy questionnaire delivery & validation.
- `report/route.ts` — final scoring + report generation; accepts request answers first, then `sessionState.answers`, then flattened `sessionState.batchAnswers`.
- `feedback/chat/route.ts` and `feedback/route.ts` — Phase 7 feedback dialogue and structured feedback save.
- `hq-chat/*`, `hq-report` — **archived** AI-HQ endpoints, do not extend.
- `local-debug/interview-run/route.ts` — dev-only access to debug logs.

### Pages
`/` (home), `/interview` (AI-MBTI background interview + three batches + mid-dialogues), `/report`, `/feedback-debug`, `/test-lab` (self tests), `/avatar-preview`, plus archived `/hq-interview`, `/hq-report`.

### Local debug logs and feedback storage
In dev, interview runs are written to `.local-debug/interview-runs/` (raw user text, system prompts, model responses). Phase 7 writes structured feedback to Notion when `NOTION_API_KEY` and a feedback data source id are configured; otherwise it writes JSON to `.local-debug/feedback/`. Both directories can contain user text and report context. Already gitignored — **do not commit**.

## Design System

`Design.md` documents a **Raycast-style dark theme**: near-black blue-tinted background `#07080a`, surfaces `#101111` / `#1b1c1e`, multi-layer macOS-style shadows with inset highlights, Raycast Red `#FF6363` used only as punctuation (hero stripes, danger), Raycast Blue `hsl(202,100%,67%)` for interactive accents, Inter with positive letter-spacing (~0.2px) for body, GeistMono for code. Tailwind tokens are configured in `tailwind.config.ts` to match. New UI must follow this system rather than introducing new palettes.

## Conventions specific to this repo

- LLM calls are **structured-output via tool use**, not free-form JSON parsing. When extending the researcher, add fields to the tool schema in `researcher.ts` and consume them through `agentBOutputFromToolUses`.
- Scoring logic stays in TypeScript; never ask the model to output numerical scores.
- Background phase responses must contain a real Chinese assistant message **and** a tool call — both are required for the round to advance.
- Phase 6 batches are fixed at 8 questions each: four dimensions × two questions, one forward and one reverse. `habit_batch` uses `scenario: "习惯"`, `scenario_batch` requires concrete scenarios, and `mixed_batch` is four habit plus four scenario questions.
- Mid-dialogues must write user corrections into `scenarioGuidance` / `refinedTargetContext`; do not rely only on transcript text.
- The questionnaire always exposes a separate "不了解 / 没想好" option; treat it as a skip (no score), not a 7th Likert level.
- When changing prompts/models, also run `npm run check:llm` against the configured gateway before committing — gateways differ in tool-use semantics and temperature handling.
