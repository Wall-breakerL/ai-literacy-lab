"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { PersonalityAvatar } from "@/components/PersonalityAvatar";
import { getPersonalityTraits } from "@/lib/personalityProfiles";
import { getFallbackPromptTemplate } from "@/lib/reportDisplayContext";
import type { Dimension, DimensionReport, FinalReport, PersonalityProfile, PromptTemplate } from "@/lib/types";

type ReportPageModel = FinalReport & {
  styleOverview?: {
    corePattern?: string;
    fitScenario?: string;
    strengthArea?: string;
    growthDirection?: string;
  };
  collaborationManifesto?: string;
  collaborationSignature?: {
    headline?: string;
    detail?: string;
  };
};

export type ReportInsight = {
  label: string;
  value: string;
};

type ReportStoryExperienceProps = {
  report: ReportPageModel;
  insights: ReportInsight[];
  manifestoText: string;
  signature?: { headline: string; detail: string } | null;
  fullReport: ReactNode;
};

type DimensionMeta = {
  lowLabel: string;
  highLabel: string;
  lowLetter: string;
  highLetter: string;
  lowColor: string;
  highColor: string;
};

const DIMENSION_META: Record<Dimension, DimensionMeta> = {
  Relation: {
    lowLabel: "工具型",
    highLabel: "伙伴型",
    lowLetter: "I",
    highLetter: "C",
    lowColor: "#2563eb",
    highColor: "#f97316",
  },
  Workflow: {
    lowLabel: "探索型",
    highLabel: "框架型",
    lowLetter: "E",
    highLetter: "F",
    lowColor: "#4f46e5",
    highColor: "#14b8a6",
  },
  Epistemic: {
    lowLabel: "信任型",
    highLabel: "审计型",
    lowLetter: "T",
    highLetter: "A",
    lowColor: "#64748b",
    highColor: "#fbbf24",
  },
  RepairScope: {
    lowLabel: "局部型",
    highLabel: "全局型",
    lowLetter: "L",
    highLetter: "G",
    lowColor: "#8b5cf6",
    highColor: "#10b981",
  },
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function displayScore(dimension: DimensionReport) {
  return clampScore(dimension.scorePercent ?? dimension.score);
}

function strongestDimension(dimensions: DimensionReport[]) {
  return dimensions.reduce((prev, cur) =>
    Math.abs(displayScore(cur) - 50) > Math.abs(displayScore(prev) - 50) ? cur : prev
  );
}

function tendencyTag(dimension: DimensionReport) {
  const meta = DIMENSION_META[dimension.dimension];
  const highSide = displayScore(dimension) >= 50;
  return {
    label: highSide ? meta.highLabel : meta.lowLabel,
    color: highSide ? meta.highColor : meta.lowColor,
  };
}

function visibleTags(report: ReportPageModel) {
  const dimensionTags = report.dimensions
    .filter((dimension) => displayScore(dimension) >= 60 || displayScore(dimension) <= 40)
    .map(tendencyTag);

  if (dimensionTags.length) return dimensionTags;
  return report.tags.slice(0, 4).map((tag) => ({ label: tag, color: "#55b3ff" }));
}

function compactText(text?: string, maxLength = 92) {
  const clean = (text ?? "").replace(/[#*_`>\[\]()]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function getPromptTemplate(report: ReportPageModel): PromptTemplate {
  return report.promptTemplates?.[0] ?? getFallbackPromptTemplate(report.targetContext);
}

function getSpectrumAccent(dimension: DimensionReport) {
  const meta = DIMENSION_META[dimension.dimension];
  return displayScore(dimension) >= 50 ? meta.highColor : meta.lowColor;
}

function SpectrumBar({
  dimension,
  showScore = false,
  compact = false,
  index = 0,
}: {
  dimension: DimensionReport;
  showScore?: boolean;
  compact?: boolean;
  index?: number;
}) {
  const meta = DIMENSION_META[dimension.dimension];
  const score = displayScore(dimension);
  const accent = getSpectrumAccent(dimension);
  const isExtreme = Math.abs(score - 50) >= 25;
  const tendency = score >= 50 ? meta.highLabel : meta.lowLabel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35 }}
      className={compact ? "space-y-1.5" : "space-y-2.5"}
    >
      {!compact ? (
        <p className="text-[12px] font-semibold text-slate-400">
          {dimension.dimension} · {dimension.label}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="flex w-16 shrink-0 flex-col items-start">
          <span className="text-[11px] font-semibold" style={{ color: meta.lowColor }}>
            {meta.lowLetter} {meta.lowLabel}
          </span>
          {showScore ? (
            <span className="text-[10px] font-medium text-slate-400">{100 - score}%</span>
          ) : null}
        </div>
        <div className="relative h-5 min-w-0 flex-1">
          <div
            className={compact ? "absolute left-0 right-0 top-2 h-1 rounded-full" : "absolute left-0 right-0 top-[7px] h-2 rounded"}
            style={{ background: `linear-gradient(90deg, ${meta.lowColor}, ${meta.highColor})` }}
          />
          <span
            className={compact ? "absolute left-0 top-[5px] h-2 w-2 rounded-full" : "absolute left-0 top-1 h-2.5 w-2.5 rounded-full"}
            style={{ backgroundColor: meta.lowColor }}
          />
          <span
            className={compact ? "absolute right-0 top-[5px] h-2 w-2 rounded-full" : "absolute right-0 top-1 h-2.5 w-2.5 rounded-full"}
            style={{ backgroundColor: meta.highColor }}
          />
          <motion.span
            className={`absolute top-0 rounded-[3px] border-2 border-white ${isExtreme ? "animate-pulse" : ""}`}
            initial={{ left: "50%" }}
            animate={{ left: `${score}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            title={`你在 ${tendency} 这一端（分数 ${score}）`}
            style={{
              width: compact ? 12 : isExtreme ? 20 : 16,
              height: compact ? 12 : isExtreme ? 20 : 16,
              marginLeft: compact ? -6 : isExtreme ? -10 : -8,
              transform: "rotate(45deg)",
              backgroundColor: accent,
              boxShadow: `0 0 16px ${accent}80`,
            }}
          />
        </div>
        <div className="flex w-16 shrink-0 flex-col items-end">
          <span className="text-right text-[11px] font-semibold" style={{ color: meta.highColor }}>
            {meta.highLabel} {meta.highLetter}
          </span>
          {showScore ? (
            <span className="text-[10px] font-medium text-slate-400">{score}%</span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function TagBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full border px-3 py-1 text-[12px] font-semibold"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}24`, color }}
    >
      {label}
    </span>
  );
}

function SlideShell({
  children,
  primary = "#55b3ff",
  secondary = "#0f172a",
}: {
  children: ReactNode;
  primary?: string;
  secondary?: string;
}) {
  return (
    <motion.div
      initial={{ x: 36, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -36, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="min-h-[560px] rounded-[8px] p-6 sm:p-8"
      style={{
        backgroundColor: secondary,
        border: `1px solid ${primary}28`,
        color: "#f1f5f9",
        boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px ${primary}18`,
      }}
    >
      {children}
    </motion.div>
  );
}

function PersonaSlide({ profile }: { profile?: PersonalityProfile }) {
  const code = profile?.code ?? "CEAL";
  const name = profile?.name ?? "你的 AI 协作画像";
  const accent = profile?.colors?.accent ?? "#f97316";
  const primary = profile?.colors?.primary ?? "#55b3ff";
  const traits = getPersonalityTraits(code);

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 select-none text-[180px] font-black leading-none tracking-[-0.04em] sm:text-[220px]"
        style={{
          color: primary,
          opacity: 0.07,
          fontFamily: "'Bebas Neue', 'Impact', system-ui, sans-serif",
        }}
      >
        {code}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-8 h-44 w-44 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }}
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-slate-400">PERSONA</p>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.18em]"
            style={{ color: primary, backgroundColor: `${primary}14`, border: `1px solid ${primary}33` }}
          >
            {code}
          </span>
        </div>

        <div className="mt-5">
          <h2 className="text-[26px] font-semibold text-white">{name}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-300">{traits.essence}</p>
        </div>

        <div
          className="mt-7 h-px w-full"
          style={{ background: `linear-gradient(90deg, ${primary}55, transparent)` }}
        />

        <div className="mt-7 grid gap-3">
          {traits.traits.map((trait, index) => (
            <motion.div
              key={trait}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.3 }}
              className="flex items-start gap-3 rounded-[10px] p-3.5"
              style={{ borderLeft: `3px solid ${accent}`, border: `1px solid rgba(255,255,255,0.07)`, borderLeftWidth: 3, borderLeftColor: accent, backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
              >
                {index + 1}
              </span>
              <p className="text-[14px] leading-[1.55] text-slate-200">{trait}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 rounded-[10px] p-5" style={{ background: `linear-gradient(135deg, ${primary}10, ${accent}10)` }}>
          <p className="text-[12px] font-semibold tracking-[0.18em] text-slate-400">GOLDEN LINE</p>
          <p
            className="mt-2 text-[16px] font-medium leading-[1.55] text-white"
            style={{ fontFamily: "'Songti SC', 'Noto Serif SC', 'Source Han Serif', serif" }}
          >
            <span className="mr-1 text-[24px] align-[-2px]" style={{ color: accent }}>&ldquo;</span>
            {traits.goldenLine}
            <span className="ml-1 text-[24px] align-[-2px]" style={{ color: accent }}>&rdquo;</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReportStoryExperience({
  report,
  insights,
  manifestoText,
  signature,
  fullReport,
}: ReportStoryExperienceProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [showPoster, setShowPoster] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  const strongest = useMemo(() => strongestDimension(report.dimensions), [report.dimensions]);
  const strongestMeta = DIMENSION_META[strongest.dimension];
  const strongestAccent = getSpectrumAccent(strongest);
  const tags = useMemo(() => visibleTags(report), [report]);
  const promptTemplate = useMemo(() => getPromptTemplate(report), [report]);
  const corePattern = insights[0]?.value ?? compactText(report.summary, 120);
  const fitScenario = insights[1]?.value ?? report.targetContext?.recentUse ?? "复杂任务推进";
  const nextAction = insights[2]?.value ?? "下次先让 AI 复述目标，再列出关键假设。";

  // 人格主题色
  const pPrimary = report.personality?.colors?.primary ?? "#55b3ff";
  const pSecondary = report.personality?.colors?.secondary ?? "#0f172a";
  const pAccent = report.personality?.colors?.accent ?? "#ffbc33";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showPoster) return;
      if (event.key === "ArrowLeft") setSlideIndex((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") {
        setSlideIndex((value) => {
          if (value >= 4) {
            setShowPoster(true);
            return value;
          }
          return value + 1;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPoster]);

  const goNext = () => {
    if (slideIndex >= 4) {
      setShowPoster(true);
      return;
    }
    setSlideIndex((value) => value + 1);
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(promptTemplate.prompt);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1500);
  };

  const handlePointerUp = (x: number) => {
    if (touchStartX.current == null || showPoster) return;
    const delta = x - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goNext();
    if (delta > 0) setSlideIndex((value) => Math.max(0, value - 1));
  };

  const slides = [
    <SlideShell key="who" primary={pPrimary} secondary={pSecondary}>
      <div className="flex min-h-[496px] flex-col items-center justify-center text-center">
        <PersonalityAvatar profile={report.personality} size={168} />
        <p className="mt-8 text-[13px] font-semibold text-slate-400">
          {report.personality?.code ?? "AI-MBTI"}
        </p>
        <h1 className="mt-2 text-[22px] font-semibold text-white">
          {report.personality?.name ?? "你的 AI 协作画像"}
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-slate-300">
          &ldquo;{report.personality?.tagline ?? compactText(report.summary, 88)}&rdquo;
        </p>
        <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag.label} label={tag.label} color={tag.color} />
          ))}
        </div>
      </div>
    </SlideShell>,
    <SlideShell key="what" primary={pPrimary} secondary={pSecondary}>
      <div className="space-y-8">
        <div>
          <p className="text-[12px] font-semibold text-slate-400">WHAT</p>
          <h2 className="mt-2 text-[24px] font-semibold text-white">你的 AI 协作倾向</h2>
        </div>
        <div className="space-y-8">
          {report.dimensions.map((dimension, index) => (
            <SpectrumBar key={dimension.dimension} dimension={dimension} showScore index={index} />
          ))}
        </div>
      </div>
    </SlideShell>,
    <SlideShell key="persona" primary={pPrimary} secondary={pSecondary}>
      <PersonaSlide profile={report.personality} />
    </SlideShell>,
    <SlideShell key="why" primary={pPrimary} secondary={pSecondary}>
      <div>
        <p className="text-[12px] font-semibold text-slate-400">WHY</p>
        <h2 className="mt-2 text-[24px] font-semibold text-white">关于你，3 个值得记住的发现</h2>
        <div className="mt-8 divide-y divide-white/10">
          {insights.map((insight, index) => (
            <div key={insight.label} className="grid gap-4 py-6 first:pt-0 sm:grid-cols-[32px_1fr]">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, ${strongestMeta.lowColor}, ${strongestMeta.highColor})`,
                }}
              >
                {index + 1}
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">{insight.label}</h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-slate-300">{insight.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>,
    <SlideShell key="how" primary={pPrimary} secondary={pSecondary}>
      <div className="space-y-7">
        <div>
          <p className="text-[12px] font-semibold text-slate-400">HOW</p>
          <h2 className="mt-2 text-[24px] font-semibold text-white">下次使用 AI 可以这样做</h2>
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[14px] font-semibold text-white">Prompt 模板</p>
            <button
              type="button"
              onClick={copyPrompt}
              className="flex h-9 items-center gap-2 rounded-[8px] border border-white/10 px-3 text-[13px] font-semibold text-slate-200 hover:border-white/20"
            >
              {copiedPrompt ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copiedPrompt ? "已复制" : "复制"}
            </button>
          </div>
          <div
            className="rounded-[8px] p-4"
            style={{ background: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${strongestAccent}`, border: `1px solid rgba(255,255,255,0.08)`, borderLeftWidth: 3, borderLeftColor: strongestAccent }}
          >
            <p className="text-[14px] font-semibold text-white">{promptTemplate.title}</p>
            <p className="mt-1 text-[12px] text-slate-400">{promptTemplate.useCase}</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-slate-200">
              &ldquo;{promptTemplate.prompt}&rdquo;
            </p>
          </div>
        </section>
        <section>
          <p className="mb-2 text-[14px] font-semibold text-white">适合你的工作流</p>
          <p className="whitespace-pre-wrap rounded-[8px] p-4 text-[13px] leading-[1.65] text-slate-200" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {manifestoText}
          </p>
        </section>
        <div className="grid gap-2">
          {["试用 Prompt 模板", "试用工作流"].map((item, index) => (
            <button
              key={item}
              type="button"
              aria-pressed={Boolean(checkedActions[index])}
              onClick={() => setCheckedActions((value) => ({ ...value, [index]: !value[index] }))}
              className="flex h-11 items-center gap-3 rounded-[8px] px-3 text-left text-[13px] font-semibold text-slate-200 transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors"
                style={{
                  borderColor: checkedActions[index] ? strongestAccent : "rgba(255,255,255,0.2)",
                  backgroundColor: checkedActions[index] ? strongestAccent : "transparent",
                }}
              >
                {checkedActions[index] ? <Check className="h-3.5 w-3.5 text-white" /> : null}
              </span>
              <span className={checkedActions[index] ? "text-slate-500 line-through" : ""}>{item}</span>
            </button>
          ))}
        </div>
      </div>
    </SlideShell>,
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[430px]">
        {!showPoster ? (
          <section
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => handlePointerUp(event.changedTouches[0]?.clientX ?? 0)}
          >
            <AnimatePresence mode="wait">{slides[slideIndex]}</AnimatePresence>
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSlideIndex((value) => Math.max(0, value - 1))}
                disabled={slideIndex === 0}
                className="flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-[13px] font-semibold text-white/70 hover:text-white disabled:invisible"
              >
                <ArrowLeft className="h-4 w-4" />
                上一页
              </button>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3, 4].map((index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`第 ${index + 1} 页`}
                    onClick={() => setSlideIndex(index)}
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: slideIndex === index ? 28 : 8,
                      backgroundColor: slideIndex === index ? pPrimary : "rgba(255,255,255,0.25)",
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                className="flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white"
                style={{ backgroundColor: pPrimary }}
              >
                {slideIndex === 4 ? "查看海报" : "下一页"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : (
          <section>
            <PosterPreview
              report={report}
              tags={tags}
            />
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setShowFullReport((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[16px] font-semibold text-slate-950 shadow-[0_4px_24px_rgba(255,255,255,0.18)] transition-all hover:bg-slate-100 hover:shadow-[0_4px_32px_rgba(255,255,255,0.28)]"
              >
                查看完整维度解读
                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${showFullReport ? "rotate-180" : ""}`} />
              </button>
            </div>
          </section>
        )}
      </div>
      {showFullReport ? <div className="mx-auto mt-10 max-w-3xl">{fullReport}</div> : null}
    </main>
  );
}


function PosterPreview({
  report,
  tags,
}: {
  report: ReportPageModel;
  tags: Array<{ label: string; color: string }>;
}) {
  const code = report.personality?.code ?? "AI-MBTI";
  const name = report.personality?.name ?? "AI 协作画像";
  const tagline = report.personality?.tagline;
  const goldenLine = getPersonalityTraits(report.personality?.code ?? "CEAL").goldenLine;

  return (
    <article
      className="relative aspect-[9/16] overflow-hidden rounded-[10px] border border-white/10 bg-gradient-to-b from-[#0a0d14] via-[#11151c] to-[#0c0f15] text-white shadow-[0_30px_90px_rgba(8,10,16,0.55)]"
      onContextMenu={(event) => {
        event.currentTarget.dataset.saveHint = "true";
      }}
    >
      {/* 纸纹 / 噪点底层 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* 水墨晕染 */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(178,34,34,0.18),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(85,179,255,0.14),transparent_70%)] blur-2xl" />

      {/* 卷轴竖线装饰 */}
      <div className="pointer-events-none absolute bottom-10 left-3 top-10 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute bottom-10 right-3 top-10 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />

      <div className="relative p-6 pb-8">
        {/* 顶部：头像 + 印章 + 人格名 */}
        <div className="flex items-start gap-4">
          <PersonalityAvatar profile={report.personality} size={116} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex rotate-[-2deg] items-center justify-center rounded-[3px] bg-gradient-to-br from-[#c0392b] to-[#8b1e1e] px-2.5 py-[3px] font-serif-cn text-[12px] font-bold tracking-[0.18em] text-white shadow-[0_2px_10px_rgba(192,57,43,0.45),inset_0_0_0_1px_rgba(255,255,255,0.12)] [text-shadow:0_1px_0_rgba(0,0,0,0.25)]">
                {code}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">
                AI · MBTI
              </span>
            </div>

            {/* 毛笔体人格名 */}
            <h1 className="mt-3 break-words bg-gradient-to-b from-[#fdf6e3] via-[#f1e3c0] to-[#cdb27d] bg-clip-text font-brush text-[42px] font-normal leading-[1.05] tracking-[0.04em] text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
              {name}
            </h1>
          </div>
        </div>

        {/* tagline:书法体引文 */}
        {tagline ? (
          <div className="relative mt-7 px-2">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-200/30" />
              <div className="h-1 w-1 rotate-45 bg-amber-200/45" />
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-200/30" />
            </div>
            <p className="relative z-10 mx-auto max-w-[88%] bg-[#0c0f15] px-3 text-center font-serif-cn text-[14px] italic leading-relaxed text-amber-50/90">
              「{tagline}」
            </p>
          </div>
        ) : null}

        {/* 古典分隔 */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-white/10" />
          <div className="h-1.5 w-1.5 rotate-45 bg-amber-200/55" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/20 to-white/10" />
        </div>

        {/* 光谱 */}
        <div className="space-y-4">
          {report.dimensions.map((dimension, index) => (
            <SpectrumBar key={dimension.dimension} dimension={dimension} showScore compact index={index} />
          ))}
        </div>

        {/* 标签 */}
        <div className="mt-7 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag.label} label={tag.label} color={tag.color} />
          ))}
        </div>

        {/* 底部分隔 */}
        <div className="mt-5 flex items-center gap-3 sm:mt-9">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/[0.08]" />
          <div className="h-1 w-1 rotate-45 bg-amber-200/40" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/[0.08]" />
        </div>

        <div className="mt-3 rounded-[8px] border border-amber-100/10 bg-gradient-to-b from-amber-100/[0.06] to-transparent px-4 py-3.5 sm:mt-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/55">Golden Line</p>
          <p className="mt-2 font-serif-cn text-[14px] leading-relaxed text-amber-50/90">
            「{goldenLine}」
          </p>
        </div>

        <div className="mt-4">
          <p className="font-serif-cn text-[11px] tracking-wide text-white/65">AI-MBTI · 协作画像</p>
        </div>
      </div>
    </article>
  );
}
