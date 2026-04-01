import { z } from "zod";

export const CertaintyStatusSchema = z.enum(["confirmed", "broker_claim", "mixed", "unknown"]);
export type CertaintyStatus = z.infer<typeof CertaintyStatusSchema>;

export const BlockerStatusSchema = z.enum(["pass", "risky", "blocked", "unknown"]);
export type BlockerStatus = z.infer<typeof BlockerStatusSchema>;

/** Single listing option in a trade-off scene (e.g. apartment A/B/C/D). */
export const ListingOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rent: z.string().min(1),
  commute: z.string().min(1),
  light: z.string().min(1),
  noise: z.string().min(1),
  petPolicy: z.string().min(1),
  contractRisk: z.string().min(1),
  moveInDate: z.string().min(1),
  roommateFit: z.string().min(1),
  /** Deposit / penalty; use "unknown" when not provided. */
  depositPenalty: z.union([z.string().min(1), z.literal("unknown")]).default("unknown"),
  knownIssues: z.array(z.string().min(1)).min(1),
  unknownsToVerify: z.array(z.string().min(1)).min(1),
  certaintyStatus: CertaintyStatusSchema.default("mixed"),
  blockerStatus: BlockerStatusSchema.default("unknown"),
});
export type ListingOption = z.infer<typeof ListingOptionSchema>;

/** Structured context for scenes that require comparing options with known vs to-verify facts. */
export const DecisionContextSchema = z.object({
  globalHardConstraints: z.array(z.string().min(1)).default([]),
  softPreferences: z.array(z.string().min(1)).default([]),
  userContext: z.string().default(""),
  roommateContext: z.string().default(""),
  mustVerifyQuestions: z.array(z.string().min(1)).default([]),
  /** Legacy: global facts shown at entry. */
  knownInfo: z.array(z.string().min(1)).default([]),
  /** Legacy alias for must-verify list. */
  verificationQueue: z.array(z.string().min(1)).default([]),
  optionCatalog: z.array(ListingOptionSchema).min(1),
});
export type DecisionContext = z.infer<typeof DecisionContextSchema>;
