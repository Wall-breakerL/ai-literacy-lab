import { z } from "zod";

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
  knownIssues: z.array(z.string().min(1)).min(1),
  unknownsToVerify: z.array(z.string().min(1)).min(1),
});
export type ListingOption = z.infer<typeof ListingOptionSchema>;

/** Structured context for scenes that require comparing options with known vs to-verify facts. */
export const DecisionContextSchema = z.object({
  /** Shown at entry: global facts the user can rely on without asking. */
  knownInfo: z.array(z.string().min(1)).default([]),
  /** Questions or facts that need follow-up with landlord/agent before deciding. */
  verificationQueue: z.array(z.string().min(1)).default([]),
  /** Comparable options (e.g. four apartments). */
  optionCatalog: z.array(ListingOptionSchema).min(1),
});
export type DecisionContext = z.infer<typeof DecisionContextSchema>;
