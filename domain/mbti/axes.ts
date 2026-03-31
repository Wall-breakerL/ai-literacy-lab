import { z } from "zod";

/** Canonical axis identifiers (AI-MBTI). */
export const MbtiAxisIdSchema = z.enum([
  "relation",
  "workflow",
  "epistemic",
  "repair",
]);
export type MbtiAxisId = z.infer<typeof MbtiAxisIdSchema>;

/** Pole letter on each axis (descriptive, not a discrete type). */
export const MbtiAxisLetterSchema = z.enum(["I", "C", "F", "E", "A", "T", "G", "L"]);
export type MbtiAxisLetter = z.infer<typeof MbtiAxisLetterSchema>;

export const MbtiAxisPoleSchema = z.object({
  letter: MbtiAxisLetterSchema,
  labelEn: z.string(),
  labelZh: z.string(),
});
export type MbtiAxisPole = z.infer<typeof MbtiAxisPoleSchema>;

export const MbtiAxisDefinitionSchema = z.object({
  id: MbtiAxisIdSchema,
  labelEn: z.string(),
  labelZh: z.string(),
  negativePole: MbtiAxisPoleSchema,
  positivePole: MbtiAxisPoleSchema,
});
export type MbtiAxisDefinition = z.infer<typeof MbtiAxisDefinitionSchema>;

/** Continuous value in [-1, 1] toward the positive pole (see axis definition). */
export const MbtiAxisValueSchema = z.number().min(-1).max(1);
export type MbtiAxisValue = z.infer<typeof MbtiAxisValueSchema>;

export const EvidenceRefSchema = z.object({
  id: z.string(),
  source: z.enum(["user_message", "agent_a", "probe", "system"]),
  excerpt: z.string(),
  eventId: z.string().optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const MbtiAxisStateSchema = z.object({
  axisId: MbtiAxisIdSchema,
  value: MbtiAxisValueSchema,
  evidence: z.array(EvidenceRefSchema),
});
export type MbtiAxisState = z.infer<typeof MbtiAxisStateSchema>;

export const MbtiProfileSchema = z.object({
  axes: z.array(MbtiAxisStateSchema).length(4),
});
export type MbtiProfile = z.infer<typeof MbtiProfileSchema>;

export const MBTI_AXIS_DEFINITIONS: readonly MbtiAxisDefinition[] = [
  {
    id: "relation",
    labelEn: "Relation",
    labelZh: "关系取向",
    negativePole: {
      letter: "I",
      labelEn: "Instrumental",
      labelZh: "工具型",
    },
    positivePole: {
      letter: "C",
      labelEn: "Collaborative",
      labelZh: "协作型",
    },
  },
  {
    id: "workflow",
    labelEn: "Workflow",
    labelZh: "工作流",
    negativePole: {
      letter: "F",
      labelEn: "Framed",
      labelZh: "框架型",
    },
    positivePole: {
      letter: "E",
      labelEn: "Exploratory",
      labelZh: "探索型",
    },
  },
  {
    id: "epistemic",
    labelEn: "Epistemic",
    labelZh: "认识论",
    negativePole: {
      letter: "A",
      labelEn: "Auditing",
      labelZh: "审校型",
    },
    positivePole: {
      letter: "T",
      labelEn: "Trusting",
      labelZh: "信任型",
    },
  },
  {
    id: "repair",
    labelEn: "Repair",
    labelZh: "修复策略",
    negativePole: {
      letter: "G",
      labelEn: "Global-Reframing",
      labelZh: "全局重构",
    },
    positivePole: {
      letter: "L",
      labelEn: "Local-Refinement",
      labelZh: "局部微调",
    },
  },
] as const;
