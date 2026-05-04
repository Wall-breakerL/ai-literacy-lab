"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Share2 } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { PersonalityAvatar } from "@/components/PersonalityAvatar";
import type { Dimension, DimensionReport, FinalReport, PromptTemplate } from "@/lib/types";

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
    lowLabel: "框架型",
    highLabel: "探索型",
    lowLetter: "F",
    highLetter: "E",
    lowColor: "#4f46e5",
    highColor: "#14b8a6",
  },
  Epistemic: {
    lowLabel: "审计型",
    highLabel: "信任型",
    lowLetter: "A",
    highLetter: "T",
    lowColor: "#64748b",
    highColor: "#fbbf24",
  },
  RepairScope: {
    lowLabel: "全局型",
    highLabel: "局部型",
    lowLetter: "G",
    highLetter: "L",
    lowColor: "#8b5cf6",
    highColor: "#10b981",
  },
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function strongestDimension(dimensions: DimensionReport[]) {
  return dimensions.reduce((prev, cur) =>
    Math.abs(cur.score - 50) > Math.abs(prev.score - 50) ? cur : prev
  );
}

function tendencyTag(dimension: DimensionReport) {
  const meta = DIMENSION_META[dimension.dimension];
  const highSide = dimension.score >= 50;
  return {
    label: highSide ? meta.highLabel : meta.lowLabel,
    color: highSide ? meta.highColor : meta.lowColor,
  };
}

function visibleTags(report: ReportPageModel) {
  const dimensionTags = report.dimensions
    .filter((dimension) => dimension.score >= 60 || dimension.score <= 40)
    .map(tendencyTag);

  if (dimensionTags.length) return dimensionTags;
  return report.tags.slice(0, 4).map((tag) => ({ label: tag, color: "#55b3ff" }));
}

function compactText(text?: string, maxLength = 92) {
  const clean = (text ?? "").replace(/[#*_`>\[\]()]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function getPromptTemplate(report: ReportPageModel): PromptTemplate {
  return report.promptTemplates?.[0] ?? {
    title: "任务启动模板",
    useCase: "下次开始复杂任务时使用",
    prompt:
      "我需要完成一个任务。请先复述我的目标，再列出你准备采用的步骤、关键假设和需要我确认的信息。先给出可用版本，再等待我反馈。",
  };
}

function getSpectrumAccent(dimension: DimensionReport) {
  const meta = DIMENSION_META[dimension.dimension];
  return dimension.score >= 50 ? meta.highColor : meta.lowColor;
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
  const score = clampScore(dimension.score);
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

function SlideShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ x: 36, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -36, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="min-h-[560px] rounded-[8px] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-8"
    >
      {children}
    </motion.div>
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
  const [shareHint, setShareHint] = useState("");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  const strongest = useMemo(() => strongestDimension(report.dimensions), [report.dimensions]);
  const strongestMeta = DIMENSION_META[strongest.dimension];
  const strongestAccent = getSpectrumAccent(strongest);
  const tags = useMemo(() => visibleTags(report), [report]);
  const promptTemplate = useMemo(() => getPromptTemplate(report), [report]);
  const corePattern = insights[0]?.value ?? compactText(report.summary, 120);
  const fitScenario = insights[1]?.value ?? report.targetContext?.recentUse ?? "复杂任务推进";
  const nextAction = insights[2]?.value ?? "下次先让 AI 复述目标，再列出关键假设。";
  const actionItems = [
    "复制协作宣言到 ChatGPT / Claude",
    "收藏最适合你的 Prompt 模板",
    "下次先让 AI 复述目标",
  ];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showPoster) return;
      if (event.key === "ArrowLeft") setSlideIndex((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") {
        setSlideIndex((value) => {
          if (value >= 3) {
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
    if (slideIndex >= 3) {
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

  const sharePoster = async () => {
    const text = `我的 AI-MBTI 协作画像：${report.personality?.code ?? "AI-MBTI"} · ${report.personality?.name ?? "AI 协作画像"}`;
    if (navigator.share) {
      await navigator.share({ title: "AI-MBTI 协作画像", text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(text);
    setShareHint("已复制分享文案，也可以长按海报区域保存截图。");
    window.setTimeout(() => setShareHint(""), 2200);
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
    <SlideShell key="who">
      <div className="flex min-h-[496px] flex-col items-center justify-center text-center">
        <PersonalityAvatar profile={report.personality} size={168} />
        <p className="mt-8 text-[13px] font-semibold text-slate-500">
          {report.personality?.code ?? "AI-MBTI"}
        </p>
        <h1 className="mt-2 text-[22px] font-semibold text-slate-950">
          {report.personality?.name ?? "你的 AI 协作画像"}
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-slate-500">
          “{report.personality?.tagline ?? compactText(report.summary, 88)}”
        </p>
        <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag.label} label={tag.label} color={tag.color} />
          ))}
        </div>
      </div>
    </SlideShell>,
    <SlideShell key="what">
      <div className="space-y-8">
        <div>
          <p className="text-[12px] font-semibold text-slate-400">WHAT</p>
          <h2 className="mt-2 text-[24px] font-semibold text-slate-950">你的 AI 协作倾向</h2>
        </div>
        <div className="space-y-8">
          {report.dimensions.map((dimension, index) => (
            <SpectrumBar key={dimension.dimension} dimension={dimension} showScore index={index} />
          ))}
        </div>
      </div>
    </SlideShell>,
    <SlideShell key="why">
      <div>
        <p className="text-[12px] font-semibold text-slate-400">WHY</p>
        <h2 className="mt-2 text-[24px] font-semibold text-slate-950">关于你的 3 个发现</h2>
        <div className="mt-8 divide-y divide-slate-100">
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
                <h3 className="text-[14px] font-semibold text-slate-950">{insight.label}</h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-slate-600">{insight.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>,
    <SlideShell key="how">
      <div className="space-y-7">
        <div>
          <p className="text-[12px] font-semibold text-slate-400">HOW</p>
          <h2 className="mt-2 text-[24px] font-semibold text-slate-950">下次使用 AI 可以这样做</h2>
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[14px] font-semibold text-slate-950">Prompt 模板</p>
            <button
              type="button"
              onClick={copyPrompt}
              className="flex h-9 items-center gap-2 rounded-[8px] border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 hover:border-slate-300"
            >
              {copiedPrompt ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copiedPrompt ? "已复制" : "复制"}
            </button>
          </div>
          <div
            className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"
            style={{ borderLeft: `3px solid ${strongestAccent}` }}
          >
            <p className="text-[14px] font-semibold text-slate-950">{promptTemplate.title}</p>
            <p className="mt-1 text-[12px] text-slate-500">{promptTemplate.useCase}</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-slate-700">
              “{promptTemplate.prompt}”
            </p>
          </div>
        </section>
        <section>
          <p className="mb-2 text-[14px] font-semibold text-slate-950">我的协作宣言</p>
          <p className="rounded-[8px] bg-slate-50 p-4 text-[13px] leading-[1.65] text-slate-700">
            {manifestoText}
          </p>
        </section>
        <section>
          <p className="mb-3 text-[14px] font-semibold text-slate-950">快速行动清单</p>
          <div className="space-y-2">
            {actionItems.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => setChecked((value) => ({ ...value, [index]: !value[index] }))}
                className="flex w-full items-center gap-3 rounded-[8px] border border-slate-200 p-3 text-left text-[13px] text-slate-700"
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                  style={{
                    borderColor: checked[index] ? strongestAccent : "#cbd5e1",
                    backgroundColor: checked[index] ? strongestAccent : "transparent",
                  }}
                >
                  {checked[index] ? <Check className="h-3 w-3 text-white" /> : null}
                </span>
                <span className={checked[index] ? "text-slate-400 line-through" : ""}>{item}</span>
              </button>
            ))}
          </div>
        </section>
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
                className="flex h-10 items-center gap-2 rounded-full border border-slate-300 px-4 text-[13px] font-semibold text-slate-700 disabled:invisible"
              >
                <ArrowLeft className="h-4 w-4" />
                上一页
              </button>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`第 ${index + 1} 页`}
                    onClick={() => setSlideIndex(index)}
                    className={`h-2 rounded-full transition-all ${slideIndex === index ? "w-7 bg-slate-950" : "w-2 bg-slate-300"}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                className="flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-[13px] font-semibold text-white"
              >
                {slideIndex === 3 ? "查看海报" : "下一页"}
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
            <div className="mt-5 space-y-3 text-center">
              <button
                type="button"
                onClick={sharePoster}
                className="mx-auto flex h-10 items-center gap-2 rounded-full bg-slate-950 px-5 text-[13px] font-semibold text-white"
              >
                <Share2 className="h-4 w-4" />
                分享 / 保存提示
              </button>
              <p className="text-[12px] leading-relaxed text-slate-500">
                {shareHint || "移动端可长按海报区域截图保存。"}
              </p>
              <button
                type="button"
                onClick={() => setShowFullReport((value) => !value)}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-600"
              >
                查看完整维度解读
                <ChevronDown className={`h-4 w-4 transition-transform ${showFullReport ? "rotate-180" : ""}`} />
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

      <div className="relative p-6">
        {/* 顶部：头像 + 印章 + 人格名 */}
        <div className="flex items-start gap-4">
          <PersonalityAvatar profile={report.personality} size={104} />
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
          <div className="relative mt-6 px-2">
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
        <div className="my-7 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-white/10" />
          <div className="h-1.5 w-1.5 rotate-45 bg-amber-200/55" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/20 to-white/10" />
        </div>

        {/* 光谱 */}
        <div className="space-y-3.5">
          {report.dimensions.map((dimension, index) => (
            <SpectrumBar key={dimension.dimension} dimension={dimension} showScore compact index={index} />
          ))}
        </div>

        {/* 标签 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag.label} label={tag.label} color={tag.color} />
          ))}
        </div>

        {/* 底部分隔 */}
        <div className="mt-7 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/[0.08]" />
          <div className="h-1 w-1 rotate-45 bg-amber-200/40" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/[0.08]" />
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="space-y-1 font-serif-cn text-[11px] tracking-wide text-white/55">
            <p className="text-white/70">AI-MBTI · 协作画像</p>
            <p className="text-white/40">截图保存 · 完整报告见链接</p>
          </div>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[6px] border border-amber-200/25 bg-white/[0.03] font-serif-cn text-[10px] text-white/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            QR
          </div>
        </div>
      </div>
    </article>
  );
}
