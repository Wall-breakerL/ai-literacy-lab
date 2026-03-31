import { z } from "zod";

export const ProbeIdSchema = z.enum([
  "tradeoff-constraint-check",
  "assumption-audit",
  "naming-divergence-check",
  "naming-convergence-check",
]);
export type ProbeId = z.infer<typeof ProbeIdSchema>;

export const ProbeBlueprintSchema = z.object({
  id: ProbeIdSchema,
  titleEn: z.string(),
  titleZh: z.string(),
  purposeZh: z.string(),
});
export type ProbeBlueprint = z.infer<typeof ProbeBlueprintSchema>;
