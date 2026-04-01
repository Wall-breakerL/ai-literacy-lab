import { z } from "zod";
import type { SceneRunState } from "@/domain/engine/session-state";
import type { ListingOption } from "@/domain/scenes/decision-context";
import type { SceneBlueprint } from "@/domain/scenes/types";
import { ScenePhaseSchema, type ScenePhase } from "@/domain/scenes/scene-phase";

export type { ScenePhase };
export { ScenePhaseSchema };

/** Shared static + runtime context injected into Agent A / Agent B every turn. */
export const SceneContextPacketSchema = z.object({
  sceneId: z.enum(["apartment-tradeoff", "brand-naming-sprint"]),
  title: z.string().min(1),
  taskGoal: z.string().min(1),
  hardConstraints: z.array(z.string()),
  softConstraints: z.array(z.string()),
  userContext: z.string(),
  roommateContext: z.string(),
  /** Serialized comparable options (apartment) or brief bullets (brand). */
  optionCatalogSummary: z.string(),
  mustVerifyItems: z.array(z.string()),
  deliverables: z.array(z.string().min(1)),
  /** Internal legacy stage id for analytics only; not a user gate. */
  internalStageId: z.string().min(1),
  phase: ScenePhaseSchema,
  workingSummary: z.string(),
  /** Hidden goal for Agent A this turn (natural language); null if none. */
  openProbeObjective: z.string().nullable(),
});
export type SceneContextPacket = z.infer<typeof SceneContextPacketSchema>;

function listingLine(opt: ListingOption): string {
  const dep = opt.depositPenalty === "unknown" ? "unknown（未提供）" : opt.depositPenalty;
  const cert = opt.certaintyStatus;
  const blk = opt.blockerStatus;
  return [
    `[${opt.id}] ${opt.name}`,
    `  租金: ${opt.rent} | 通勤: ${opt.commute} | 入住: ${opt.moveInDate}`,
    `  采光: ${opt.light} | 噪音: ${opt.noise}`,
    `  宠物: ${opt.petPolicy} | 合同风险: ${opt.contractRisk} | 室友匹配: ${opt.roommateFit}`,
    `  押金/违约金: ${dep}`,
    `  信息可靠度: ${cert} | 可行性: ${blk}`,
    `  已知问题: ${opt.knownIssues.join("；")}`,
    `  待核验: ${opt.unknownsToVerify.join("；")}`,
  ].join("\n");
}

/**
 * Build the static portion from blueprint; merge runtime fields from session run state.
 */
export function buildSceneContextPacket(scene: SceneBlueprint, run: SceneRunState): SceneContextPacket {
  const dc = scene.decisionContext;
  const hard: string[] = [];
  const soft: string[] = [];
  let userCtx = "";
  let roommateCtx = "";
  const mustVerify: string[] = [];
  let optionSummary = "";

  if (dc) {
    const hardSet = new Set<string>();
    for (const s of [...dc.globalHardConstraints, ...dc.knownInfo, ...scene.internalFacts]) {
      const t = s.trim();
      if (t) hardSet.add(t);
    }
    hard.push(...hardSet);
    soft.push(...dc.softPreferences);
    userCtx = dc.userContext;
    roommateCtx = dc.roommateContext;
    const seen = new Set<string>();
    for (const q of [...dc.mustVerifyQuestions, ...dc.verificationQueue]) {
      if (!seen.has(q)) {
        seen.add(q);
        mustVerify.push(q);
      }
    }
    optionSummary = dc.optionCatalog.map((o) => listingLine(o)).join("\n\n");
  } else {
    hard.push(...scene.internalFacts);
    optionSummary = scene.internalFacts.map((f) => `- ${f}`).join("\n");
  }

  if (hard.length === 0) hard.push(...scene.internalFacts);

  return SceneContextPacketSchema.parse({
    sceneId: scene.id,
    title: scene.titleZh,
    taskGoal: scene.briefingZh,
    hardConstraints: hard,
    softConstraints: soft,
    userContext: userCtx,
    roommateContext: roommateCtx,
    optionCatalogSummary: optionSummary,
    mustVerifyItems: mustVerify,
    deliverables: scene.deliverables,
    internalStageId: run.stageId,
    phase: run.scenePhase,
    workingSummary: run.workingSummaryZh,
    openProbeObjective: run.openProbeObjectiveZh,
  });
}

export function sceneContextPacketForPrompt(packet: SceneContextPacket): string {
  return [
    `场景ID: ${packet.sceneId}`,
    `标题: ${packet.title}`,
    `任务目标: ${packet.taskGoal}`,
    `硬约束:\n${packet.hardConstraints.map((s) => `- ${s}`).join("\n")}`,
    `软偏好:\n${packet.softConstraints.length ? packet.softConstraints.map((s) => `- ${s}`).join("\n") : "- （未单独列出）"}`,
    `用户情境: ${packet.userContext || "—"}`,
    `室友情境: ${packet.roommateContext || "—"}`,
    `交付物: ${packet.deliverables.join("；")}`,
    `必须核验项:\n${packet.mustVerifyItems.length ? packet.mustVerifyItems.map((s) => `- ${s}`).join("\n") : "- （无）"}`,
    `当前粗粒度阶段(内部): ${packet.phase}`,
    `内部阶段标记(兼容): ${packet.internalStageId}`,
    `工作摘要(截至上一轮): ${packet.workingSummary || "（尚无）"}`,
    `本回合隐藏协作目标(勿向用户提及标题; 可空): ${packet.openProbeObjective ?? "（无）"}`,
    "--- 可选方案/房源对比 ---",
    packet.optionCatalogSummary,
  ].join("\n\n");
}
