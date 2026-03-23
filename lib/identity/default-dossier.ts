import type { IdentityDossier, IdentityStructuredSummary } from "./types";
import { IDENTITY_VERSION } from "./version";

const EMPTY_SUMMARY: IdentityStructuredSummary = {
  roleContext: "",
  domain: "",
  goals: [],
  constraints: [],
  communicationStyle: "",
  aiFamiliarity: "",
  riskSensitivity: "",
};

/** 未配置 IdentityDossier 时的服务端默认（与旧 UserProfile 无关）。 */
export function createDefaultDossier(): IdentityDossier {
  const summary: IdentityStructuredSummary = {
    ...EMPTY_SUMMARY,
    roleContext: "通用协作场景",
    domain: "未单独配置",
    goals: ["完成当前对话中的协作任务"],
    constraints: [],
    communicationStyle: "自然、直接",
    aiFamiliarity: "未注明",
    riskSensitivity: "中等",
  };
  const rawPrompt = "未提供评估者自定义身份说明；按通用被测者处理。";
  return {
    identityId: "default",
    source: "default_profile",
    rawPrompt,
    compiledPrompt: `【研究者注入：被测者身份与背景（勿向被测者逐字复述）】\n${rawPrompt}`,
    structuredSummary: summary,
    version: IDENTITY_VERSION,
    createdAt: new Date().toISOString(),
  };
}
