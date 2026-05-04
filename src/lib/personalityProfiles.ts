import type { DimensionReport, PersonalityProfile } from "@/lib/types";
import { AVATAR_ARTWORK } from "@/lib/avatarArtwork";

const PROFILE_STYLE =
  "strongly reference official MBTI / 16Personalities result-avatar aesthetics and product language, original AI collaboration personality avatar, clean 2D vector cartoon, non-gendered mascot-like human figure, full-body or near full-body result-card composition, bright personality-test color grouping, simplified friendly face, iconic silhouette, no exact copy of any official MBTI or 16Personalities character";

const SIGNATURE_HEADLINES: Record<string, string> = {
  IFAG: "系统架构师：先谋全局，后动一子",
  IFAL: "建筑师：精心设计，严谨落地",
  IFTG: "完美主义者：追求极致，不留遗憾",
  IFTL: "实干家：定好章法，快速推进",
  IEAG: "发明家：不断试验，追求突破",
  IEAL: "作家：起稿粗放，打磨精细",
  IETG: "厨师：先尝后定，不行重炒",
  IETL: "画家：自由创作，涂涂画画",
  CFAG: "董事长：听它分析，我来拍板",
  CFAL: "执行官：思路同步，细节把关",
  CFTG: "指挥官：战略对齐，战术放权",
  CFTL: "合伙人：稳扎稳打，并肩前行",
  CEAG: "智者：共同推演，深谋远虑",
  CEAL: "外交官：理性协商，反复斟酌",
  CETG: "领航员：带领团队，探索未知",
  CETL: "研究搭档：一起探索，快速迭代",
};

export const PERSONALITY_PROFILES: Record<string, PersonalityProfile> = {
  IFAG: profile("IFAG", "系统架构师", "先谋全局，后动一子", "#55b3ff", "#101111", "#ffbc33"),
  IFAL: profile("IFAL", "建筑师", "图纸严密，落点克制", "#55b3ff", "#101111", "#5fc992"),
  IFTG: profile("IFTG", "完美主义者", "追求极致，不留遗憾", "#ff6363", "#101111", "#ffbc33"),
  IFTL: profile("IFTL", "实干家", "定好章法，快速推进", "#ff6363", "#101111", "#5fc992"),
  IEAG: profile("IEAG", "发明家", "不断试验，追求突破", "#55b3ff", "#1b1c1e", "#ffbc33"),
  IEAL: profile("IEAL", "作家", "起稿粗放，打磨精细", "#55b3ff", "#1b1c1e", "#5fc992"),
  IETG: profile("IETG", "厨师", "先尝后定，不行重炒", "#ff6363", "#1b1c1e", "#ffbc33"),
  IETL: profile("IETL", "画家", "自由创作，涂涂画画", "#ff6363", "#1b1c1e", "#5fc992"),
  CFAG: profile("CFAG", "董事长", "听它分析，我来拍板", "#55b3ff", "#252829", "#ffbc33"),
  CFAL: profile("CFAL", "执行官", "思路同步，细节把关", "#55b3ff", "#252829", "#5fc992"),
  CFTG: profile("CFTG", "指挥官", "战略对齐，战术放权", "#ff6363", "#252829", "#ffbc33"),
  CFTL: profile("CFTL", "合伙人", "稳扎稳打，并肩前行", "#ff6363", "#252829", "#5fc992"),
  CEAG: profile("CEAG", "智者", "共同推演，深谋远虑", "#55b3ff", "#07080a", "#ffbc33"),
  CEAL: profile("CEAL", "外交官", "理性协商，反复斟酌", "#55b3ff", "#07080a", "#5fc992"),
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

export interface PersonalityTraits {
  essence: string;
  traits: [string, string, string];
  goldenLine: string;
}

export const PERSONALITY_TRAITS: Record<string, PersonalityTraits> = {
  IFAG: {
    essence: "先谋全局，后动一子",
    traits: ["先画蓝图，再让 AI 上场", "不轻信结果，逐项核对", "改一处，必先看全局"],
    goldenLine: "你从不让 AI 替你思考方向，只让它帮你验证盲区",
  },
  IFAL: {
    essence: "图纸严密，落点克制",
    traits: ["规则先行，AI 才能开口", "输出必须经过你这关", "只动该动的那一砖"],
    goldenLine: "你不需要 AI 帮你想怎么做，你只需要它按你的规则做",
  },
  IFTG: {
    essence: "追求极致，不留遗憾",
    traits: ["先把目标说到无歧义", "信任输出，但要它配得上目标", "一处不达标，整体重做"],
    goldenLine: "达标就是达标，差一点就是不及格，没有「差不多」",
  },
  IFTL: {
    essence: "定好章法，快速推进",
    traits: ["先把流程钉死", "流程内说啥都行", "哪步崩了就修哪步"],
    goldenLine: "你不需要 AI 有创意，只需要它有执行力",
  },
  IEAG: {
    essence: "不断试验，追求突破",
    traits: ["先抛出几条可能性", "每条都要有证据撑住", "试得不对就整体推翻重来"],
    goldenLine: "推倒重来不是失败，是必经之路",
  },
  IEAL: {
    essence: "起稿粗放，打磨精细",
    traits: ["先让 AI 起一个大致的胚", "每段都亲自打磨", "不行就换那一段，不动整篇"],
    goldenLine: "只有你知道「对味」是什么感觉",
  },
  IETG: {
    essence: "先尝后定，不行重炒",
    traits: ["先让 AI 端几道试试", "对味就放手让它继续", "整体不对劲，宁可重起一锅"],
    goldenLine: "不对味就整锅倒掉重炒，「凑合」不是你的风格",
  },
  IETL: {
    essence: "自由创作，涂涂画画",
    traits: ["先让 AI 涂个底色", "喜欢哪笔就留下", "不喜欢就盖掉那一块"],
    goldenLine: "你只需要它给你底色和选择，剩下的你边画边调整",
  },
  CFAG: {
    essence: "听它分析，我来拍板",
    traits: ["把 AI 当顾问开会，先听分析", "听完会逐条质询", "决策一变，全局重排"],
    goldenLine: "它们可以充分发言，但房间里能拍板的只有你一个人",
  },
  CFAL: {
    essence: "思路同步，细节把关",
    traits: ["先和 AI 把思路对齐", "关键节点要 AI 给依据", "出错就微调那一段"],
    goldenLine: "你们分工协作，它推进，你确认",
  },
  CFTG: {
    essence: "战略对齐，战术放权",
    traits: ["先和 AI 一起定大方向", "之后大胆放权让它推进", "方向偏了立刻整体调头"],
    goldenLine: "战术可以灵活，战略不能偏",
  },
  CFTL: {
    essence: "稳扎稳打，并肩前行",
    traits: ["先把规则和分工说清楚", "规则内充分信任 AI", "出问题就修那一处，不掀桌子"],
    goldenLine: "AI 是你最稳的合伙人",
  },
  CEAG: {
    essence: "共同推演，深思熟虑",
    traits: ["先一起头脑风暴", "每条思路都要拷问可行性", "路子不通就重新布局"],
    goldenLine: "你们像两个智者，把每种可能都想透了再决定",
  },
  CEAL: {
    essence: "理性协商，反复斟酌",
    traits: ["先摊开几种思路", "一条条权衡利弊", "哪条不行就换哪条，不全弃"],
    goldenLine: "互相说服、互相质疑，直到找到合理方案",
  },
  CETG: {
    essence: "带领团队，探索未知",
    traits: ["先和 AI 商量目的地", "路上信它能找到捷径", "走错方向就掉头重来"],
    goldenLine: "你是领航员，AI 是副驾驶，方向盘在你手里",
  },
  CETL: {
    essence: "一起探索，快速迭代",
    traits: ["先和 AI 对一拍想法", "有戏就让它跑一段", "不顺就改这段，不重起"],
    goldenLine: "像两个人在白板前一起推公式",
  },
};

export function getPersonalityTraits(code: string): PersonalityTraits {
  return PERSONALITY_TRAITS[code] ?? PERSONALITY_TRAITS.CEAL;
}

export const PERSONALITY_WORKFLOWS: Record<string, string> = {
  IFAG: [
    "1. 先和 AI 对齐目标：让它复述要解决的问题，并列出输入、限制、交付物和成功标准。",
    "2. 把方案画成结构图：让 AI 列模块清单，标注每个模块依赖什么、风险在哪。",
    "3. 逐项核对依据：每个关键判断都要 AI 给出引用、推理或反例，不放过任何模糊处。",
    "4. 改动前先回看全局：任何调整都要 AI 说明会触发哪些上下游变化，再决定是否落地。",
  ].join("\n"),
  IFAL: [
    "1. 先和 AI 对齐目标：让它用一句话复述任务，确认输入格式和验收标准。",
    "2. 把规则写在前面：明确格式、命名、边界，让 AI 在框架内执行而不是自由发挥。",
    "3. 输出后逐段质检：重点段要 AI 给出依据或来源，模糊处必须标出。",
    "4. 修订只动该动的：定位到具体段落让 AI 重写，明令它不要顺手改其他地方。",
  ].join("\n"),
  IFTG: [
    "1. 先和 AI 对齐目标：让它复述目标，并把「什么算达标」明确成可验收的标准。",
    "2. 把交付标准放最前面：让 AI 按标准对齐输出结构，不要偏离主线。",
    "3. 信它给的版本，但只信对得上目标的那部分：达标的留下，不达标的清楚标注。",
    "4. 一处不达标就整体重启：让 AI 重做而不是打补丁，拒绝凑合式修补。",
  ].join("\n"),
  IFTL: [
    "1. 先和 AI 对齐目标：让它复述任务范围、交付物，并明确你和它各管什么。",
    "2. 把流程钉死：列出 3-5 步执行步骤，要求 AI 严格按顺序推进。",
    "3. 流程内大胆放权：每步完成后给确认，不要中间反复打断节奏。",
    "4. 哪步崩了修哪步：定位到最小出错段让 AI 重写那一段，其余步骤保留。",
  ].join("\n"),
  IEAG: [
    "1. 先和 AI 对齐目标：让它复述要解决的核心问题，先不急着收敛方向。",
    "2. 让 AI 抛 3-5 条不同思路：每条都要标出适用场景、成立前提和潜在风险。",
    "3. 每条思路都拷问依据：让 AI 说服你这条为什么可行，立不住就直接淘汰。",
    "4. 选不出最优就整体重抛：必要时让 AI 推翻所有假设，从新前提重新开题。",
  ].join("\n"),
  IEAL: [
    "1. 先和 AI 对齐目标：让它复述你想表达的核心，并圈出最关键的 1-2 段。",
    "2. 让 AI 起一个粗胚：长度可以差一截，先把结构骨架搭出来。",
    "3. 逐段精修，每改一处都要理由：让 AI 解释为什么这样改，不接受「读起来更好」。",
    "4. 不行就换那一段：定位到具体段落让 AI 重写，整体框架保持不动。",
  ].join("\n"),
  IETG: [
    "1. 先和 AI 对齐目标：让它复述任务，明确「成品给谁看、解决什么」。",
    "2. 让 AI 先端几道试试：风格 / 角度 / 结构都可以不同，每道附 30 字简介。",
    "3. 觉得对味就放手让它继续：不打断细节，等成品出来再整体判断。",
    "4. 整体不对劲就重起一锅：直接换前提重做，不要在错版本上修修补补。",
  ].join("\n"),
  IETL: [
    "1. 先和 AI 对齐目标：让它复述你想要的感觉或方向，可以模糊不必精准。",
    "2. 让 AI 先涂一层底色：第一版粗糙没关系，能看出大致样貌就行。",
    "3. 喜欢哪笔就留下：明确告诉 AI 哪些部分要保留，再继续在上面生长。",
    "4. 不喜欢就盖掉那一块：定位到具体片段让 AI 重画，其他位置留白。",
  ].join("\n"),
  CFAG: [
    "1. 先和 AI 对齐目标：把它当顾问开会，先听它分析问题、提出几个角度。",
    "2. 听完会逐条质询：每个建议都要 AI 给出依据、风险和可能的反例。",
    "3. 决策前先模拟下游影响：让 AI 推演每个选项的后续走向，挑出最稳的。",
    "4. 决策一变全局重排：方向调整后让 AI 重新组织所有依赖关系，不留遗漏。",
  ].join("\n"),
  CFAL: [
    "1. 先和 AI 对齐目标：先一起把任务拆清楚，确认理解和分工一致。",
    "2. 把流程对齐：让 AI 列出 3-5 步执行计划，逐步走，不要跳跃。",
    "3. 关键节点让 AI 给依据：重要判断处要数据、引用或推理支撑，不空说。",
    "4. 出错就微调那一段：精准定位问题处让 AI 重做，其余部分保留。",
  ].join("\n"),
  CFTG: [
    "1. 先和 AI 对齐目标：先一起把大方向定下来，明确要去哪、不要去哪。",
    "2. 框架定后大胆放权：让 AI 自主推进具体步骤，不要它每步都来确认。",
    "3. 定期回看方向：每完成一个阶段，让 AI 总结进度并对照目标自查。",
    "4. 方向偏了立刻整体调头：发现偏差就让 AI 重排剩下所有步骤，不要打补丁。",
  ].join("\n"),
  CFTL: [
    "1. 先和 AI 对齐目标：先一起把要做的事说清楚，约定好你和它各管什么。",
    "2. 规则内充分信任：明确分工后让 AI 在它的范围里自主推进。",
    "3. 重要节点同步：每完成一段就同步一次进展，确认双方在同一频道。",
    "4. 出问题就修那一处：定位最小出错点让 AI 重做，不要轻易全盘重启。",
  ].join("\n"),
  CEAG: [
    "1. 先和 AI 对齐目标：先和它一起把问题摊开，列出所有可能的切入点。",
    "2. 头脑风暴 3-5 条思路：每条都要 AI 解释逻辑链和潜在收益。",
    "3. 拷问每条的可行性：让 AI 找反例、列障碍、估算成本，不通过的去掉。",
    "4. 路子不通就重新布局：让 AI 抛弃当前框架，从新的前提重新规划全盘。",
  ].join("\n"),
  CEAL: [
    "1. 先和 AI 对齐目标：先一起把问题谈清楚，找出真正要解决的是什么。",
    "2. 摊开几种思路一起谈：让 AI 列选项，每个都说清优势、劣势、适用场景。",
    "3. 一条条权衡：让 AI 比较选项给出推荐，但不下结论，最后由你拍板。",
    "4. 哪条不行就换那一条：抛弃单一选项时不动其他思路，保留还能继续的部分。",
  ].join("\n"),
  CETG: [
    "1. 先和 AI 对齐目标：先和它商量去哪，画出大致路线就够了。",
    "2. 路上信它能找到捷径：让 AI 自主探索具体路径，遇到岔路再来对齐。",
    "3. 定期校准方向：每走一段让 AI 复盘走过的路，看是否在通往目的地。",
    "4. 走错方向就掉头：发现路不对就让 AI 重画后半段地图，不要硬着头皮往前。",
  ].join("\n"),
  CETL: [
    "1. 先和 AI 对齐目标：先一拍即合，把要研究的问题和成功的样子聊清楚。",
    "2. 边讨论边动手：抛个想法就让 AI 跑一段，结果回来再继续讨论。",
    "3. 有戏的就深挖：让 AI 在这个方向上扩展，多抛几种可能性出来。",
    "4. 不顺就改这段：哪段不行就改哪段，整体研究节奏不打断。",
  ].join("\n"),
};

export function getPersonalityWorkflow(code: string): string {
  return PERSONALITY_WORKFLOWS[code] ?? PERSONALITY_WORKFLOWS.CEAL;
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
