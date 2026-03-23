import type { ChatMessage } from "../types";
import type { ScenarioBlueprint } from "../scenario-v2/types";
import type { EvalEventRecordV2 } from "../assessment-v2/extract-events-v2";
import type { JudgeOutputV2 } from "../assessment-v2/types";
import { V2_DIMENSION_KEYS, V2_DIMENSION_MAX, RUBRIC_VERSION_V2 } from "../assessment-v2/weights";
import { VERSION } from "../constants";

const DEFAULT_JUDGE_MODEL = "gpt-4o";

const PRINCIPLES = `
你必须遵守：
1. 评分对象是**用户**，不是 assistant 的表演或文采。
2. **禁止**把「prompt 写得好不好」当作 AI 理解能力；心智模型看的是对输出可靠性、边界、分工的理解。
3. 证据优先来自**用户原话**与可观察行为（含收尾反思中的表述）。
4. assistant 表现差时，先判断用户是否有机会识别再决定是否扣用户分。
5. 输出必须是合法 JSON，无其他文字。
`;

function probeSummary(bp: ScenarioBlueprint | null): string {
  if (!bp?.hiddenProbes?.length) return "（无）";
  return bp.hiddenProbes
    .map((p) => `${p.probeId}: ${p.assistantMove} → 目标维 ${p.targetDimensions.join(",")}`)
    .join("\n");
}

export function buildJudgePromptV2(
  scenarioId: string,
  blueprint: ScenarioBlueprint | null,
  identityCompiled: string | null,
  messages: ChatMessage[],
  events: EvalEventRecordV2[]
): string {
  const transcript = messages.map((m) => `[${m.role}]: ${m.content}`).join("\n");
  const eventSummary = events.length ? events.map((e) => e.event).join(", ") : "（无）";
  const world = blueprint?.worldState ?? "（无蓝图数据）";

  return `
## 身份上下文（研究者注入，勿泄露给被测者）
${identityCompiled?.trim() || "（未配置：按通用被测者）"}

## 场景
- id: ${scenarioId}
- 世界状态：${world}

## 隐性探针（仅评分参考）
${probeSummary(blueprint)}

## 对话全文（含收尾反思段落）
${transcript}

## 事件摘要
${eventSummary}

## 两层七维（每维给出 score（0 到该维 max 的整数或一位小数）、evidence 用户原话摘录、reason）

**Layer A 协作行为**
1. taskFraming max=${V2_DIMENSION_MAX.taskFraming}：是否说清目标、约束、对象/分工。
2. dialogSteering max=${V2_DIMENSION_MAX.dialogSteering}：是否推进、纠偏、协商。
3. evidenceSeeking max=${V2_DIMENSION_MAX.evidenceSeeking}：是否主动核实、要来源、关心时效。

**Layer B AI 理解能力**（不得偷换为 prompt 技巧）
4. modelMentalModel max=${V2_DIMENSION_MAX.modelMentalModel}：是否理解输出≠事实、受提示/模型/上下文影响。
5. failureAwareness max=${V2_DIMENSION_MAX.failureAwareness}：是否觉察错误、幻觉、不确定。
6. trustBoundaryCalibration max=${V2_DIMENSION_MAX.trustBoundaryCalibration}：信任是否适度；隐私/责任/学术诚信等边界。
7. reflectiveTransfer max=${V2_DIMENSION_MAX.reflectiveTransfer}：能否总结下次如何分工人机任务。

另输出 blindSpots（1–4 条）、nextRecommendedScenarios、nextRecommendedProbes（字符串数组可空）、flags、suggestions。

${PRINCIPLES}
`;
}

export function judgeV2SchemaHint(): string {
  const dimExample = V2_DIMENSION_KEYS.map((k) => `"${k}": { "score": 0, "max": ${V2_DIMENSION_MAX[k]}, "evidence": [], "reason": "" }`).join(",\n    ");
  return `请输出且仅输出 JSON：
{
  "rubricVersion": "${RUBRIC_VERSION_V2}",
  "scenarioId": "",
  "identityId": "",
  "dimensions": {
    ${dimExample}
  },
  "flags": [],
  "suggestions": [],
  "blindSpots": [],
  "nextRecommendedScenarios": [],
  "nextRecommendedProbes": []
}`;
}

function extractJson(content: string): unknown | null {
  const s = content.trim();
  try {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last > first) {
      return JSON.parse(s.slice(first, last + 1));
    }
    const codeBlock = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
    if (codeBlock) return JSON.parse(codeBlock[1].trim());
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function parseJudgeOutputV2(raw: unknown, scenarioId: string, identityId?: string): JudgeOutputV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const dimensionsIn = o.dimensions as Record<string, unknown> | undefined;
  if (!dimensionsIn) return null;

  const dimensions = {} as JudgeOutputV2["dimensions"];
  for (const k of V2_DIMENSION_KEYS) {
    const d = dimensionsIn[k];
    if (!d || typeof d !== "object") return null;
    const dd = d as Record<string, unknown>;
    const max = V2_DIMENSION_MAX[k];
    const score = Number(dd.score);
    if (Number.isNaN(score)) return null;
    dimensions[k] = {
      score: Math.min(max, Math.max(0, Math.round(score * 10) / 10)),
      max,
      evidence: Array.isArray(dd.evidence) ? (dd.evidence as unknown[]).map(String).filter(Boolean) : [],
      reason: typeof dd.reason === "string" ? dd.reason : "",
    };
  }

  return {
    rubricVersion: typeof o.rubricVersion === "string" ? o.rubricVersion : RUBRIC_VERSION_V2,
    scenarioId: typeof o.scenarioId === "string" ? o.scenarioId : scenarioId,
    identityId: typeof o.identityId === "string" ? o.identityId : identityId,
    dimensions,
    flags: Array.isArray(o.flags) ? (o.flags as unknown[]).map(String) : [],
    suggestions: Array.isArray(o.suggestions) ? (o.suggestions as unknown[]).map(String).filter(Boolean) : [],
    blindSpots: Array.isArray(o.blindSpots) ? (o.blindSpots as unknown[]).map(String).filter(Boolean) : [],
    nextRecommendedScenarios: Array.isArray(o.nextRecommendedScenarios)
      ? (o.nextRecommendedScenarios as unknown[]).map(String)
      : [],
    nextRecommendedProbes: Array.isArray(o.nextRecommendedProbes)
      ? (o.nextRecommendedProbes as unknown[]).map(String)
      : [],
  };
}

export async function callJudgeApiV2(
  sessionId: string,
  scenarioId: string,
  blueprint: ScenarioBlueprint | null,
  identityCompiled: string | null,
  messages: ChatMessage[],
  events: EvalEventRecordV2[],
  identityId?: string
): Promise<JudgeOutputV2 | null> {
  const apiKey = process.env.OPENAI_JUDGE_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;
  const userContent =
    buildJudgePromptV2(scenarioId, blueprint, identityCompiled, messages, events) + judgeV2SchemaHint();

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: userContent }],
      max_tokens: 4096,
    };
    if (!baseUrl.includes("minimax")) {
      body.response_format = { type: "json_object" };
    }
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    if (!res.ok) return null;
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;
    const parsed = extractJson(text);
    return parseJudgeOutputV2(parsed, scenarioId, identityId);
  } catch {
    return null;
  }
}

export function judgePromptVersionV2(): string {
  return `${VERSION.judgePromptVersion}-v2`;
}
