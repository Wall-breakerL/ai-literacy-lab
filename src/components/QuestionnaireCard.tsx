"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { QuestionnaireQuestion } from "@/lib/types";
import { buildQuestionStem } from "@/lib/questionText";

interface QuestionnaireCardProps {
  question: QuestionnaireQuestion;
  index: number;
  total: number;
  onAnswer: (score: number | null) => void;
}

const SCALE_LABELS = ["肯定不会", "一般不会", "偶尔会", "经常会", "通常会", "肯定会"];

export function QuestionnaireCard({
  question,
  index,
  total,
  onAnswer,
}: QuestionnaireCardProps) {
  const [selectedScore, setSelectedScore] = useState<number | "skip" | null>(null);
  /** 同步锁住整题，避免同一次渲染周期内双触达（连点） */
  const lockedRef = useRef(false);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lockedRef.current = false;
    setSelectedScore(null);
  }, [question.question, question.scenario, index]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);

  const questionStem = buildQuestionStem(question);

  const handleSelect = (score: number) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setSelectedScore(score);
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      onAnswer(score);
    }, 200);
  };

  const handleSkip = () => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setSelectedScore("skip");
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      onAnswer(null);
    }, 200);
  };

  return (
    <motion.div
      key={`question-${index}`}
      initial={{ opacity: 0, rotateY: -90, scale: 0.8 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md mx-auto"
      style={{ perspective: "1000px" }}
    >
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className="text-[12px] text-dim-gray font-medium tracking-[0.2px]">
          第 {index + 1} 题 / 共 {total} 题
        </div>
        <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden relative">
          <motion.div
            className="h-full rounded-full relative"
            style={{
              background: "linear-gradient(90deg, #2a5a8f 0%, #55b3ff 50%, #7ec8ff 100%)",
              backgroundSize: "200% 100%",
            }}
            initial={{ width: 0 }}
            animate={{
              width: `${((index + 1) / total) * 100}%`,
              backgroundPosition: ["0% 0%", "100% 0%"],
            }}
            transition={{
              width: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
              backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" },
            }}
          />
          {index + 1 === total && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1, repeat: 2, ease: "linear" }}
              style={{ width: "50%" }}
            />
          )}
        </div>
      </div>

      {/* Card */}
      <div className="bg-surface-100 p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] relative overflow-hidden">
        <motion.div
          className="absolute top-0 right-0 w-[200px] h-[200px] bg-[rgba(85,179,255,0.03)] rounded-full blur-[60px] pointer-events-none"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Question */}
        <div className="mb-8 relative z-10">
          <div className="inline-flex items-center rounded-pill border border-[rgba(85,179,255,0.18)] bg-[rgba(85,179,255,0.06)] px-3 py-1 text-[12px] font-semibold tracking-[0.2px] text-raycast-blue mb-4">
            {questionStem.label}
          </div>
          <p className="text-[19px] text-near-white font-medium leading-[1.7]">
            {questionStem.stem}
          </p>
          <p className="mt-3 text-[13px] text-dim-gray leading-relaxed">
            按你真实经历作答；没有类似经验可以选「不了解 / 没想好」。
          </p>
        </div>

        {/* Scale */}
        <div className="space-y-3 relative z-10">
          <div className="text-[11px] text-dim-gray/90 mb-1">
            下列数字表示认同程度（1–6），与题号无关
          </div>
          <div className="flex justify-between text-[12px] text-dim-gray">
            <span>否定</span>
            <span>肯定</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5, 6].map((score) => (
              <motion.button
                key={score}
                type="button"
                disabled={selectedScore !== null}
                onClick={() => handleSelect(score)}
                whileHover={{ scale: selectedScore === null ? 1.1 : 1, y: selectedScore === null ? -4 : 0 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  w-12 h-12 rounded-full border flex items-center justify-center
                  text-[14px] font-semibold transition-all duration-200 relative
                  disabled:opacity-40 disabled:pointer-events-none
                  ${
                    selectedScore === score
                      ? "bg-raycast-blue text-void border-raycast-blue shadow-[0_0_20px_rgba(85,179,255,0.6)]"
                      : "bg-surface-100 border-[rgba(255,255,255,0.08)] text-light-gray hover:border-raycast-blue hover:text-near-white hover:shadow-[0_0_12px_rgba(85,179,255,0.3)]"
                  }
                `}
              >
                {score}
                {selectedScore === score && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-raycast-blue"
                      initial={{ scale: 1, opacity: 0.8 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full bg-raycast-blue"
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </>
                )}
              </motion.button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-dim-gray mt-2">
            {SCALE_LABELS.map((label, i) => (
              <span
                key={label}
                style={{
                  width: "16%",
                  textAlign: i === 0 ? "left" : i === 5 ? "right" : "center" as const,
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled={selectedScore !== null}
            onClick={handleSkip}
            className={`
              mt-5 w-full h-11 rounded-[10px] border text-[13px] font-semibold transition-all duration-200
              disabled:opacity-40 disabled:pointer-events-none
              ${
                selectedScore === "skip"
                  ? "bg-card-surface text-near-white border-raycast-yellow"
                  : "bg-transparent border-[rgba(255,255,255,0.08)] text-dim-gray hover:text-light-gray hover:border-[rgba(255,255,255,0.16)]"
              }
            `}
          >
            不了解 / 没想好
          </button>
          <p className="text-[11px] text-dim-gray/80 leading-relaxed">
            选择这一项时，本题不会计入分数。
          </p>
        </div>
      </div>
    </motion.div>
  );
}
