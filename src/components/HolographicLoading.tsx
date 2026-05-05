"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLoadingPhaseIndex, getReportLoadingProgress } from "@/lib/loadingProgress";

interface HolographicLoadingProps {
  onComplete?: () => void;
  reportReady: boolean;
}

const PHASES = [
  { key: "relation", label: "关系维度", color: "#ff6363" },
  { key: "workflow", label: "工作流维度", color: "#55b3ff" },
  { key: "epistemic", label: "认知维度", color: "#5fc992" },
  { key: "repair", label: "修复维度", color: "#ffbc33" },
  { key: "synthesis", label: "综合分析", color: "#a78bfa" },
];

const MATRIX_CHARS = "AIMBTICFEALGT01";

function MatrixRain() {
  const columns = 40;
  const rainColumns = useMemo(
    () =>
      Array.from({ length: columns }).map((_, i) => ({
        id: i,
        left: `${(i / columns) * 100}%`,
        duration: 3 + Math.random() * 2,
        delay: Math.random() * 2,
        text: Array.from({ length: 20 })
          .map(() => MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)])
          .join("\n"),
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
      {rainColumns.map((column) => (
        <motion.div
          key={column.id}
          className="absolute top-0 text-[10px] font-mono text-raycast-blue whitespace-pre"
          style={{ left: column.left }}
          animate={{
            y: ["0vh", "100vh"],
          }}
          transition={{
            duration: column.duration,
            repeat: Infinity,
            ease: "linear",
            delay: column.delay,
          }}
        >
          {column.text}
        </motion.div>
      ))}
    </div>
  );
}

function HolographicCube() {
  return (
    <div className="relative w-32 h-32" style={{ perspective: "800px" }}>
      <motion.div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
        }}
        animate={{
          rotateX: [0, 360],
          rotateY: [0, 360],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {/* Cube faces */}
        {[
          { transform: "rotateY(0deg) translateZ(64px)", bg: "rgba(85, 179, 255, 0.1)" },
          { transform: "rotateY(90deg) translateZ(64px)", bg: "rgba(255, 99, 99, 0.1)" },
          { transform: "rotateY(180deg) translateZ(64px)", bg: "rgba(95, 201, 146, 0.1)" },
          { transform: "rotateY(-90deg) translateZ(64px)", bg: "rgba(255, 188, 51, 0.1)" },
          { transform: "rotateX(90deg) translateZ(64px)", bg: "rgba(167, 139, 250, 0.1)" },
          { transform: "rotateX(-90deg) translateZ(64px)", bg: "rgba(255, 99, 99, 0.1)" },
        ].map((face, i) => (
          <div
            key={i}
            className="absolute w-32 h-32 border border-raycast-blue/30"
            style={{
              transform: face.transform,
              background: face.bg,
              backdropFilter: "blur(4px)",
            }}
          />
        ))}

        {/* Inner glow */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle, rgba(85, 179, 255, 0.3) 0%, transparent 70%)",
            transform: "translateZ(0px)",
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </div>
  );
}

function ScanLines() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 -translate-x-1/2 w-[400px] h-[2px] bg-gradient-to-r from-transparent via-raycast-blue to-transparent"
          style={{
            filter: "blur(1px)",
            boxShadow: "0 0 10px rgba(85, 179, 255, 0.8)",
          }}
          animate={{
            y: ["-200px", "200px"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: i * 1,
          }}
        />
      ))}
    </>
  );
}

function CircularProgress({ progress, phase }: { progress: number; phase: typeof PHASES[number] }) {
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-[320px] h-[320px]">
      <svg className="absolute inset-0 -rotate-90" width="320" height="320">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={phase.color} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#55b3ff" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx="160"
          cy="160"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="3"
        />

        {/* Progress circle */}
        <motion.circle
          cx="160"
          cy="160"
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />

        {/* Tick marks */}
        {Array.from({ length: 20 }).map((_, i) => {
          const angle = (i / 20) * 360;
          const isActive = (i / 20) * 100 <= progress;
          return (
            <line
              key={i}
              x1="160"
              y1="20"
              x2="160"
              y2="30"
              stroke={isActive ? phase.color : "rgba(255, 255, 255, 0.1)"}
              strokeWidth="2"
              transform={`rotate(${angle} 160 160)`}
              style={{
                transition: "stroke 0.3s ease",
              }}
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <HolographicCube />
      </div>
    </div>
  );
}

function DataStream() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        alpha: 0.3 + Math.random() * 0.7,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        duration: 2 + Math.random() * 2,
        delay: Math.random() * 2,
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: `rgba(85, 179, 255, ${particle.alpha})`,
            boxShadow: "0 0 4px rgba(85, 179, 255, 0.8)",
            left: particle.left,
            top: particle.top,
          }}
          animate={{
            x: [0, particle.x],
            y: [0, particle.y],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function getPhaseIndicatorProgress({
  progress,
  indicatorIndex,
  phaseIndex,
  isCompleting,
}: {
  progress: number;
  indicatorIndex: number;
  phaseIndex: number;
  isCompleting: boolean;
}) {
  if (isCompleting || progress >= 100 || indicatorIndex < phaseIndex) return 100;
  if (indicatorIndex > phaseIndex) return 0;

  const phaseSize = 100 / PHASES.length;
  const phaseStart = indicatorIndex * phaseSize;
  const normalized = ((progress - phaseStart) / phaseSize) * 100;
  return Math.max(0, Math.min(100, normalized));
}

export function HolographicLoading({ onComplete, reportReady }: HolographicLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [shouldExit, setShouldExit] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const completionStartedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const progressRef = useRef(0);

  const currentPhase = PHASES[phaseIndex];

  useEffect(() => {
    setMounted(true);
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const setProgressValue = useCallback((value: number) => {
    progressRef.current = value;
    setProgress(value);
  }, []);

  useEffect(() => {
    if (!reportReady || completionStartedRef.current) return;
    completionStartedRef.current = true;
    setIsCompleting(true);
    setPhaseIndex(PHASES.length - 1);
    const startProgress = progressRef.current;
    const startTime = Date.now();
    let animationFrame: number;

    const animateCompletion = () => {
      const elapsed = Date.now() - startTime;
      const nextProgress = Math.min(100, startProgress + ((100 - startProgress) * elapsed) / 1800);
      setProgressValue(nextProgress);
      if (nextProgress < 100) {
        animationFrame = requestAnimationFrame(animateCompletion);
      }
    };

    animationFrame = requestAnimationFrame(animateCompletion);

    const exitTimer = window.setTimeout(() => {
      setShouldExit(true);
    }, 1500);
    const completeTimer = window.setTimeout(() => {
      onCompleteRef.current?.();
    }, 2300);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [reportReady, setProgressValue]);

  useEffect(() => {
    if (isCompleting) return;
    const startTime = Date.now();
    let animationFrame: number;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const targetProgress = getReportLoadingProgress(elapsed);
      setPhaseIndex(getLoadingPhaseIndex(targetProgress, PHASES.length));
      setProgressValue(targetProgress);
      animationFrame = requestAnimationFrame(updateProgress);
    };

    animationFrame = requestAnimationFrame(updateProgress);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isCompleting, setProgressValue]);

  return (
    <AnimatePresence mode="wait">
      {!shouldExit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 bg-void z-50 flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Matrix rain background */}
          {mounted && !prefersReducedMotion ? <MatrixRain /> : null}

          {/* Ambient glow */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none"
            style={{ background: currentPhase.color }}
            animate={{
              opacity: [0.05, 0.15, 0.05],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Data stream particles */}
          {mounted && !prefersReducedMotion ? <DataStream /> : null}

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Circular progress with cube */}
            <div className="relative mb-8">
              <CircularProgress progress={progress} phase={currentPhase} />
              {mounted && !prefersReducedMotion ? <ScanLines /> : null}
            </div>

            {/* Progress percentage */}
            <motion.div
              key={Math.floor(progress)}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[48px] font-bold text-near-white mb-4 tabular-nums"
              style={{
                textShadow: `0 0 20px ${currentPhase.color}`,
              }}
            >
              {Math.floor(progress)}%
            </motion.div>

            {/* Phase label */}
            <motion.div
              key={currentPhase.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-2"
            >
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ background: currentPhase.color }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <span
                className="text-[18px] font-semibold tracking-[0.2px]"
                style={{ color: currentPhase.color }}
              >
                {isCompleting ? "分析完成" : `正在分析 · ${currentPhase.label}`}
              </span>
            </motion.div>

            {/* Status text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-dim-gray text-[14px] tracking-[0.2px] text-center max-w-md"
            >
              {isCompleting
                ? "正在生成你的专属 AI 协作画像..."
                : progress >= 92
                  ? "报告文本还在收尾，通常会在 40–60 秒内完成。"
                  : "深度解析你的 AI 使用模式，预计 40–60 秒。"}
            </motion.p>

            {/* Phase indicators */}
            <div className="flex gap-2 mt-8">
              {PHASES.map((phase, i) => (
                <motion.div
                  key={phase.key}
                  className="w-12 h-1 rounded-full overflow-hidden bg-[rgba(255,255,255,0.05)]"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: phase.color }}
                    initial={false}
                    animate={{
                      width: `${getPhaseIndicatorProgress({
                        progress,
                        indicatorIndex: i,
                        phaseIndex,
                        isCompleting,
                      })}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Corner decorations */}
          {[
            { top: "20px", left: "20px", rotate: 0 },
            { top: "20px", right: "20px", rotate: 90 },
            { bottom: "20px", left: "20px", rotate: -90 },
            { bottom: "20px", right: "20px", rotate: 180 },
          ].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute w-8 h-8 border-l-2 border-t-2 border-raycast-blue/30"
              style={{ ...pos, transform: `rotate(${pos.rotate}deg)` }}
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
