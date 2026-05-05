"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  QUESTIONNAIRE_READY_MIN_PROGRESS,
  getQuestionnaireLoadingProgress,
} from "@/lib/loadingProgress";

interface QuestionnaireGeneratingProps {
  isReady?: boolean;
  onComplete?: () => void;
}

const STAGES = [
  { text: "分析你的回答...", duration: 5000 },
  { text: "理解你的协作风格...", duration: 5000 },
  { text: "定制专属问卷...", duration: 10000 },
  { text: "即将完成...", duration: 10000 },
];
const ESTIMATED_WAIT_LABEL = "预计 30–60s，请稍候";

function TypewriterText({ stages }: { stages: typeof STAGES }) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentStage = stages[currentStageIndex];
    if (!currentStage) return;

    if (charIndex < currentStage.text.length) {
      const timer = setTimeout(() => {
        setDisplayText(currentStage.text.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 80);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        if (currentStageIndex < stages.length - 1) {
          setCurrentStageIndex(currentStageIndex + 1);
          setCharIndex(0);
          setDisplayText("");
        }
      }, currentStage.duration);
      return () => clearTimeout(timer);
    }
  }, [charIndex, currentStageIndex, stages]);

  return (
    <motion.p
      key={currentStageIndex}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-light-gray text-[18px] font-medium tracking-[0.2px] min-h-[28px]"
    >
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="inline-block w-0.5 h-5 bg-raycast-blue ml-1 align-middle"
      />
    </motion.p>
  );
}

function FakeProgressBar({
  isCompleting,
  onAnimationComplete,
}: {
  isCompleting: boolean;
  onAnimationComplete?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  const setProgressValue = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, Math.floor(value)));
    progressRef.current = next;
    setProgress(next);
  }, []);

  useEffect(() => {
    if (isCompleting) {
      const startProgress = progressRef.current;
      const startTime = Date.now();
      const bridgeTarget = Math.max(startProgress, QUESTIONNAIRE_READY_MIN_PROGRESS);
      const bridgeDuration = startProgress < QUESTIONNAIRE_READY_MIN_PROGRESS ? 700 : 0;
      const completionDuration = 1400;
      completedRef.current = false;

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = elapsed < bridgeDuration
          ? startProgress + ((bridgeTarget - startProgress) * elapsed) / Math.max(bridgeDuration, 1)
          : bridgeTarget + ((100 - bridgeTarget) * (elapsed - bridgeDuration)) / completionDuration;
        setProgressValue(newProgress);

        if (newProgress >= 100 && !completedRef.current) {
          completedRef.current = true;
          clearInterval(interval);
          if (onAnimationCompleteRef.current) {
            setTimeout(() => onAnimationCompleteRef.current?.(), 200);
          }
        }
      }, 16);

      return () => clearInterval(interval);
    } else {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const rawProgress = getQuestionnaireLoadingProgress(elapsed);
        setProgressValue(Math.max(progressRef.current, rawProgress));
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isCompleting, setProgressValue]);

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-dim-gray">生成进度</span>
        <span className="text-[13px] font-semibold text-raycast-blue">{progress}%</span>
      </div>
      <div className="h-1.5 bg-dark-border rounded-full overflow-hidden relative">
        <motion.div
          className="h-full rounded-full relative"
          style={{
            background: isCompleting
              ? "linear-gradient(90deg, #55b3ff 0%, #22d3ee 50%, #a78bfa 100%)"
              : "linear-gradient(90deg, #2a5a8f 0%, #55b3ff 50%, #7ec8ff 100%)",
            backgroundSize: "200% 100%",
          }}
          animate={{
            width: `${progress}%`,
            backgroundPosition: ["0% 0%", "100% 0%"],
          }}
          transition={{
            width: { duration: 0.3, ease: "easeOut" },
            backgroundPosition: {
              duration: isCompleting ? 1 : 2,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
          animate={{
            x: ["-100%", "200%"],
          }}
          transition={{
            duration: isCompleting ? 0.8 : 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ width: "50%" }}
        />
      </div>
    </div>
  );
}

function OrbitRing({
  radius,
  speed,
  dots,
  delay = 0,
}: {
  radius: number;
  speed: number;
  dots: number;
  delay?: number;
}) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.6 }}
    >
      <motion.div
        className="relative"
        style={{ width: radius * 2, height: radius * 2 }}
        animate={{ rotate: speed < 0 ? -360 : 360 }}
        transition={{
          duration: Math.abs(speed),
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <svg
          width={radius * 2}
          height={radius * 2}
          className="absolute inset-0"
          style={{ filter: "drop-shadow(0 0 2px rgba(85, 179, 255, 0.3))" }}
        >
          <circle
            cx={radius}
            cy={radius}
            r={radius - 2}
            fill="none"
            stroke="rgba(85, 179, 255, 0.2)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
        </svg>
        {Array.from({ length: dots }).map((_, i) => {
          const angle = (i / dots) * Math.PI * 2;
          const x = radius + (radius - 2) * Math.cos(angle);
          const y = radius + (radius - 2) * Math.sin(angle);
          return (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-raycast-blue"
              style={{
                left: x - 4,
                top: y - 4,
                boxShadow: "0 0 8px rgba(85, 179, 255, 0.6)",
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: (i / dots) * 2,
              }}
            />
          );
        })}
      </motion.div>
    </motion.div>
  );
}

function EnergyCore() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <motion.div
        className="relative w-24 h-24"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(85, 179, 255, 0.4) 0%, rgba(85, 179, 255, 0.1) 50%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute inset-2 rounded-full"
          style={{
            background: "linear-gradient(135deg, #55b3ff 0%, #a78bfa 50%, #22d3ee 100%)",
            backgroundSize: "200% 200%",
          }}
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
            scale: [1, 1.1, 1],
          }}
          transition={{
            backgroundPosition: { duration: 4, repeat: Infinity, ease: "linear" },
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          }}
        />
        <motion.div
          className="absolute inset-4 rounded-full bg-void/50 backdrop-blur-sm"
          animate={{
            scale: [1, 0.95, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-raycast-blue/30"
            animate={{
              scale: [1, 2, 2],
              opacity: [0.6, 0, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.7,
              ease: "easeOut",
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

export function QuestionnaireGenerating({
  isReady = false,
  onComplete,
}: QuestionnaireGeneratingProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const reducedMotionCompletedRef = useRef(false);

  useEffect(() => {
    if (isReady) {
      setIsCompleting(true);
    }
  }, [isReady]);

  const handleAnimationComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  const checkReducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  useEffect(() => {
    if (!checkReducedMotion || !isReady || reducedMotionCompletedRef.current) return;
    reducedMotionCompletedRef.current = true;
    const id = window.setTimeout(() => onComplete?.(), 200);
    return () => window.clearTimeout(id);
  }, [checkReducedMotion, isReady, onComplete]);

  if (checkReducedMotion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-raycast-blue/20 flex items-center justify-center mb-6">
          <div className="w-8 h-8 rounded-full bg-raycast-blue animate-pulse" />
        </div>
        <p className="text-light-gray text-[18px] font-medium mb-2">个性化生成问卷中...</p>
        <p className="text-dim-gray text-[13px]">{ESTIMATED_WAIT_LABEL}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(85,179,255,0.03)] rounded-full blur-[100px] pointer-events-none"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="relative w-full max-w-lg h-[400px] flex items-center justify-center mb-8">
        <EnergyCore />
        <OrbitRing radius={80} speed={20} dots={8} delay={0.2} />
        <OrbitRing radius={110} speed={-15} dots={6} delay={0.4} />
        <OrbitRing radius={140} speed={25} dots={10} delay={0.6} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md">
        <TypewriterText stages={STAGES} />
        <FakeProgressBar isCompleting={isCompleting} onAnimationComplete={handleAnimationComplete} />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-dim-gray text-[13px] leading-relaxed text-center"
        >
          {isCompleting ? "正在完成..." : ESTIMATED_WAIT_LABEL}
        </motion.p>
      </div>
    </div>
  );
}
