"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, FileText, MessageCircle, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { PersonalityAvatar } from "@/components/PersonalityAvatar";
import { getPersonalityTraits } from "@/lib/personalityProfiles";
import { getFallbackPromptTemplate } from "@/lib/reportDisplayContext";
import { buildStyleProfileDisplay } from "@/lib/styleProfileDisplay";
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
  feedbackPanel?: ReactNode;
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

const twoLineClamp = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
} as const;

function posterFileName(report: ReportPageModel) {
  const code = report.personality?.code ?? "AI-MBTI";
  const name = report.personality?.name ?? "poster";
  return `ai-mbti-${code}-${name}`.replace(/[\\/:*?"<>|\s]+/g, "-").toLowerCase();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("海报图片生成失败。"));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
}

function withShareTimeout(promise: Promise<void>, timeoutMs = 45_000) {
  return Promise.race([
    promise,
    new Promise<void>((_, reject) => {
      window.setTimeout(() => reject(new Error("share_timeout")), timeoutMs);
    }),
  ]);
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
  feedbackPanel,
}: ReportStoryExperienceProps) {
  const router = useRouter();
  const [slideIndex, setSlideIndex] = useState(0);
  const [showPoster, setShowPoster] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [sharingPoster, setSharingPoster] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const posterRef = useRef<HTMLElement | null>(null);

  const strongest = useMemo(() => strongestDimension(report.dimensions), [report.dimensions]);
  const strongestAccent = getSpectrumAccent(strongest);
  const tags = useMemo(() => visibleTags(report), [report]);
  const promptTemplate = useMemo(() => getPromptTemplate(report), [report]);
  const corePattern = insights[0]?.value ?? compactText(report.summary, 120);
  const fitScenario = insights[1]?.value ?? report.targetContext?.recentUse ?? "复杂任务推进";
  const nextAction = insights[2]?.value ?? "下次先让 AI 复述目标，再列出关键假设。";
  const styleProfileDisplay = useMemo(() => buildStyleProfileDisplay(report), [report]);
  const reportToolbox = (report as any).toolbox;
  const toolboxPromptTemplates = Array.isArray(reportToolbox?.promptTemplates) ? reportToolbox.promptTemplates : [];
  const toolboxChecklists = Array.isArray(reportToolbox?.checklists) ? reportToolbox.checklists : [];
  const toolboxWorkflow = reportToolbox?.workflow;
  const toolboxMissingMessage = "工具箱内容生成失败，请重新生成报告。";

  // 人格主题色
  const pPrimary = report.personality?.colors?.primary ?? "#55b3ff";
  const pSecondary = report.personality?.colors?.secondary ?? "#0f172a";
  const pAccent = report.personality?.colors?.accent ?? "#ffbc33";

  const copyPrompt = async () => {
    // 优先使用toolbox中的第一个prompt模板
    const promptText = toolboxPromptTemplates[0]?.prompt ?? promptTemplate.prompt;
    await navigator.clipboard.writeText(promptText);
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

  const revealFeedback = () => {
    setShowFeedbackPanel((value) => !value);
    window.setTimeout(() => {
      document.getElementById("report-feedback-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleSharePoster = async () => {
    if (!posterRef.current || sharingPoster) return;
    setSharingPoster(true);
    setShareStatus("");
    const mobileBrowser = isMobileBrowser();
    let downloaded = false;

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: null,
        scale: Math.min(mobileBrowser ? 2 : 3, window.devicePixelRatio || 2),
        useCORS: true,
      });
      const blob = await canvasToBlob(canvas);
      const filename = `${posterFileName(report)}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      const shareData: ShareData = {
        title: `${report.personality?.name ?? "AI-MBTI"} · AI-MBTI 协作画像`,
        text: "我的 AI-MBTI 协作画像",
        files: [file],
      };
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

      if (navigator.share && nav.canShare?.(shareData)) {
        await withShareTimeout(navigator.share(shareData));
        setShareStatus("已打开系统分享面板。");
      } else if (mobileBrowser) {
        setShareStatus("当前手机浏览器不支持直接分享图片，请使用系统截图保存海报。");
      } else {
        downloadBlob(blob, filename);
        downloaded = true;
        setShareStatus("当前浏览器不支持直接分享，已下载海报图片。");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareStatus("已取消分享。");
      } else {
        console.error("Poster share failed:", error);
        if (mobileBrowser) {
          setShareStatus("海报图片生成或分享失败，请使用系统截图保存海报。");
          return;
        }
        if (downloaded) return;
        setShareStatus("分享失败，已尝试下载海报图片。");
        try {
          if (posterRef.current) {
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(posterRef.current, { backgroundColor: null, scale: 2, useCORS: true });
            downloadBlob(await canvasToBlob(canvas), `${posterFileName(report)}.png`);
          }
        } catch {
          setShareStatus("海报图片生成失败，请稍后再试。");
        }
      }
    } finally {
      setSharingPoster(false);
    }
  };

  const slides = [
    // 第1页：首页 - Persona + Tags + 四维光谱
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
        {/* 添加四维光谱 */}
        <div className="mt-8 w-full space-y-4">
          {report.dimensions.map((dimension, index) => (
            <SpectrumBar key={dimension.dimension} dimension={dimension} compact index={index} />
          ))}
        </div>
      </div>
    </SlideShell>,

    // 第2页：Persona详细介绍
    <SlideShell key="persona" primary={pPrimary} secondary={pSecondary}>
      <PersonaSlide profile={report.personality} />
    </SlideShell>,

    // 第3页：风格画像
    <SlideShell key="styleProfile" primary={pPrimary} secondary={pSecondary}>
      <div className="space-y-6">
        <div>
          <p className="text-[12px] font-semibold text-slate-400">YOUR STYLE</p>
          <h2 className="mt-2 text-[24px] font-semibold text-white">你的协作风格画像</h2>
        </div>

        <div
          className="rounded-[10px] p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-[14px] font-semibold leading-[1.65] text-white">
            {styleProfileDisplay.description}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[8px] border border-[rgba(95,201,146,0.22)] bg-[rgba(95,201,146,0.08)] p-3">
              <p className="text-[12px] font-semibold text-[#5fc992]">优点</p>
              <div className="mt-3 space-y-2.5">
                {styleProfileDisplay.strengths.map((item, index) => (
                  <p key={`${item}-${index}`} className="flex gap-2 text-[12px] leading-[1.55] text-emerald-100/90">
                    <span className="mt-[1px] text-[#5fc992]">✓</span>
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-[8px] border border-[rgba(249,115,22,0.24)] bg-[rgba(249,115,22,0.08)] p-3">
              <p className="text-[12px] font-semibold text-[#f97316]">风险</p>
              <div className="mt-3 space-y-2.5">
                {styleProfileDisplay.weaknesses.map((item, index) => (
                  <p key={`${item}-${index}`} className="flex gap-2 text-[12px] leading-[1.55] text-orange-100/90">
                    <span className="mt-[1px] text-[#f97316]">✗</span>
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideShell>,

    // 第4页：工具箱
    <SlideShell key="toolbox" primary={pPrimary} secondary={pSecondary}>
      <div className="space-y-6">
        <div>
          <p className="text-[12px] font-semibold text-slate-400">TOOLBOX</p>
          <h2 className="mt-2 text-[24px] font-semibold text-white">适合你的AI工具箱</h2>
        </div>

        {/* Prompt模板 */}
        {toolboxPromptTemplates.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-white">Prompt 模板</p>
              <button
                type="button"
                onClick={copyPrompt}
                className="flex h-8 items-center gap-2 rounded-[6px] border border-white/10 px-2.5 text-[12px] font-semibold text-slate-200 hover:border-white/20"
              >
                {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedPrompt ? "已复制" : "复制"}
              </button>
            </div>
            <div
              className="rounded-[8px] p-3"
              style={{ background: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${strongestAccent}`, border: `1px solid rgba(255,255,255,0.08)`, borderLeftWidth: 3, borderLeftColor: strongestAccent }}
            >
              <p className="text-[13px] font-semibold text-white">{toolboxPromptTemplates[0].title}</p>
              <p className="mt-1 text-[11px] text-slate-400">{toolboxPromptTemplates[0].useCase}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-[1.65] text-slate-200">
                &ldquo;{toolboxPromptTemplates[0].prompt}&rdquo;
              </p>
            </div>
          </section>
        ) : (
          <p className="rounded-[8px] border border-white/10 bg-white/5 p-3 text-[13px] text-slate-300">
            {toolboxMissingMessage}
          </p>
        )}

        {/* Checklist */}
        {toolboxChecklists.length > 0 ? (
          <section>
            <p className="mb-2 text-[13px] font-semibold text-white">{toolboxChecklists[0].title}</p>
            <div className="space-y-1.5">
              {toolboxChecklists[0].items.slice(0, 3).map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/20 text-[10px] text-slate-400">
                    {i + 1}
                  </span>
                  <p className="text-[12px] leading-[1.5] text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="rounded-[8px] border border-white/10 bg-white/5 p-3 text-[13px] text-slate-300">
            {toolboxMissingMessage}
          </p>
        )}
      </div>
    </SlideShell>,

    // 第6页：工作流
    <SlideShell key="workflow" primary={pPrimary} secondary={pSecondary}>
      <div className="space-y-6">
        <div>
          <p className="text-[12px] font-semibold text-slate-400">WORKFLOW</p>
          <h2 className="mt-2 text-[24px] font-semibold text-white">
            {toolboxWorkflow?.title ?? "适合你的AI协作流程"}
          </h2>
        </div>

        {toolboxWorkflow?.steps && toolboxWorkflow.steps.length > 0 ? (
          <div className="space-y-3">
            {toolboxWorkflow.steps.map((step: any, index: number) => (
              <div key={index} className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                  style={{ backgroundColor: strongestAccent }}
                >
                  {step.step}
                </span>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-white">{step.action}</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-slate-300">{step.detail}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[8px] border border-white/10 bg-white/5 p-3 text-[13px] text-slate-300">
            {toolboxMissingMessage}
          </p>
        )}

        {toolboxWorkflow?.totalTime && (
          <div className="rounded-[8px] p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-[12px] text-slate-300">
              总时间：{toolboxWorkflow.totalTime}
            </p>
          </div>
        )}
      </div>
    </SlideShell>,
  ];

  const lastSlideIndex = slides.length - 1;

  const goNext = () => {
    if (slideIndex >= lastSlideIndex) {
      setShowPoster(true);
      return;
    }
    setSlideIndex((value) => value + 1);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showPoster) return;
      if (event.key === "ArrowLeft") setSlideIndex((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") {
        setSlideIndex((value) => {
          if (value >= lastSlideIndex) {
            setShowPoster(true);
            return value;
          }
          return value + 1;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastSlideIndex, showPoster]);

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
                {slides.map((_, index) => (
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
                {slideIndex === slides.length - 1 ? "查看海报" : "下一页"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : (
          <section className="flex min-h-[calc(100svh-4rem)] flex-col">
            <div className="mb-3 flex h-10 items-center justify-between">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 text-[12px] font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                首页
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Result Poster</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <PosterPreview
                report={report}
                tags={tags.slice(0, 3)}
                posterRef={posterRef}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleSharePoster}
                disabled={sharingPoster}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-raycast-blue/40 bg-raycast-blue/15 px-2 text-[12px] font-semibold text-raycast-blue transition hover:border-raycast-blue/60 hover:bg-raycast-blue/20 disabled:cursor-wait disabled:opacity-60"
              >
                <Share2 className="h-3.5 w-3.5" />
                {sharingPoster ? "生成中" : "分享"}
              </button>
              <button
                type="button"
                onClick={() => setShowFullReport((value) => !value)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white px-2 text-[12px] font-semibold text-slate-950 shadow-[0_4px_18px_rgba(255,255,255,0.16)] transition hover:bg-slate-100"
              >
                <FileText className="h-3.5 w-3.5" />
                完整报告
              </button>
              <button
                type="button"
                onClick={revealFeedback}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[rgba(95,201,146,0.4)] bg-[rgba(95,201,146,0.15)] px-2 text-[12px] font-semibold text-[#5fc992] transition hover:border-[rgba(95,201,146,0.62)] hover:bg-[rgba(95,201,146,0.2)]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                反馈
              </button>
            </div>
            {shareStatus ? <p className="mt-2 text-center text-[11px] leading-relaxed text-white/45">{shareStatus}</p> : null}
          </section>
        )}
      </div>
      {showFullReport ? <div className="mx-auto mt-10 max-w-3xl">{fullReport}</div> : null}
      {showFeedbackPanel && feedbackPanel ? <div className="mx-auto mt-10 max-w-3xl">{feedbackPanel}</div> : null}
    </main>
  );
}


function PosterPreview({
  report,
  tags,
  posterRef,
}: {
  report: ReportPageModel;
  tags: Array<{ label: string; color: string }>;
  posterRef: MutableRefObject<HTMLElement | null>;
}) {
  const code = report.personality?.code ?? "AI-MBTI";
  const name = report.personality?.name ?? "AI 协作画像";
  const tagline = report.personality?.tagline;
  const goldenLine = getPersonalityTraits(report.personality?.code ?? "CEAL").goldenLine;

  return (
    <article
      ref={posterRef}
      className="relative aspect-[9/16] overflow-hidden rounded-[10px] border border-white/10 bg-gradient-to-b from-[#0a0d14] via-[#11151c] to-[#0c0f15] text-white shadow-[0_30px_90px_rgba(8,10,16,0.55)]"
      style={{ width: "min(100%, calc((100svh - 144px) * 9 / 16))" }}
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

      <div className="relative flex h-full flex-col p-4">
        {/* 顶部：头像 + 印章 + 人格名 */}
        <div className="flex min-h-[100px] items-start gap-3.5">
          <PersonalityAvatar profile={report.personality} size={92} />
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
            <h1
              className="mt-2 break-words bg-gradient-to-b from-[#fdf6e3] via-[#f1e3c0] to-[#cdb27d] bg-clip-text font-brush text-[36px] font-normal leading-[1.05] tracking-[0.04em] text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
              style={twoLineClamp}
            >
              {name}
            </h1>
          </div>
        </div>

        {/* tagline:书法体引文 */}
        <div className="relative mt-2 flex min-h-[44px] items-center px-2">
          {tagline ? (
            <>
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-200/30" />
              <div className="h-1 w-1 rotate-45 bg-amber-200/45" />
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-200/30" />
            </div>
            <p
              className="relative z-10 mx-auto max-w-[88%] bg-[#0c0f15] px-3 text-center font-serif-cn text-[13px] italic leading-relaxed text-amber-50/90"
              style={twoLineClamp}
            >
              「{tagline}」
            </p>
            </>
          ) : null}
          </div>

        {/* 古典分隔 */}
        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-white/10" />
          <div className="h-1.5 w-1.5 rotate-45 bg-amber-200/55" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/20 to-white/10" />
        </div>

        {/* 光谱 */}
        <div className="space-y-2.5">
          {report.dimensions.map((dimension, index) => (
            <SpectrumBar key={dimension.dimension} dimension={dimension} showScore compact index={index} />
          ))}
        </div>

        {/* 标签 */}
        <div className="mt-3 flex min-h-[24px] flex-wrap gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag.label} label={tag.label} color={tag.color} />
          ))}
        </div>

        {/* 底部分隔 */}
        <div className="mt-auto flex items-center gap-3 pt-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/[0.08]" />
          <div className="h-1 w-1 rotate-45 bg-amber-200/40" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/[0.08]" />
        </div>

        <div className="mt-2 rounded-[8px] border border-amber-100/10 bg-gradient-to-b from-amber-100/[0.06] to-transparent px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/55">Golden Line</p>
          <p className="mt-2 font-serif-cn text-[13px] leading-relaxed text-amber-50/90" style={twoLineClamp}>
            「{goldenLine}」
          </p>
        </div>

        <div className="mt-3">
          <p className="font-serif-cn text-[11px] tracking-wide text-white/65">AI-MBTI · 协作画像</p>
        </div>
      </div>
    </article>
  );
}
