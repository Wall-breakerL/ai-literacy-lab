import type {
  CollaborationSignature,
  Dimension,
  DimensionReport,
  PersonalityProfile,
  ReportStyleOverview,
  TargetContext,
} from "@/lib/types";
import {
  getPersonalityNextAction,
  hasAwkwardReportContextText,
  normalizeReportTaskLabel,
} from "@/lib/reportDisplayContext";
import { getPersonalityWorkflow } from "@/lib/personalityProfiles";

export type PortableArtifactDraft = {
  styleOverview?: Partial<ReportStyleOverview>;
  collaborationManifesto?: string;
  collaborationSignature?: Partial<CollaborationSignature>;
};

export function completePortableArtifacts(
  draft: PortableArtifactDraft,
  personality: PersonalityProfile,
  targetContext: TargetContext,
  dimensions: DimensionReport[]
): {
  styleOverview: ReportStyleOverview;
  collaborationManifesto: string;
  collaborationSignature: CollaborationSignature;
} {
  const signatureDetail = normalizeSignatureDetailText(draft.collaborationSignature?.detail);
  const fallbackStyleOverview = buildStyleOverviewFallback(targetContext, dimensions, personality);
  return {
    styleOverview: isValidStyleOverview(draft.styleOverview)
      ? {
          corePattern: draft.styleOverview.corePattern!.trim(),
          strengthArea: hasAwkwardReportContextText(draft.styleOverview.strengthArea)
            ? fallbackStyleOverview.strengthArea
            : draft.styleOverview.strengthArea!.trim(),
          growthDirection: getPersonalityNextAction(personality.code),
        }
      : fallbackStyleOverview,
    collaborationManifesto: buildManifestoFallback(personality.code),
    collaborationSignature: {
      headline: personality.signatureHeadline,
      detail: isValidSignatureDetail(signatureDetail)
        ? signatureDetail.trim()
        : buildSignatureDetailFallback(dimensions),
    },
  };
}

function buildStyleOverviewFallback(
  targetContext: TargetContext,
  dimensions: DimensionReport[],
  personality: PersonalityProfile
): ReportStyleOverview {
  const sorted = sortBySignal(dimensions);
  const primary = sorted[0] ?? dimensions[0];
  const secondary = sorted[1] ?? dimensions[1] ?? primary;
  const taskLabel = normalizeReportTaskLabel(targetContext.recentUse);
  return {
    corePattern: `「${primary.tendencyLabel}×${secondary.tendencyLabel}」是你的底色：你不急着让 AI 接管全场，而是先把方向夹紧、再放它进场冲一段，节奏在你手里。`,
    strengthArea: `在${taskLabel}这类任务里，你最适合先把方向压成一句话，再让 AI 接着跑细节，省去反复返工。`,
    growthDirection: getPersonalityNextAction(personality.code),
  };
}

function buildManifestoFallback(personalityCode: string): string {
  return getPersonalityWorkflow(personalityCode);
}

function buildSignatureDetailFallback(dimensions: DimensionReport[]): string {
  const [primary, secondary] = sortBySignal(dimensions);
  const evidence = primary?.evidence?.[0] ? `，尤其是「${primary.evidence[0]}」这类回答` : "";
  return `从本次回答看，你最鲜明的是「${primary?.tendencyLabel ?? "稳定协作"}」倾向${evidence}。它说明你和 AI 的配合不是随机试探，而是在用一套熟悉节奏筛选、推进和修正结果。`;
}

function isValidStyleOverview(value: PortableArtifactDraft["styleOverview"]): value is ReportStyleOverview {
  if (!value) return false;
  const fields = [value.corePattern, value.strengthArea, value.growthDirection];
  if (!fields.every((field) => isUsefulText(field, 24, 130))) return false;
  if (fields.some((field) => hasForbiddenStyleClaim(field))) return false;
  return /试试|下次|可以|先让|让 AI|开始前|标注|列出|复述/.test(value.growthDirection ?? "");
}

function isValidManifesto(value: unknown, targetContext: TargetContext): value is string {
  if (!isUsefulText(value, 100, 220)) return false;
  const text = value.trim();
  if (/[［\[][^］\]]+[］\]]/.test(text)) return false;
  if (/我应该|我需要/.test(text)) return false;
  if (!text.includes("我") || !text.includes("请你")) return false;
  if (!includesContext(text, targetContext)) return false;
  return countPreferenceSignals(text) >= 2;
}

export function normalizeSignatureDetailText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return undefined;
    const parsed = parseJsonObjectString(clean);
    if (parsed) {
      return normalizeSignatureDetailText(
        parsed.detail ?? parsed.description ?? parsed.content ?? parsed.summary
      );
    }
    return clean;
  }
  const text = textFromUnknown(value);
  return text ? normalizeSignatureDetailText(text) : undefined;
}

function isValidSignatureDetail(value: unknown): value is string {
  if (!isUsefulText(value, 40, 110)) return false;
  const text = value.trim();
  if (!text.includes("从本次回答看")) return false;
  if (/[［\[][^］\]]+[］\]]/.test(text)) return false;
  if (/^\s*[{\[]/.test(text) || /["']?detail["']?\s*:/.test(text)) return false;
  return !/真实表现|实际表现|使用数据/.test(text);
}

function parseJsonObjectString(value: string): Record<string, unknown> | undefined {
  if (!/^\s*\{[\s\S]*\}\s*$/.test(value)) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return recordFromUnknown(parsed);
  } catch {
    return undefined;
  }
}

function textFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const record = recordFromUnknown(value);
  if (!record) return undefined;
  return (
    textFromUnknown(record.text) ??
    textFromUnknown(record.content) ??
    textFromUnknown(record.summary) ??
    textFromUnknown(record.title) ??
    textFromUnknown(record.detail) ??
    textFromUnknown(record.analysis)
  );
}

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function includesContext(text: string, targetContext: TargetContext): boolean {
  return (
    includesMeaningfulPart(text, targetContext.role) &&
    includesMeaningfulPart(text, targetContext.recentUse) &&
    includesMeaningfulPart(text, targetContext.goal)
  );
}

function includesMeaningfulPart(text: string, value: string): boolean {
  const clean = value.trim();
  if (!clean) return true;
  if (text.includes(clean)) return true;
  const meaningfulTokens = clean
    .split(/[，。；、\s,.;/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return meaningfulTokens.length === 0 || meaningfulTokens.some((token) => text.includes(token));
}

function hasForbiddenStyleClaim(value: unknown): boolean {
  const text = typeof value === "string" ? value : "";
  return /做对了什么|做得好|卡在哪里|容易卡|常犯|错误|真实表现|实际表现|使用数据/.test(text);
}

function isUsefulText(value: unknown, minLength: number, maxLength: number): value is string {
  if (typeof value !== "string") return false;
  const length = charLength(value);
  return length >= minLength && length <= maxLength;
}

function countPreferenceSignals(text: string): number {
  const keywords = ["框架", "探索", "审计", "核实", "信任", "采纳", "局部", "重组", "工具", "伙伴", "共创"];
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function preferenceText(dimension: DimensionReport | undefined): string {
  if (!dimension) return "我习惯先把目标说清楚，再让 AI 给出可执行的版本";
  const high = dimension.score >= 50;
  const preferences: Record<Dimension, { high: string; low: string }> = {
    Relation: {
      high: "我习惯把 AI 当作协作伙伴，先和它一起拆问题",
      low: "我习惯把 AI 当作执行工具，先给清晰指令和边界",
    },
    Workflow: {
      high: "我偏好先探索可能方案，再逐步收束到可执行路径",
      low: "我偏好先定框架和规则，再让 AI 按结构执行",
    },
    Epistemic: {
      high: "我倾向于先让 AI 给出判断，再结合语境取用",
      low: "我倾向于审计和核对输出，不确定处请主动标注",
    },
    RepairScope: {
      high: "我偏好局部修改和小步迭代，避免无谓重写",
      low: "我偏好在方向偏离时整体重组，重新描述需求",
    },
  };
  return high ? preferences[dimension.dimension].high : preferences[dimension.dimension].low;
}

function sortBySignal(dimensions: DimensionReport[]): DimensionReport[] {
  return dimensions
    .slice()
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
}

function charLength(value: string): number {
  return Array.from(value.trim()).filter((char) => !/\s/.test(char)).length;
}
