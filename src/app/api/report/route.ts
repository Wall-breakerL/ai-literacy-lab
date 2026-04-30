import { NextRequest, NextResponse } from "next/server";
import { AGENT_B_REPORT_SYSTEM } from "@/lib/reportAgent";
import { withLlmRetry } from "@/lib/llmRetry";
import {
  AGENT_B_MAX_TOKENS,
  AGENT_B_MODEL,
  assertClaudeApiKey,
  cacheSystemPrompt,
  createClaudeMessageWithTools,
  getUpstreamErrorMessage,
  type ClaudeTool,
  type ClaudeToolUse,
} from "@/lib/claude";
import { getPersonalityCode, getPersonalityProfile } from "@/lib/personalityProfiles";
import { completePortableArtifacts } from "@/lib/reportPortableArtifacts";
import {
  mergeScoredDimensions,
  resolveReportQuestionnaireAnswers,
  scoreQuestionnaireAnswers,
} from "@/lib/reportScoring";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { getEffectiveTargetContext, isSessionState, summarizeSessionStateForPrompt } from "@/lib/sessionState";
import { inferTargetContextFromMessages, normalizeTargetContext } from "@/lib/targetContext";
import {
  CollaborationSignature,
  Dimension,
  FinalReport,
  Message,
  PromptTemplate,
  QuestionnaireAnswer,
  ReportRecommendation,
  ReportStyleOverview,
  SessionState,
  TargetContext,
} from "@/lib/types";
import { parseJsonObjectFromModel } from "@/lib/jsonResponse";

export const maxDuration = 60;
export const runtime = "nodejs";

const GENERATE_REPORT_TOOL: ClaudeTool = {
  name: "generate_ai_mbti_report",
  description: "生成 AI-MBTI 报告解释文本。必须通过工具参数返回结构化内容，不要输出 JSON 文本。",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "tags",
      "styleOverview",
      "collaborationManifesto",
      "collaborationSignature",
      "overallAdvice",
      "recommendations",
      "promptTemplates",
      "dimensions",
    ],
    properties: {
      summary: {
        type: "string",
        description: "一两句话的总体评语，有个性，不要平淡。",
      },
      tags: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string" },
      },
      styleOverview: {
        type: "object",
        additionalProperties: false,
        required: ["corePattern", "strengthArea", "growthDirection"],
        properties: {
          corePattern: {
            type: "string",
            minLength: 40,
            description: "60-80 字，综合四维描述核心协作模式，只描述风格，不判断真实表现。",
          },
          strengthArea: {
            type: "string",
            minLength: 40,
            description: "60-80 字，结合 role、recentUse、targetContext 描述适合的场景，不写真实使用表现。",
          },
          growthDirection: {
            type: "string",
            minLength: 40,
            description: "60-80 字，给出下一次使用 AI 时可立刻尝试的具体动作。",
          },
        },
      },
      collaborationManifesto: {
        type: "string",
        minLength: 100,
        maxLength: 200,
        description:
          "100-200 字第一人称长期协作偏好文本，必须包含 role、recentUse、targetContext.goal 和至少两个维度偏好；不要占位符，不要写“我应该/我需要”。",
      },
      collaborationSignature: {
        type: "object",
        additionalProperties: false,
        required: ["detail"],
        properties: {
          detail: {
            type: "string",
            minLength: 60,
            maxLength: 80,
            description:
              "60-80 字，用“从本次回答看”开头或包含该短语，引用最强 evidence 或问卷题面解释协作签名。不要输出 headline。",
          },
        },
      },
      overallAdvice: {
        type: "string",
        description: "整体建议，绑定用户目标，指出更适合尝试的用法和下一次最值得尝试的具体动作，不假装有真实使用表现数据。",
      },
      recommendations: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "detail"],
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
          },
        },
      },
      promptTemplates: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "useCase", "prompt"],
          properties: {
            title: { type: "string" },
            useCase: { type: "string" },
            prompt: { type: "string" },
          },
        },
      },
      dimensions: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["dimension", "analysis"],
          properties: {
            dimension: {
              type: "string",
              enum: ["Relation", "Workflow", "Epistemic", "RepairScope"],
            },
            analysis: {
              type: "string",
              minLength: 80,
              description:
                "该维度的模型分析，必须结合分数、有效回答数量和至少一个用户原话/答题证据说明为什么得出这个倾向；不能留空。",
            },
          },
        },
      },
    },
  },
};

const REPORT_DIMENSIONS: Dimension[] = ["Relation", "Workflow", "Epistemic", "RepairScope"];
const DIMENSION_ALIASES: Record<string, Dimension> = {
  Relation: "Relation",
  relation: "Relation",
  "关系定位": "Relation",
  Workflow: "Workflow",
  workflow: "Workflow",
  "工作流程": "Workflow",
  Epistemic: "Epistemic",
  epistemic: "Epistemic",
  "认知态度": "Epistemic",
  RepairScope: "RepairScope",
  repairscope: "RepairScope",
  repair_scope: "RepairScope",
  "修复范围": "RepairScope",
};

export async function POST(req: NextRequest) {
  const missing = assertClaudeApiKey();
  if (missing) {
    return NextResponse.json({ error: "configuration", detail: missing }, { status: 503 });
  }

  try {
    const { identity, questionnaireAnswers, messages, targetContext, sessionState: rawSessionState } = await req.json() as {
      identity: string;
      questionnaireAnswers?: QuestionnaireAnswer[];
      messages?: Message[];
      targetContext?: TargetContext;
      sessionState?: SessionState;
    };

    const sessionState = isSessionState(rawSessionState) ? rawSessionState : undefined;
    const effectiveAnswers = resolveReportQuestionnaireAnswers({ questionnaireAnswers, sessionState });
    const sessionTargetContext = sessionState ? getEffectiveTargetContext(sessionState) : undefined;
    const scoredDimensions = withSessionQuoteEvidence(
      scoreQuestionnaireAnswers(effectiveAnswers),
      sessionState
    );
    const personality = getPersonalityProfile(getPersonalityCode(scoredDimensions));
    const inferredContext = inferTargetContextFromMessages(messages ?? []);
    const normalizedTargetContext = normalizeTargetContext(
      sessionState?.refinedTargetContext ?? targetContext ?? sessionTargetContext,
      inferredContext
    );
    const sessionStateText = sessionState ? summarizeSessionStateForPrompt(sessionState) : "（暂无 SessionState）";
    const answersText = effectiveAnswers.length > 0
      ? effectiveAnswers
          .map(
            (a, i) =>
              `【题目${i + 1}】\n维度：${a.dimension}\n场景：${a.scenario}\n题目：${a.question}\n回答：${
                a.skipped || a.score == null ? "不了解 / 没想好（未计分）" : `${a.score}分`
              }${a.reverse ? "（反向题）" : ""}`
          )
          .join("\n\n")
      : "无问卷回答";

    const prompt = `用户身份：${identity}

服务端已计算出的维度结果（必须原样沿用，不要重算）：
${JSON.stringify(scoredDimensions, null, 2)}

服务端已确定的人格画像（必须沿用）：
${JSON.stringify(personality, null, 2)}

目标上下文（建议与模板必须绑定它；goalStatus=missing 时，基于 recentUse 写）：
${JSON.stringify(normalizedTargetContext, null, 2)}

问卷回答：
${answersText}

访谈记忆摘要：
${sessionStateText}

可引用的用户原话证据（优先用于 dimensions.analysis 和 evidence）：
${formatQuoteEvidenceForPrompt(sessionState)}

请根据以上维度结果、人格画像、目标上下文、问卷回答和访谈记忆摘要生成AI-MBTI分析报告。
必须调用 generate_ai_mbti_report 工具返回结构化内容，不要输出 JSON 文本。
不要输出 personality / targetContext / avatarPrompt / colors。
collaborationSignature 只输出 detail；headline 会由服务端从 personality.signatureHeadline 固定注入。
dimensions 中只需要输出 dimension 与 analysis；分数、倾向、证据会由服务端合并。
每个 dimensions.analysis 必须具体解释判断依据：至少包含分数/有效回答数量/一条用户原话或题目证据，不能是空字符串。`;

    const toolResult = await withLlmRetry(() =>
      createClaudeMessageWithTools({
        model: AGENT_B_MODEL,
        system: cacheSystemPrompt(AGENT_B_REPORT_SYSTEM),
        messages: [
          { role: "user", content: prompt },
        ],
        tools: [GENERATE_REPORT_TOOL],
        toolChoice: { type: "tool", name: GENERATE_REPORT_TOOL.name },
        temperature: 0.4,
        maxTokens: AGENT_B_MAX_TOKENS,
      })
    );

    try {
      const report =
        generatedReportFromToolUses(toolResult.toolUses) ??
        generatedReportFromText(stripHiddenReasoning(toolResult.textBlocks.join("\n") || "{}"));
      if (!report) throw new Error("Model report did not contain a usable summary");
      const portableArtifacts = completePortableArtifacts(
        report,
        personality,
        normalizedTargetContext,
        scoredDimensions
      );
      const advice = completeAdviceBundle(report, normalizedTargetContext);
      return NextResponse.json({
        summary: report.summary,
        tags: report.tags,
        styleOverview: portableArtifacts.styleOverview,
        collaborationManifesto: portableArtifacts.collaborationManifesto,
        collaborationSignature: portableArtifacts.collaborationSignature,
        overallAdvice: advice.overallAdvice,
        recommendations: advice.recommendations,
        promptTemplates: advice.promptTemplates,
        targetContext: normalizedTargetContext,
        personality,
        dimensions: mergeScoredDimensions(report.dimensions, scoredDimensions),
      });
    } catch (parseError) {
      console.warn("[report] Failed to parse Agent B report JSON; using fallback", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        stopReason: toolResult.stopReason,
        textPreview: toolResult.textBlocks.join("\n").slice(0, 600),
        toolUseCount: toolResult.toolUses.length,
        toolUseShapes: toolResult.toolUses.map((toolUse) => ({
          name: toolUse.name,
          inputType: typeof toolUse.input,
          inputKeys:
            toolUse.input && typeof toolUse.input === "object"
              ? Object.keys(toolUse.input as Record<string, unknown>).slice(0, 12).join(",")
              : undefined,
          inputShape:
            toolUse.input && typeof toolUse.input === "object"
              ? summarizeReportToolInputShape(toolUse.input as Record<string, unknown>)
              : undefined,
        })),
      });
      const portableArtifacts = completePortableArtifacts(
        {},
        personality,
        normalizedTargetContext,
        scoredDimensions
      );
      const fallback: FinalReport = {
        summary: `你的 AI 协作画像已经生成：整体更接近「${personality.name}」。这份结果基于问卷分数、访谈目标和用户原话证据计算。`,
        tags: scoredDimensions
          .slice()
          .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
          .slice(0, 3)
          .map((dimension) => dimension.tendencyLabel),
        targetContext: normalizedTargetContext,
        personality,
        styleOverview: portableArtifacts.styleOverview,
        collaborationManifesto: portableArtifacts.collaborationManifesto,
        collaborationSignature: portableArtifacts.collaborationSignature,
        overallAdvice: `围绕「${normalizedTargetContext.goal}」，可以先保留你当前最稳定的协作方式，再刻意补一个小动作：在让 AI 执行前，先让它反问你影响结果质量的关键问题。`,
        recommendations: [
          {
            title: "先让 AI 帮你澄清任务边界",
            detail: `下次处理「${normalizedTargetContext.recentUse}」这类任务时，先让 AI 问 3 个问题，再开始生成结果。`,
          },
          {
            title: "把结果拆成一小段一小段验证",
            detail: "不要等完整结果出来后再判断好坏，先验证方向、结构或关键事实，再继续推进。",
          },
        ],
        promptTemplates: [
          {
            title: "开始前反问模板",
            useCase: "任务刚开始、目标还没有完全展开时",
            prompt: `我想完成这个目标：${normalizedTargetContext.goal}。在开始执行前，请先问我 3 个会影响结果质量的关键问题，不要直接给最终答案。`,
          },
        ],
        dimensions: scoredDimensions.map((dimension) => ({
          ...dimension,
          analysis: `该维度得分为 ${dimension.score}，当前更接近「${dimension.tendencyLabel}」。`,
          advice: "",
        })),
      };
      return NextResponse.json(fallback);
    }
  } catch (error) {
    console.error("Report API error:", error);
    const detail = getUpstreamErrorMessage(error);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: detail ?? "请查看 Vercel Function Logs。",
      },
      { status: 502 }
    );
  }
}

function withSessionQuoteEvidence(
  scoredDimensions: ReturnType<typeof scoreQuestionnaireAnswers>,
  sessionState: SessionState | undefined
) {
  if (!sessionState?.evidence?.length) return scoredDimensions;
  return scoredDimensions.map((dimension) => {
    const quoteEvidence = sessionState.evidence.filter((item) => item.evidenceKind === "quote");
    const dimensionQuotes = quoteEvidence.filter((item) => item.dimension === dimension.dimension);
    const backgroundQuotes = quoteEvidence.filter((item) => !item.dimension);
    const quotes = (dimensionQuotes.length > 0 ? dimensionQuotes : backgroundQuotes)
      .slice(-4)
      .sort((a, b) => (a.signal === b.signal ? 0 : a.signal === "strong" ? -1 : 1))
      .map((item) => item.quote);
    return quotes.length > 0
      ? { ...dimension, evidence: Array.from(new Set(quotes)).slice(0, 3) }
      : dimension;
  });
}

function formatQuoteEvidenceForPrompt(sessionState: SessionState | undefined): string {
  const quotes = sessionState?.evidence
    ?.filter((item) => item.evidenceKind === "quote")
    .slice(-8)
    .map((item) => `- ${item.dimension ?? "背景"}：${item.quote}`)
    .join("\n");
  return quotes || "（暂无用户原话证据，可引用具体问卷题目内容）";
}

function generatedReportFromToolUses(toolUses: ClaudeToolUse[]): GeneratedReportDraft | null {
  const toolUse = toolUses.find((item) => item.name === GENERATE_REPORT_TOOL.name);
  if (!toolUse) return null;
  const input = typeof toolUse.input === "string"
    ? parseJsonObjectFromModel<unknown>(toolUse.input)
    : toolUse.input;
  return normalizeGeneratedReportDraft(input);
}

function generatedReportFromText(raw: string): GeneratedReportDraft | null {
  try {
    return normalizeGeneratedReportDraft(parseJsonObjectFromModel<unknown>(raw));
  } catch {
    return null;
  }
}

function summarizeReportToolInputShape(input: Record<string, unknown>) {
  const dimensions = Array.isArray(input.dimensions) ? input.dimensions : [];
  return {
    summary: typeof input.summary,
    tags: Array.isArray(input.tags) ? "array" : typeof input.tags,
    styleOverview:
      input.styleOverview && typeof input.styleOverview === "object"
        ? Object.keys(input.styleOverview as Record<string, unknown>).join(",")
        : typeof input.styleOverview,
    collaborationManifesto: typeof input.collaborationManifesto,
    collaborationSignature:
      input.collaborationSignature && typeof input.collaborationSignature === "object"
        ? Object.keys(input.collaborationSignature as Record<string, unknown>).join(",")
        : typeof input.collaborationSignature,
    overallAdvice: typeof input.overallAdvice,
    recommendations: Array.isArray(input.recommendations) ? "array" : typeof input.recommendations,
    promptTemplates: Array.isArray(input.promptTemplates) ? "array" : typeof input.promptTemplates,
    dimensions: Array.isArray(input.dimensions) ? `array:${input.dimensions.length}` : typeof input.dimensions,
    firstDimension:
      dimensions[0] && typeof dimensions[0] === "object"
        ? Object.keys(dimensions[0] as Record<string, unknown>).join(",")
        : typeof dimensions[0],
  };
}

type GeneratedReportDraft = {
  summary: string;
  tags: string[];
  styleOverview?: Partial<ReportStyleOverview>;
  collaborationManifesto?: string;
  collaborationSignature?: Partial<CollaborationSignature>;
  overallAdvice?: string;
  recommendations?: ReportRecommendation[];
  promptTemplates?: PromptTemplate[];
  dimensions?: {
    dimension: Dimension;
    analysis?: string;
    evidence?: string[];
  }[];
};

function completeAdviceBundle(
  report: GeneratedReportDraft,
  targetContext: TargetContext
): {
  overallAdvice: string;
  recommendations: ReportRecommendation[];
  promptTemplates: PromptTemplate[];
} {
  return {
    overallAdvice:
      report.overallAdvice ??
      `围绕「${targetContext.goal}」，下一次可以先让 AI 复述目标、列出关键假设和需要你确认的风险点，再开始生成结果。`,
    recommendations: report.recommendations?.length
      ? report.recommendations
      : [
          {
            title: "先让 AI 澄清任务边界",
            detail: `处理「${targetContext.recentUse}」这类任务时，先让 AI 反问 3 个会影响结果质量的问题，再开始执行。`,
          },
          {
            title: "把输出拆成可检查的小步",
            detail: "先确认方向、结构和关键事实，再继续生成完整结果，避免一次性产出后才发现偏差。",
          },
        ],
    promptTemplates: report.promptTemplates?.length
      ? report.promptTemplates
      : [
          {
            title: "开始前反问模板",
            useCase: "任务刚开始、目标还没有完全展开时",
            prompt: `我想完成这个目标：${targetContext.goal}。在开始执行前，请先问我 3 个会影响结果质量的关键问题，并标注哪些信息会改变你的方案。`,
          },
        ],
  };
}

function normalizeGeneratedReportDraft(value: unknown): GeneratedReportDraft | null {
  const record = asRecord(value);
  if (!record) return null;
  const summary = toText(record.summary ?? record.overallSummary ?? record.overview ?? record.title);
  if (!summary) return null;
  return {
    summary,
    tags: normalizeTextList(record.tags).slice(0, 4),
    styleOverview: normalizeStyleOverview(record.styleOverview ?? record.glance ?? record.overviewCards),
    collaborationManifesto: toText(record.collaborationManifesto ?? record.manifesto),
    collaborationSignature: normalizeCollaborationSignature(
      record.collaborationSignature ?? record.signature ?? record.funEnding
    ),
    overallAdvice: toText(record.overallAdvice ?? record.advice ?? record.nextStep),
    recommendations: normalizeRecommendations(record.recommendations),
    promptTemplates: normalizePromptTemplates(record.promptTemplates ?? record.prompts),
    dimensions: normalizeGeneratedDimensions(record.dimensions),
  };
}

function normalizeStyleOverview(value: unknown): Partial<ReportStyleOverview> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    corePattern: toText(record.corePattern ?? record.core ?? record.pattern),
    strengthArea: toText(record.strengthArea ?? record.strength ?? record.scenario),
    growthDirection: toText(record.growthDirection ?? record.growth ?? record.nextStep),
  };
}

function normalizeCollaborationSignature(value: unknown): Partial<CollaborationSignature> | undefined {
  const record = asRecord(value);
  if (!record) {
    const detail = toText(value);
    return detail ? { detail } : undefined;
  }
  return {
    detail: toText(record.detail ?? record.description ?? record.content ?? record.summary),
  };
}

function normalizeGeneratedDimensions(value: unknown): GeneratedReportDraft["dimensions"] {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.flatMap((item, index) => {
    const record = asRecord(item);
    if (!record) return [];
    const dimension =
      normalizeDimension(
        record.dimension ?? record.dimensionKey ?? record.key ?? record.name ?? record.label ?? record.title
      ) ?? REPORT_DIMENSIONS[index];
    if (!dimension) return [];
    const analysis =
      toText(
        record.analysis ??
          record.detail ??
          record.explanation ??
          record.summary ??
          record.description ??
          record.reasoning ??
          record.basis ??
          record.insight ??
          record.interpretation ??
          record.finding ??
          record.text ??
          record.content
      ) ?? collectRecordText(record, ["dimension", "dimensionKey", "key", "name", "label", "title"]);
    return [{ dimension, analysis }];
  });
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRecommendations(value: unknown): ReportRecommendation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.flatMap((item) => {
    if (typeof item === "string") {
      const detail = item.trim();
      return detail ? [{ title: detail.slice(0, 24), detail }] : [];
    }
    const record = asRecord(item);
    if (!record) return [];
    const detail = toText(record.detail ?? record.description ?? record.content ?? record.advice);
    const title = toText(record.title ?? record.name) ?? detail?.slice(0, 24);
    return title && detail ? [{ title, detail }] : [];
  });
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePromptTemplates(value: unknown): PromptTemplate[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.flatMap((item) => {
    if (typeof item === "string") {
      const prompt = item.trim();
      return prompt ? [{ title: "可直接尝试的 Prompt", useCase: "下次使用 AI 时", prompt }] : [];
    }
    const record = asRecord(item);
    if (!record) return [];
    const prompt = toText(record.prompt ?? record.template ?? record.content);
    if (!prompt) return [];
    return [
      {
        title: toText(record.title ?? record.name) ?? "可直接尝试的 Prompt",
        useCase: toText(record.useCase ?? record.scenario ?? record.when) ?? "下次使用 AI 时",
        prompt,
      },
    ];
  });
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeDimension(value: unknown): Dimension | undefined {
  const text = toText(value);
  if (!text) return undefined;
  const compact = text.replace(/\s+/g, "");
  return DIMENSION_ALIASES[text] ?? DIMENSION_ALIASES[compact] ?? DIMENSION_ALIASES[compact.toLowerCase()];
}

function collectRecordText(record: Record<string, unknown>, excludedKeys: string[]): string {
  const excluded = new Set(excludedKeys);
  return Object.entries(record)
    .flatMap(([key, value]) => {
      if (excluded.has(key)) return [];
      const text = toText(value);
      return text ? [text] : [];
    })
    .join("\n\n")
    .trim();
}

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = toText(item);
      return text ? [text] : [];
    });
  }
  const text = toText(value);
  return text ? text.split(/[、,，/|]/).map((item) => item.trim()).filter(Boolean) : [];
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const record = asRecord(value);
  if (!record) return undefined;
  return (
    toText(record.text) ??
    toText(record.content) ??
    toText(record.summary) ??
    toText(record.title) ??
    toText(record.detail) ??
    toText(record.analysis)
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
