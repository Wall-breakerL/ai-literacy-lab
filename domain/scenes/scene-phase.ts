import { z } from "zod";

/** Coarse interaction phase (internal; not user-facing gates). */
export const ScenePhaseSchema = z.enum(["orient", "work", "wrap"]);
export type ScenePhase = z.infer<typeof ScenePhaseSchema>;
