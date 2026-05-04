# ASSISTANT.md

This file provides guidance to coding assistants working in this repository.

## Project Overview

**Human-AI Performance Lab** (`human-ai-performance-lab`) is an AI-MBTI assessment system. Users complete a lightweight background interview, two questionnaire batches, one mid-dialogue calibration, and a final report. The server deterministically scores four dimensions, while Qwen writes explanatory report text through structured tool calls.

The four AI-MBTI dimensions are scored 0-100:
- **Relation**: Instrumental ↔ Collaborative
- **Workflow**: Framed ↔ Exploratory
- **Epistemic**: Auditing ↔ Trusting
- **RepairScope**: Global ↔ Local

AI-HQ runtime pages, APIs, and source files have been removed. `docs/phase2-aihq-design.md` only preserves the dimension design for future report-module work.

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # production build
npm run start        # run production build
npm run lint         # next lint
npm run typecheck    # tsc --noEmit

npm run check:llm        # Verify Qwen/OpenAI-compatible config + minimal chat call
npm run check:llm-tools  # Verify Qwen tool-call support
npm run test:browser     # Open /test-lab via Playwright and read self-test summary
npm run smoke:phase6-phase7  # API smoke against a running dev server
```

There is no unit test runner. Self-tests live in `src/lib/selfTests.ts` and surface through `/test-lab`. They cover AI-MBTI scoring, skipped answers, questionnaire batch structure, fallback validity, duplicate-question detection, report fallback from `batchAnswers`, mid-dialogue safety, personality profiles, portable report artifacts, and target-context fallback.

## Architecture

### Stack

Next.js 14 App Router · TypeScript strict · Tailwind · Framer Motion · Recharts · react-markdown. Routing uses `src/app/**`; path alias `@/*` maps to `src/*`.

### Qwen LLM Layer

`src/lib/qwen.ts` is the only LLM transport. It calls `${OPENAI_COMPATIBLE_BASE_URL}/chat/completions` with `OPENAI_COMPATIBLE_API_KEY`.

Primary config:
- `QWEN_MODEL`
- `QWEN_FALLBACK_MODEL`
- `QWEN_MAX_TOKENS`
- `QWEN_CHAT_MAX_RETRIES`
- optional `QWEN_REPORT_MODEL` / `QWEN_REPORT_MAX_TOKENS`

For DashScope base URLs, `src/lib/qwen.ts` auto-adds `enable_thinking:false` unless `OPENAI_COMPATIBLE_ENABLE_THINKING=1`. `OPENAI_COMPATIBLE_EXTRA_JSON` can shallow-merge vendor-specific fields into chat-completion requests.

### Researcher Flow

The current AI-MBTI pipeline is a single researcher flow, not the older two-agent runtime split.

- `src/lib/researcher.ts` — researcher system prompt, tool schemas, questionnaire prompts, mid-dialogue prompts, and tool-use parsing.
- `src/lib/sessionState.ts` — canonical `SessionState`, phase helper, batch answers, mid-dialogues, `refinedTargetContext`, and `scenarioGuidance`.
- `src/lib/targetContext.ts` — infers and normalizes the user's role, recent use, and goal.
- `src/lib/fallbackQuestionnaire.ts` and `src/lib/questionnaireValidation.ts` — fallback batches and validation for 8+16 questionnaire generation.
- `src/lib/reportScoring.ts` — deterministic server-side scoring. The model never computes scores.
- `src/lib/reportAgent.ts` — report-writing system prompt.
- `src/lib/personalityProfiles.ts` — fixed 16-type map and profile metadata.
- `src/lib/feedbackStorage.ts` — Notion write and local feedback fallback.

### API Routes

- `chat/route.ts` and `chat/stream/route.ts` — main AI-MBTI conversation endpoints.
- `questionnaire/generate/route.ts` — 8+16 batch generation.
- `mid-dialog/opening/route.ts` — mid-dialogue opening prompt generation.
- `report/route.ts` — scoring plus report generation.
- `feedback/route.ts` — structured feedback save.
- `local-debug/interview-run/route.ts` — dev-only debug log access.

### Pages

`/`, `/interview`, `/report`, `/test-lab`, `/avatar-preview`, and `/mock-report`.

### Local Debug Data

In dev, interview runs are written to `.local-debug/interview-runs/`. Feedback writes to Notion when configured, otherwise to `.local-debug/feedback/`. Both directories can contain user text and report context. They are gitignored and must not be committed.

## Design System

`Design.md` documents the Raycast-style dark theme. New UI should follow the existing Tailwind tokens, surface colors, shadows, typography, and accent usage.

## Repo Conventions

- LLM calls use structured tool calls, not free-form JSON parsing.
- Scoring logic stays in TypeScript.
- Background phase responses must include a user-facing Chinese assistant message and a tool call.
- Questionnaire batches are fixed at 8 and 16 questions for the current flow.
- Mid-dialogues must write user corrections into `scenarioGuidance` / `refinedTargetContext`.
- “不了解 / 没想好” is a skip, not a seventh Likert level.
- After prompt/model changes, run static checks first; run `npm run check:llm` only when the local Qwen gateway config is ready.
