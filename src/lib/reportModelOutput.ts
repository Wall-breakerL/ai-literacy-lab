import type {
  CollaborationSignature,
  Dimension,
  PromptTemplate,
  ReportProblem,
  ReportRecommendation,
  ReportStyleProfile,
  ReportStyleOverview,
} from "@/lib/types";

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

export type GeneratedReportDraft = {
  selectedScenario?: string;
  styleProfile?: ReportStyleProfile;
  problems?: ReportProblem[];
  summary?: string;
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

export function normalizeGeneratedReportDraft(
  value: unknown,
  options: { allowMissingSummary?: boolean } = {}
): GeneratedReportDraft | null {
  const record = asRecord(value);
  if (!record) return null;
  const summary = toText(record.summary ?? record.overallSummary ?? record.overview ?? record.title);
  if (!summary && !options.allowMissingSummary) return null;
  return {
    selectedScenario: toText(record.selectedScenario),
    styleProfile: normalizeStyleProfile(record.styleProfile),
    problems: Array.isArray(record.problems)
      ? record.problems as GeneratedReportDraft["problems"]
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

export function summarizeReportToolInputShape(input: Record<string, unknown>) {
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
