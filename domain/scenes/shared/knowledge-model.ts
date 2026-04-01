import { z } from "zod";

/** Shared knowledge partition used by Agent A response composer. */
export const KnowledgeLayerSchema = z.object({
  sharedFacts: z.array(z.string().min(1)).default([]),
  openUnknowns: z.array(z.string().min(1)).default([]),
});
export type KnowledgeLayer = z.infer<typeof KnowledgeLayerSchema>;

