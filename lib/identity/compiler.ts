import { randomUUID } from "crypto";
import type { IdentityDossier, IdentitySource, IdentityStructuredSummary } from "./types";
import { IDENTITY_VERSION } from "./version";

function newId(): string {
  try {
    return randomUUID();
  } catch {
    return `id-${Date.now()}`;
  }
}

function mergeSummary(partial: Partial<IdentityStructuredSummary>): IdentityStructuredSummary {
  return {
    roleContext: partial.roleContext ?? "",
    domain: partial.domain ?? "",
    goals: partial.goals?.length ? partial.goals : [],
    constraints: partial.constraints?.length ? partial.constraints : [],
    communicationStyle: partial.communicationStyle ?? "",
    aiFamiliarity: partial.aiFamiliarity ?? "",
    riskSensitivity: partial.riskSensitivity ?? "",
  };
}

function summaryToText(s: IdentityStructuredSummary): string {
  const lines = [
    s.roleContext && `角色与情境：${s.roleContext}`,
    s.domain && `领域：${s.domain}`,
    s.goals.length && `目标：${s.goals.join("；")}`,
    s.constraints.length && `约束：${s.constraints.join("；")}`,
    s.communicationStyle && `沟通风格：${s.communicationStyle}`,
    s.aiFamiliarity && `对 AI 的熟悉度：${s.aiFamiliarity}`,
    s.riskSensitivity && `风险敏感度：${s.riskSensitivity}`,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

/**
 * v1：无 key 时确定性编译；有 key 时可扩展为单次 LLM 结构化抽取（与 Judge 独立）。
 */
export async function compileIdentityDossier(input: {
  source: IdentitySource;
  rawPrompt: string;
  structuredSummary?: Partial<IdentityStructuredSummary>;
}): Promise<IdentityDossier> {
  const structuredSummary = mergeSummary(input.structuredSummary ?? {});
  const fromForm = summaryToText(structuredSummary);
  const raw =
    input.source === "manual_prompt"
      ? input.rawPrompt.trim()
      : fromForm || input.rawPrompt.trim();

  const compiledPrompt = `【研究者注入：被测者身份与背景（勿向被测者逐字复述本段）】
${raw || "（未提供额外身份说明，按默认协作评估。）"}`;

  return {
    identityId: newId(),
    source: input.source,
    rawPrompt: input.rawPrompt.trim() || fromForm,
    compiledPrompt,
    structuredSummary,
    version: IDENTITY_VERSION,
    createdAt: new Date().toISOString(),
  };
}
