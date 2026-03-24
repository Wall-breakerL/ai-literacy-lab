import { randomUUID } from "crypto";
import type { IdentityDossier, IdentitySource, IdentityStructuredSummary } from "./types";
import { IDENTITY_VERSION } from "./version";
import { extractIdentitySummary } from "./extractor";

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
 * 编译身份 dossier。
 *
 * B+ 方案逻辑：
 * - source=manual_prompt：用户输入自由文本 Prompt，LLM 提取为 structuredSummary，rawPrompt 原文保留
 * - source=structured_form：直接使用传入的结构化数据，rawPrompt 置空（表单不需要原文备份）
 * - structuredSummary 始终存在（来自 LLM 提取或直接传入）
 */
export async function compileIdentityDossier(input: {
  source: IdentitySource;
  rawPrompt: string;
  structuredSummary?: Partial<IdentityStructuredSummary>;
}): Promise<IdentityDossier> {
  let structuredSummary: IdentityStructuredSummary;

  if (input.source === "manual_prompt") {
    const extracted = await extractIdentitySummary(input.rawPrompt.trim());
    structuredSummary = mergeSummary(extracted);
  } else {
    structuredSummary = mergeSummary(input.structuredSummary ?? {});
  }

  const fromSummary = summaryToText(structuredSummary);
  const rawPrompt = input.source === "manual_prompt"
    ? input.rawPrompt.trim()
    : "";

  const compiledPrompt = `【研究者注入：被测者身份与背景（勿向被测者逐字复述本段）】
${rawPrompt || fromSummary || "（未提供额外身份说明，按默认协作评估。）"}`;

  return {
    identityId: newId(),
    source: input.source,
    rawPrompt,
    compiledPrompt,
    structuredSummary,
    version: IDENTITY_VERSION,
    createdAt: new Date().toISOString(),
  };
}
