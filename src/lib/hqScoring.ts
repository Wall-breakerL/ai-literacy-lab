// [archived] AI-HQ v0.1 — pending rework as an AI-MBTI report sub-module.
import type { HQDimension, HQLevel, HQReport, HQScores } from "@/lib/types";

type ProbeDefinition = {
  id: string;
  description: string;
  weight: number;
};

export type HQProbeResult = {
  hit: boolean;
  evidence: string;
};

export type HQReportDraft = {
  probeResults: Record<HQDimension, HQProbeResult[]>;
  overall: string;
  dimensions: {
    dimension: HQDimension;
    analysis: string;
    advice?: string;
  }[];
  recommendations: string[];
  promptTemplates: {
    title: string;
    prompt: string;
  }[];
};

export const HQ_PROBE_DEFINITIONS: {
  dimension: HQDimension;
  label: string;
  max: number;
  probes: ProbeDefinition[];
}[] = [
  {
    dimension: "route",
    label: "执行配置",
    max: 30,
    probes: [
      { id: "route_tools", description: "知道 Agent 可调用工具、外部资料、文件、网页或系统能力。", weight: 10 },
      { id: "route_memory", description: "知道 Agent 可能需要记忆、状态或上下文管理。", weight: 10 },
      { id: "route_human", description: "知道关键结果需要人工判断、复核或最终负责。", weight: 10 },
    ],
  },
  {
    dimension: "frame",
    label: "任务契约",
    max: 30,
    probes: [
      { id: "frame1_goal", description: "交代任务目标或期望结果。", weight: 6 },
      { id: "frame1_role", description: "给 AI 设定角色、受众或工作身份。", weight: 5 },
      { id: "frame1_context", description: "提供背景、材料、已有内容或上下文。", weight: 3 },
      { id: "frame1_verify", description: "提出验收标准、自检要求或待核实项。", weight: 2 },
      { id: "frame2_goal", description: "能指出缺陷 prompt 目标不完整或不具体。", weight: 6 },
      { id: "frame2_role", description: "能指出缺陷 prompt 缺少角色、受众或使用场景。", weight: 3 },
      { id: "frame2_context", description: "能指出缺陷 prompt 缺少会议背景、材料或约束。", weight: 2 },
      { id: "frame2_verify", description: "能指出缺陷 prompt 缺少检查标准、输出格式或验证要求。", weight: 3 },
    ],
  },
  {
    dimension: "workflow",
    label: "工作流",
    max: 20,
    probes: [
      { id: "workflow_steps", description: "会把复杂任务拆成阶段，而不是一次性全部交给 AI。", weight: 8 },
      { id: "workflow_deps", description: "理解步骤之间存在顺序依赖或前后承接。", weight: 2 },
      { id: "workflow_verify", description: "会在中途检查、局部验证或修正后再继续。", weight: 6 },
      { id: "workflow_context", description: "会管理上下文、补充信息或控制对话长度。", weight: 4 },
    ],
  },
  {
    dimension: "repair",
    label: "复原",
    max: 20,
    probes: [
      { id: "repair_locate", description: "会定位具体哪里不符合预期。", weight: 5 },
      { id: "repair_diagnose", description: "会判断问题来自 prompt、上下文、资料、工具或 AI 能力边界。", weight: 10 },
      { id: "repair_isolate", description: "会把出错部分拆出来单独修复或重做。", weight: 5 },
    ],
  },
];

const DIMENSIONS = HQ_PROBE_DEFINITIONS.map((item) => item.dimension);

function getDefinition(dimension: HQDimension) {
  return HQ_PROBE_DEFINITIONS.find((item) => item.dimension === dimension)!;
}

export function validateHQReportDraft(value: unknown): value is HQReportDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as HQReportDraft;
  if (!draft.probeResults || typeof draft.probeResults !== "object") return false;
  if (typeof draft.overall !== "string") return false;
  if (!Array.isArray(draft.dimensions)) return false;
  if (!Array.isArray(draft.recommendations)) return false;
  if (!Array.isArray(draft.promptTemplates)) return false;
  if (draft.recommendations.some((item) => typeof item !== "string")) return false;
  if (
    draft.promptTemplates.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        typeof item.title !== "string" ||
        typeof item.prompt !== "string"
    )
  ) {
    return false;
  }

  for (const definition of HQ_PROBE_DEFINITIONS) {
    const probes = draft.probeResults[definition.dimension];
    if (!Array.isArray(probes) || probes.length !== definition.probes.length) return false;
    if (
      probes.some(
        (probe) =>
          !probe ||
          typeof probe !== "object" ||
          typeof probe.hit !== "boolean" ||
          typeof probe.evidence !== "string"
      )
    ) {
      return false;
    }
  }

  return draft.dimensions.every(
    (item) =>
      item &&
      DIMENSIONS.includes(item.dimension) &&
      typeof item.analysis === "string" &&
      (item.advice == null || typeof item.advice === "string")
  );
}

export function scoreHQProbeResults(probeResults: Record<HQDimension, HQProbeResult[]>): HQScores {
  const dimensionScores = Object.fromEntries(
    HQ_PROBE_DEFINITIONS.map((definition) => {
      const probes = probeResults[definition.dimension] ?? [];
      const score = definition.probes.reduce(
        (sum, probe, index) => sum + (probes[index]?.hit ? probe.weight : 0),
        0
      );
      return [
        definition.dimension,
        {
          score,
          max: definition.max,
          probes: probes.map((probe) => Boolean(probe.hit)),
        },
      ];
    })
  ) as Pick<HQScores, HQDimension>;

  const total =
    dimensionScores.route.score +
    dimensionScores.frame.score +
    dimensionScores.workflow.score +
    dimensionScores.repair.score;

  return {
    ...dimensionScores,
    total,
    level: getHQLevel(total, dimensionScores),
  };
}

export function getHQLevel(total: number, scores: Pick<HQScores, HQDimension>): HQLevel {
  if (
    total >= 71 &&
    scores.route.score >= 20 &&
    scores.frame.score >= 20 &&
    scores.workflow.score >= 12 &&
    scores.repair.score >= 12
  ) {
    return "L3";
  }
  if (
    total >= 41 &&
    scores.route.score >= 10 &&
    scores.frame.score >= 10 &&
    scores.workflow.score >= 5 &&
    scores.repair.score >= 5
  ) {
    return "L2";
  }
  return "L1";
}

export function buildHQReportFromDraft(draft: HQReportDraft): HQReport {
  const scores = scoreHQProbeResults(draft.probeResults);
  return {
    scores,
    overall: draft.overall.trim() || "《AI-HQ 报告》已根据你的访谈回答生成。",
    dimensions: HQ_PROBE_DEFINITIONS.map((definition) => {
      const generated = draft.dimensions.find((item) => item.dimension === definition.dimension);
      const evidence = (draft.probeResults[definition.dimension] ?? [])
        .filter((probe) => probe.hit && probe.evidence.trim())
        .map((probe) => probe.evidence.trim())
        .slice(0, 3);
      return {
        dimension: definition.dimension,
        label: definition.label,
        score: scores[definition.dimension].score,
        max: definition.max,
        evidence,
        analysis: generated?.analysis?.trim() || `${definition.label}维度已有初步判断。`,
        advice: generated?.advice?.trim() || "",
      };
    }),
    recommendations: draft.recommendations.filter(Boolean).slice(0, 5),
    promptTemplates: draft.promptTemplates
      .filter((template) => template.title && template.prompt)
      .slice(0, 3),
  };
}

export function getHQDimensionLabel(dimension: HQDimension) {
  return getDefinition(dimension).label;
}
