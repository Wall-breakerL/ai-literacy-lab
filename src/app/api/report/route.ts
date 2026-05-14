import { NextRequest, NextResponse } from "next/server";
import { REPORT_SYSTEM } from "@/lib/reportAgent";
import { buildReportGenerationPrompt } from "@/lib/reportPrompt";
import { withLlmRetry } from "@/lib/llmRetry";
import {
  LLM_REPORT_MAX_TOKENS,
  LLM_REPORT_MODEL,
  assertLlmConfig,
  cacheLlmSystemPrompt,
  createLlmMessageWithTools,
  getUpstreamErrorMessage,
  type LlmTool,
  type LlmToolUse,
} from "@/lib/llm";
import { getPersonalityCode, getPersonalityProfile } from "@/lib/personalityProfiles";
import { getDisplayGoalLabel, getFallbackPromptTemplate, getReportTaskLabel } from "@/lib/reportDisplayContext";
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

const GENERATE_REPORT_TOOL: LlmTool = {
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
      selectedScenario: {
        type: "string",
        minLength: 4,
        description: "根据场景选择指导推断出的具体场景，用于问题诊断和Prompt模板。不要包含占位符或'根据...'等表述。",
      },
      styleProfile: {
        type: "object",
        additionalProperties: false,
        required: ["behaviors", "strengths", "weaknesses"],
        properties: {
          behaviors: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["behavior"],
              properties: {
                behavior: {
                  type: "string",
                  minLength: 28,
                  maxLength: 110,
                  description: "面向用户的一段协作风格描述，不要写'基于'、'证据'、分数字样或技术性标注。",
                },
              },
            },
          },
          strengths: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "string",
              minLength: 18,
              maxLength: 80,
            },
            description: "该用户协作风格的 2-3 条优点，每条一句话，直接描述正向行为价值。",
          },
          weaknesses: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "string",
              minLength: 18,
              maxLength: 80,
            },
            description: "该用户协作风格的 2-3 条风险或缺点，每条一句话，直接描述可能踩的坑。",
          },
        },
      },
      toolbox: {
        type: "object",
        additionalProperties: false,
        required: ["promptTemplates", "checklists", "workflow"],
        properties: {
          promptTemplates: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "useCase", "prompt", "tags"],
              properties: {
                title: {
                  type: "string",
                  maxLength: 12,
                  description: "模板标题，≤12字，有场景感，如'结构化探索'",
                },
                useCase: {
                  type: "string",
                  maxLength: 40,
                  description: "使用时机，≤40字",
                },
                prompt: {
                  type: "string",
                  minLength: 80,
                  maxLength: 250,
                  description: "Prompt内容，80-250字，第一人称，可直接复制使用，必须包含selectedScenario",
                },
                tags: {
                  type: "array",
                  minItems: 1,
                  maxItems: 3,
                  items: { type: "string" },
                  description: "标签，如['框架型', '适合探索阶段']",
                },
              },
            },
          },
          checklists: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "items"],
              properties: {
                title: {
                  type: "string",
                  description: "Checklist标题，如'使用AI前的Checklist'",
                },
                items: {
                  type: "array",
                  minItems: 4,
                  maxItems: 5,
                  items: { type: "string" },
                  description: "检查项，每项都要具体可执行",
                },
              },
            },
          },
          workflow: {
            type: "object",
            additionalProperties: false,
            required: ["title", "steps", "totalTime", "basedOn"],
            properties: {
              title: {
                type: "string",
                description: "工作流标题，如'适合你的AI协作流程'",
              },
              steps: {
                type: "array",
                minItems: 5,
                maxItems: 7,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["step", "action", "detail", "time"],
                  properties: {
                    step: {
                      type: "number",
                      description: "步骤编号",
                    },
                    action: {
                      type: "string",
                      maxLength: 20,
                      description: "动作，简短，如'明确目标和核心约束'",
                    },
                    detail: {
                      type: "string",
                      minLength: 20,
                      maxLength: 60,
                      description: "详细说明",
                    },
                    time: {
                      type: "string",
                      description: "预计时间，如'2分钟'",
                    },
                  },
                },
              },
              totalTime: {
                type: "string",
                description: "总时间，如'约25分钟'",
              },
              basedOn: {
                type: "string",
                description: "基于哪些倾向，如'框架型 + 审计型'",
              },
            },
          },
        },
      },
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
  const missing = assertLlmConfig();
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

    // 使用新的prompt生成函数
    const detailedPrompt = buildReportGenerationPrompt({
      targetContext: normalizedTargetContext,
      scenarioGuidance: sessionState?.scenarioGuidance,
      scoredDimensions,
      sessionState,
    });

    const prompt = `用户身份：${identity}

服务端已确定的人格画像（必须沿用）：
${JSON.stringify(personality, null, 2)}

问卷回答：
${answersText}

访谈记忆摘要：
${sessionStateText}

可引用的用户原话证据（优先用于 dimensions.analysis 和 evidence）：
${formatQuoteEvidenceForPrompt(sessionState)}

${detailedPrompt}

请根据以上信息生成AI-MBTI分析报告。
必须调用 generate_ai_mbti_report 工具返回结构化内容，不要输出 JSON 文本。
不要输出 personality / targetContext / avatarPrompt / colors。
collaborationSignature 只输出 detail；headline 会由服务端从 personality.signatureHeadline 固定注入。
dimensions 中只需要输出 dimension 与 analysis；分数、倾向、证据会由服务端合并。
问卷中的“反向题”已经由服务端计分逻辑翻转处理；你只需引用题目和用户选择作为证据，不要重新计算或解释原始分数。
每个 dimensions.analysis 必须具体解释判断依据：至少包含分数/有效回答数量/一条用户原话或题目证据，不能是空字符串。`;

    const reportRequestBase = {
      model: LLM_REPORT_MODEL,
      system: cacheLlmSystemPrompt(REPORT_SYSTEM),
      messages: [
        { role: "user" as const, content: prompt },
      ],
      tools: [GENERATE_REPORT_TOOL],
      temperature: 0.4,
      maxTokens: LLM_REPORT_MAX_TOKENS,
    };

    let toolResult: Awaited<ReturnType<typeof createLlmMessageWithTools>>;
    try {
      toolResult = await withLlmRetry(() =>
        createLlmMessageWithTools({
          ...reportRequestBase,
          toolChoice: { type: "tool", name: GENERATE_REPORT_TOOL.name },
        })
      );
    } catch (forcedToolError) {
      console.warn("[report] Forced report tool call failed; retrying with auto tool choice", {
        error: getUpstreamErrorMessage(forcedToolError) ?? String(forcedToolError),
      });
      try {
        toolResult = await withLlmRetry(() =>
          createLlmMessageWithTools({
            ...reportRequestBase,
            toolChoice: "auto",
          })
        );
      } catch (autoToolError) {
        console.error("[report] Report model call failed; using deterministic fallback", {
          forcedToolError: getUpstreamErrorMessage(forcedToolError) ?? String(forcedToolError),
          autoToolError: getUpstreamErrorMessage(autoToolError) ?? String(autoToolError),
        });
        return NextResponse.json(
          buildFallbackReport(personality, normalizedTargetContext, scoredDimensions)
        );
      }
    }

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

      const responseData = {
        selectedScenario: report.selectedScenario,
        styleProfile: report.styleProfile,
        problems: report.problems,
        toolbox: report.toolbox,
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
      };

      console.log("[report] Returning response with new fields:", {
        hasSelectedScenario: !!responseData.selectedScenario,
        hasStyleProfile: !!responseData.styleProfile,
        hasProblems: !!responseData.problems,
        hasToolbox: !!responseData.toolbox,
      });

      return NextResponse.json(responseData);
    } catch (parseError) {
      console.warn("[report] Failed to parse report model JSON; using fallback", {
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
      return NextResponse.json(
        buildFallbackReport(personality, normalizedTargetContext, scoredDimensions)
      );
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

function buildFallbackReport(
  personality: ReturnType<typeof getPersonalityProfile>,
  normalizedTargetContext: TargetContext,
  scoredDimensions: ReturnType<typeof scoreQuestionnaireAnswers>
): FinalReport {
  const portableArtifacts = completePortableArtifacts(
    {},
    personality,
    normalizedTargetContext,
    scoredDimensions
  );
  const goalLabel = getDisplayGoalLabel(normalizedTargetContext);
  const taskLabel = getReportTaskLabel(normalizedTargetContext);

  return {
    summary: `你的 AI 协作画像已经生成：整体更接近「${personality.name}」。这份结果基于问卷分数、访谈目标和用户原话证据计算。`,
    tags: scoredDimensions
      .slice()
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 3)
      .map((dimension) => dimension.tendencyLabel),
    targetContext: normalizedTargetContext,
    personality,
    styleProfile: buildFallbackStyleProfile(portableArtifacts.styleOverview.corePattern, scoredDimensions),
    styleOverview: portableArtifacts.styleOverview,
    collaborationManifesto: portableArtifacts.collaborationManifesto,
    collaborationSignature: portableArtifacts.collaborationSignature,
    overallAdvice: `下次处理「${goalLabel ?? taskLabel}」时，可以先保留你当前最稳定的协作方式，再刻意补一个小动作：在让 AI 执行前，先让它标出关键假设和不确定点。`,
    recommendations: [
      {
        title: "先让 AI 帮你澄清任务边界",
        detail: `下次处理「${taskLabel}」这类任务时，先让 AI 给出 2-3 个推进方向和各自风险，再选一个继续展开。`,
      },
      {
        title: "把结果拆成一小段一小段验证",
        detail: "不要等完整结果出来后再判断好坏，先验证方向、结构或关键事实，再继续推进。",
      },
    ],
    promptTemplates: [getFallbackPromptTemplate(normalizedTargetContext)],
    dimensions: scoredDimensions.map((dimension) => ({
      ...dimension,
      analysis: `该维度得分为 ${dimension.score}，当前更接近「${dimension.tendencyLabel}」。`,
      advice: "",
    })),
  };
}

function buildFallbackStyleProfile(
  corePattern: string,
  scoredDimensions: ReturnType<typeof scoreQuestionnaireAnswers>
) {
  const strongest = scoredDimensions
    .slice()
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, 3);
  const strengths = strongest.map((dimension) => fallbackStrengthForDimension(dimension.dimension, dimension.score));
  const weaknesses = strongest.map((dimension) => fallbackWeaknessForDimension(dimension.dimension, dimension.score));
  return {
    behaviors: [
      {
        behavior: corePattern || "你会根据当前任务不断调整 AI 的角色、边界和输出方式，让协作更贴近自己的真实工作场景。",
      },
    ],
    strengths: strengths.length >= 2 ? strengths : [
      "你能根据任务状态调整和 AI 的配合方式，不会只依赖单一用法。",
      "你已经形成了一套可复用的协作习惯，适合继续打磨成稳定流程。",
    ],
    weaknesses: weaknesses.length >= 2 ? weaknesses : [
      "如果任务目标变化较快，原有协作习惯可能会让你忽略新的约束。",
      "如果缺少中途检查，AI 输出可能看起来顺畅但偏离真实需求。",
    ],
  };
}

function fallbackStrengthForDimension(dimension: Dimension, score: number) {
  const high = score >= 50;
  const copy: Record<Dimension, { low: string; high: string }> = {
    Relation: {
      low: "你能把 AI 当作明确的执行工具，指令边界通常比较清楚。",
      high: "你愿意让 AI 参与讨论，容易从对话中获得新的角度。",
    },
    Workflow: {
      low: "你能在不确定时先探索可能性，适合处理开放型任务。",
      high: "你会先搭好结构和规则，复杂任务更容易被稳定推进。",
    },
    Epistemic: {
      low: "你采纳信息的速度较快，适合需要快速启动和快速试错的场景。",
      high: "你会主动检查 AI 输出，关键事实和逻辑更不容易被放过。",
    },
    RepairScope: {
      low: "你擅长小步修正，能保留已有产出并持续打磨。",
      high: "你愿意在方向不对时整体重开，能避免在错误结构上越改越远。",
    },
  };
  return high ? copy[dimension].high : copy[dimension].low;
}

function fallbackWeaknessForDimension(dimension: Dimension, score: number) {
  const high = score >= 50;
  const copy: Record<Dimension, { low: string; high: string }> = {
    Relation: {
      low: "如果只把 AI 当作执行器，可能会错过它帮助补充思路的价值。",
      high: "如果讨论过多，任务可能变成不断发散，迟迟不进入执行。",
    },
    Workflow: {
      low: "如果一直探索，方案容易变多但难以收束到一个可执行版本。",
      high: "如果框架定得太满，AI 的补充空间会被压缩，结果可能不够新。",
    },
    Epistemic: {
      low: "如果太快接受输出，隐藏错误可能到后期才暴露出来。",
      high: "如果检查成本过高，协作可能变成反复挑错而不是推进任务。",
    },
    RepairScope: {
      low: "如果只做局部修补，整体结构问题可能会被保留下来。",
      high: "如果频繁推倒重来，前面已经有效的工作容易被浪费。",
    },
  };
  return high ? copy[dimension].high : copy[dimension].low;
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
    if (quotes.length === 0) return dimension;
    const mergedEvidence = Array.from(
      new Set([
        ...dimension.evidence,
        ...quotes,
      ])
    ).slice(0, 3);
    return mergedEvidence.length > 0 ? { ...dimension, evidence: mergedEvidence } : dimension;
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

function generatedReportFromToolUses(toolUses: LlmToolUse[]): GeneratedReportDraft | null {
  const toolUse = toolUses.find((item) => item.name === GENERATE_REPORT_TOOL.name);
  if (!toolUse) return null;

  let input: unknown;
  if (typeof toolUse.input === "string") {
    console.log("[report] Tool input is string, parsing JSON (first 500 chars):", toolUse.input.slice(0, 500));
    try {
      input = parseJsonObjectFromModel<unknown>(toolUse.input);
      console.log("[report] Parsed successfully, checking new fields:", {
        hasSelectedScenario: !!(input as any).selectedScenario,
        hasStyleProfile: !!(input as any).styleProfile,
        hasProblems: !!(input as any).problems,
        hasToolbox: !!(input as any).toolbox,
      });
    } catch (parseError) {
      console.error("[report] Failed to parse tool input string:", parseError);
      return null;
    }
  } else {
    input = toolUse.input;
    console.log("[report] Tool input is object, checking new fields:", {
      hasSelectedScenario: !!(input as any).selectedScenario,
      hasStyleProfile: !!(input as any).styleProfile,
      hasProblems: !!(input as any).problems,
      hasToolbox: !!(input as any).toolbox,
    });
  }

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
  selectedScenario?: string;
  styleProfile?: {
    behaviors?: Array<{behavior: string; basedOn?: string; evidence?: string}>;
    strengths?: string[];
    weaknesses?: string[];
    comparison?: {
      scenario: string;
      styles: Array<{type: string; approach: string; pros: string; cons: string}>;
    };
    uniqueness?: {
      combination?: string;
      similarRoles: string[];
    };
  };
  problems?: Array<{
    title: string;
    symptom: string;
    why: string;
    howToFix: {
      immediate: string;
      example: string;
      expectedResult: string;
    };
    basedOn: string;
  }>;
  toolbox?: {
    promptTemplates?: PromptTemplate[];
    checklists?: Array<{title: string; items: string[]}>;
    workflow?: {
      title: string;
      steps: Array<{step: number; action: string; detail: string; time: string}>;
      totalTime: string;
      basedOn: string;
    };
  };
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
  const goalLabel = getDisplayGoalLabel(targetContext);
  const taskLabel = getReportTaskLabel(targetContext);

  return {
    overallAdvice:
      report.overallAdvice ??
      `下次处理「${goalLabel ?? taskLabel}」时，可以先让 AI 复述目标、列出关键假设和需要你确认的风险点，再开始生成结果。`,
    recommendations: report.recommendations?.length
      ? report.recommendations
      : [
          {
            title: "先让 AI 澄清任务边界",
            detail: `处理「${taskLabel}」这类任务时，先让 AI 给出 2-3 个推进方向和各自风险，再选一个继续展开。`,
          },
          {
            title: "把输出拆成可检查的小步",
            detail: "先确认方向、结构和关键事实，再继续生成完整结果，避免一次性产出后才发现偏差。",
          },
        ],
    promptTemplates: report.promptTemplates?.length
      ? report.promptTemplates
      : [getFallbackPromptTemplate(targetContext)],
  };
}

function normalizeGeneratedReportDraft(value: unknown): GeneratedReportDraft | null {
  const record = asRecord(value);
  if (!record) return null;
  const summary = toText(record.summary ?? record.overallSummary ?? record.overview ?? record.title);
  if (!summary) return null;
  return {
    selectedScenario: toText(record.selectedScenario),
    styleProfile: normalizeStyleProfile(record.styleProfile),
    problems: Array.isArray(record.problems)
      ? record.problems as GeneratedReportDraft["problems"]
      : undefined,
    toolbox: record.toolbox && typeof record.toolbox === "object"
      ? record.toolbox as GeneratedReportDraft["toolbox"]
      : undefined,
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

function normalizeStyleProfile(value: unknown): GeneratedReportDraft["styleProfile"] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const behaviors = Array.isArray(record.behaviors)
    ? record.behaviors
        .map((item) => {
          const behaviorRecord = asRecord(item);
          const behavior = toText(behaviorRecord?.behavior);
          if (!behavior) return null;
          return {
            behavior,
            basedOn: toText(behaviorRecord?.basedOn),
            evidence: toText(behaviorRecord?.evidence),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .slice(0, 4)
    : undefined;
  const uniqueness = asRecord(record.uniqueness);
  return {
    behaviors,
    strengths: normalizeTextList(record.strengths).slice(0, 3),
    weaknesses: normalizeTextList(record.weaknesses).slice(0, 3),
    uniqueness: uniqueness
      ? {
          combination: toText(uniqueness.combination),
          similarRoles: normalizeTextList(uniqueness.similarRoles).slice(0, 4),
        }
      : undefined,
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
