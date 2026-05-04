import type { DimensionReport, PersonalityProfile } from "@/lib/types";
import { AVATAR_ARTWORK } from "@/lib/avatarArtwork";

const PROFILE_STYLE =
  "strongly reference official MBTI / 16Personalities result-avatar aesthetics and product language, original AI collaboration personality avatar, clean 2D vector cartoon, non-gendered mascot-like human figure, full-body or near full-body result-card composition, bright personality-test color grouping, simplified friendly face, iconic silhouette, no exact copy of any official MBTI or 16Personalities character";

const SIGNATURE_HEADLINES: Record<string, string> = {
  IFAG: "系统架构师：全局规划，滴水不漏",
  IFAL: "建筑师：精心设计，严谨落地",
  IFTG: "完美主义者：追求极致，不留遗憾",
  IFTL: "实干家：定好规则，高效执行",
  IEAG: "发明家：不断试验，追求突破",
  IEAL: "作家：边写边改，字斟句酌",
  IETG: "厨师：即兴发挥，成就佳作",
  IETL: "画家：自由创作，涂涂画画",
  CFAG: "董事长：掌控全局，追求卓越",
  CFAL: "执行官：思路清晰，执行到位",
  CFTG: "指挥官：统筹全局，果断决策",
  CFTL: "合伙人：稳扎稳打，并肩前行",
  CEAG: "战略家：共谋大局，深谋远虑",
  CEAL: "外交官：理性协商，探讨策略",
  CETG: "领航员：带领团队，探索未知",
  CETL: "研究搭档：一起探索，快速迭代",
};

export const PERSONALITY_PROFILES: Record<string, PersonalityProfile> = {
  IFAG: profile("IFAG", "系统架构师", "全局规划，滴水不漏", "#55b3ff", "#101111", "#ffbc33"),
  IFAL: profile("IFAL", "建筑师", "精心设计，严谨落地", "#55b3ff", "#101111", "#5fc992"),
  IFTG: profile("IFTG", "完美主义者", "追求极致，不留遗憾", "#ff6363", "#101111", "#ffbc33"),
  IFTL: profile("IFTL", "实干家", "定好规则，高效执行", "#ff6363", "#101111", "#5fc992"),
  IEAG: profile("IEAG", "发明家", "不断试验，追求突破", "#55b3ff", "#1b1c1e", "#ffbc33"),
  IEAL: profile("IEAL", "作家", "边写边改，字斟句酌", "#55b3ff", "#1b1c1e", "#5fc992"),
  IETG: profile("IETG", "厨师", "即兴发挥，成就佳作", "#ff6363", "#1b1c1e", "#ffbc33"),
  IETL: profile("IETL", "画家", "自由创作，涂涂画画", "#ff6363", "#1b1c1e", "#5fc992"),
  CFAG: profile("CFAG", "董事长", "掌控全局，追求卓越", "#55b3ff", "#252829", "#ffbc33"),
  CFAL: profile("CFAL", "执行官", "思路清晰，执行到位", "#55b3ff", "#252829", "#5fc992"),
  CFTG: profile("CFTG", "指挥官", "统筹全局，果断决策", "#ff6363", "#252829", "#ffbc33"),
  CFTL: profile("CFTL", "合伙人", "稳扎稳打，并肩前行", "#ff6363", "#252829", "#5fc992"),
  CEAG: profile("CEAG", "战略家", "共谋大局，深谋远虑", "#55b3ff", "#07080a", "#ffbc33"),
  CEAL: profile("CEAL", "外交官", "理性协商，探讨策略", "#55b3ff", "#07080a", "#5fc992"),
  CETG: profile("CETG", "领航员", "带领团队，探索未知", "#ff6363", "#07080a", "#ffbc33"),
  CETL: profile("CETL", "研究搭档", "一起探索，快速迭代", "#ff6363", "#07080a", "#5fc992"),
};

function profile(
  code: string,
  name: string,
  tagline: string,
  primary: string,
  secondary: string,
  accent: string
): PersonalityProfile {
  const artwork = AVATAR_ARTWORK[code];
  return {
    code,
    name,
    tagline,
    signatureHeadline: SIGNATURE_HEADLINES[code] ?? `${name}：把 AI 协作变成自己的节奏`,
    avatarPrompt: `${PROFILE_STYLE}; character represents ${name}; AI collaboration archetype code ${code}; palette ${primary}, ${secondary}, ${accent}; symbolic prop: ${artwork.prop}; background motif: ${artwork.motif}; same crop, line weight, lighting, and rounded card framing as the whole 16-avatar family; simple friendly gender-neutral face; avoid gender-coded clothing, facial hair, makeup, or body shape; strongly MBTI-style in layout and polish, original in character identity`,
    colors: { primary, secondary, accent },
  };
}

export function getPersonalityCode(dimensions: DimensionReport[]): string {
  const byDimension = new Map(dimensions.map((dimension) => [dimension.dimension, dimension]));
  return [
    (byDimension.get("Relation")?.score ?? 50) >= 50 ? "C" : "I",
    (byDimension.get("Workflow")?.score ?? 50) >= 50 ? "E" : "F",
    (byDimension.get("Epistemic")?.score ?? 50) >= 50 ? "T" : "A",
    (byDimension.get("RepairScope")?.score ?? 50) >= 50 ? "L" : "G",
  ].join("");
}

export function getPersonalityProfile(code: string): PersonalityProfile {
  return PERSONALITY_PROFILES[code] ?? PERSONALITY_PROFILES.CEAL;
}
