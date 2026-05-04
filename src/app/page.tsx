"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, MessageCircle, FileText, Zap, Github } from "lucide-react";
import { useState, useEffect } from "react";

const PARTICLES_COUNT = 25;
const TYPING_TEXTS = [
  "发现你的 AI 协作画像",
  "了解你的协作优势",
  "找到最适合的工作方式",
];

const FEATURE_CARDS = [
  {
    icon: MessageCircle,
    title: "3 分钟轻量访谈",
    description: "自然对话，了解你的背景和使用场景",
    color: "#FF6363",
  },
  {
    icon: FileText,
    title: "24 题定制问卷",
    description: "基于你的场景动态生成个性化问题",
    color: "#55b3ff",
  },
  {
    icon: Zap,
    title: "个性化协作建议",
    description: "获得专属的 Prompt 模板和工作流",
    color: "#5fc992",
  },
];


function Particle({ index }: { index: number }) {
  const colors = ["#FF6363", "#55b3ff", "#5fc992", "#ffbc33"];
  const color = colors[index % colors.length];
  const delay = index * 0.5;
  const duration = 15 + (index % 5) * 2;
  const xOffset = (index % 3) * 10;

  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full"
      style={{
        left: `${(index * 4) % 100}%`,
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}`,
      }}
      initial={{ y: "100vh", x: 0, opacity: 0 }}
      animate={{
        y: "-100vh",
        x: xOffset,
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

function TypingText() {
  const [textIndex, setTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = TYPING_TEXTS[textIndex];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayText.length < currentText.length) {
            setDisplayText(currentText.slice(0, displayText.length + 1));
          } else {
            setTimeout(() => setIsDeleting(true), 2000);
          }
        } else {
          if (displayText.length > 0) {
            setDisplayText(displayText.slice(0, -1));
          } else {
            setIsDeleting(false);
            setTextIndex((textIndex + 1) % TYPING_TEXTS.length);
          }
        }
      },
      isDeleting ? 50 : 100
    );

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, textIndex]);

  return (
    <span className="inline-block min-h-[32px]">
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-[#07080a] via-[#0a0d14] to-[#0c0f15]">
      <a
        href="https://github.com/Wall-breakerL/human-ai-performance-lab"
        target="_blank"
        rel="noreferrer"
        className="group absolute right-4 top-4 z-20 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-surface-100/70 px-4 py-2 text-sm font-semibold text-slate-200 shadow-card-ring backdrop-blur-sm transition-all hover:border-white/20 hover:bg-surface-100 hover:text-white sm:right-6 sm:top-6"
        aria-label="打开 GitHub 仓库"
      >
        <Github className="h-4 w-4 text-slate-400 transition-colors group-hover:text-white" />
        <span className="hidden sm:inline">GitHub 仓库</span>
      </a>

      {/* 粒子背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: PARTICLES_COUNT }).map((_, i) => (
          <Particle key={i} index={i} />
        ))}
      </div>

      {/* 背景光晕 */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-raycast-red/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-raycast-blue/10 rounded-full blur-3xl pointer-events-none" />

      {/* 主内容 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl w-full relative z-10 space-y-12"
      >
        {/* 标题区 */}
        <div className="text-center space-y-4">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-6xl sm:text-7xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #FF6363 0%, #55b3ff 50%, #5fc992 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            AI-MBTI
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-2xl sm:text-3xl font-medium text-slate-300 h-12"
          >
            <TypingText />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed"
          >
            通过轻量访谈、定制问卷和个性化报告，了解你与 AI 协作时的习惯、优势和下一步可尝试的工作方式
          </motion.p>
        </div>

        {/* 特性卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {FEATURE_CARDS.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.9 + index * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative bg-surface-100/50 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
              style={{
                boxShadow: `0 0 0 1px ${feature.color}15, 0 8px 24px rgba(0,0,0,0.4)`,
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl"
                style={{ background: `radial-gradient(circle at center, ${feature.color}20, transparent 70%)` }}
              />
              <div className="relative">
                <feature.icon
                  className="w-8 h-8 mb-3 transition-transform group-hover:scale-110"
                  style={{ color: feature.color }}
                />
                <h3 className="text-near-white font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA 按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="flex flex-col items-center gap-4"
        >
          <button
            type="button"
            onClick={() => router.push("/interview")}
            className="group relative w-full max-w-[280px] overflow-hidden rounded-2xl bg-gradient-to-r from-raycast-red via-raycast-blue to-raycast-green px-8 py-4 text-lg font-semibold text-white shadow-glow-rainbow transition-all hover:shadow-glow-pulse sm:w-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-raycast-red via-raycast-blue to-raycast-green opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center justify-center gap-3">
              <Sparkles className="w-6 h-6 animate-pulse" />
              开始 AI-MBTI 测评
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <p className="text-slate-500 text-xs tracking-wide">
            完全匿名 · 约 5-10 分钟 · 即刻获得报告
          </p>
        </motion.div>
      </motion.div>

      {/* 底部装饰 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1, delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-600 text-xs"
      >
        Powered by qwen3.6-plus
      </motion.div>
    </main>
  );
}
