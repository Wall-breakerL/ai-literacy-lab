import type { DimensionReport, PersonalityProfile } from "@/lib/types";
import { AVATAR_ARTWORK } from "@/lib/avatarArtwork";

const PROFILE_STYLE =
  "strongly reference official MBTI / 16Personalities result-avatar aesthetics and product language, original AI collaboration personality avatar, clean 2D vector cartoon, non-gendered mascot-like human figure, full-body or near full-body result-card composition, bright personality-test color grouping, simplified friendly face, iconic silhouette, no exact copy of any official MBTI or 16Personalities character";

const SIGNATURE_HEADLINES: Record<string, string> = {
  IFAG: "精准指令官：先把靶心画清楚，再让 AI 开始射击",
  IFAL: "细节修补师：答案可以先出来，但边角一定要磨顺",
  IFTG: "高效交付官：目标一亮，AI 就该进入执行档",
  IFTL: "轻量执行者：先交付可用版本，再沿着细节往前推",
  IEAG: "探索审校员：可以先打开思路，但最后要经得起核对",
  IEAL: "实验修复师：先试出火花，再把可用部分慢慢修亮",
  IETG: "快速试验导演：方案不怕多，方向不对就果断重启",
  IETL: "敏捷迭代者：让 AI 快速开局，再用小步调整成形",
  CFAG: "协作蓝图师：先共识蓝图，再一起把结构校准",
  CFAL: "共创打磨师：一起搭出雏形，也一起把细节收好",
  CFTG: "结构共创者：把 AI 当伙伴，但方向盘一直在手里",
  CFTL: "稳态协作家：分工清楚，节奏稳定，结果自然变细",
  CEAG: "探索架构师：先把可能性展开，再用标准把它收束",
  CEAL: "共创实验家：灵感可以发散，成果要能落地",
  CETG: "发散策展人：让想法尽情展开，再挑出真正能用的",
  CETL: "灵感迭代师：先和 AI 捕捉灵感，再一点点推进成结果",
};

export const PERSONALITY_PROFILES: Record<string, PersonalityProfile> = {
  IFAG: profile("IFAG", "精准指令官", "先定边界，再用审计感保证结果可靠。", "#55b3ff", "#101111", "#ffbc33"),
  IFAL: profile("IFAL", "细节修补师", "喜欢清楚地下指令，也擅长把可用部分慢慢打磨好。", "#55b3ff", "#101111", "#5fc992"),
  IFTG: profile("IFTG", "高效交付官", "目标明确、节奏很快，适合把 AI 当作执行加速器。", "#ff6363", "#101111", "#ffbc33"),
  IFTL: profile("IFTL", "轻量执行者", "会给 AI 明确任务，也愿意在结果上小步调整。", "#ff6363", "#101111", "#5fc992"),
  IEAG: profile("IEAG", "探索审校员", "愿意让 AI 打开可能性，但会用自己的标准重新审查。", "#55b3ff", "#1b1c1e", "#ffbc33"),
  IEAL: profile("IEAL", "实验修复师", "先试出方向，再把有价值的部分修到可用。", "#55b3ff", "#1b1c1e", "#5fc992"),
  IETG: profile("IETG", "快速试验导演", "擅长快速试方案，也会在方向偏离时果断重启。", "#ff6363", "#1b1c1e", "#ffbc33"),
  IETL: profile("IETL", "敏捷迭代者", "用 AI 快速开局，再通过局部修改推进结果。", "#ff6363", "#1b1c1e", "#5fc992"),
  CFAG: profile("CFAG", "协作蓝图师", "重视共同讨论，但会先搭好结构并严格校准。", "#55b3ff", "#252829", "#ffbc33"),
  CFAL: profile("CFAL", "共创打磨师", "既愿意和 AI 共创，也善于在既有框架里细修。", "#55b3ff", "#252829", "#5fc992"),
  CFTG: profile("CFTG", "结构共创者", "会把 AI 当伙伴，同时保留清晰框架和重启判断。", "#ff6363", "#252829", "#ffbc33"),
  CFTL: profile("CFTL", "稳态协作家", "适合稳定协作、分工清楚、持续小步优化。", "#ff6363", "#252829", "#5fc992"),
  CEAG: profile("CEAG", "探索架构师", "喜欢和 AI 一起打开问题，再用审计感收束结果。", "#55b3ff", "#07080a", "#ffbc33"),
  CEAL: profile("CEAL", "共创实验家", "能把 AI 当作思考伙伴，也能保留可用部分持续迭代。", "#55b3ff", "#07080a", "#5fc992"),
  CETG: profile("CETG", "发散策展人", "擅长让 AI 展开多种可能，再果断重组方向。", "#ff6363", "#07080a", "#ffbc33"),
  CETL: profile("CETL", "灵感迭代师", "和 AI 一起探索，再用轻量调整把灵感推进成结果。", "#ff6363", "#07080a", "#5fc992"),
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
