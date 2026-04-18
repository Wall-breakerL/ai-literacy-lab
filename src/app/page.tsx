"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(215,201,175,0.03)] rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10 space-y-6"
      >
        <div className="bg-surface-100 p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-raycast-red via-indigo-500 to-transparent opacity-50" />

          <h1 className="text-xl font-medium tracking-[0.2px] text-near-white mb-2">能力测评</h1>
          <p className="text-medium-gray text-[15px] leading-[1.65] mb-6 font-medium">
            选择一项开始：AI-MBTI 了解你与 AI 的协作风格；AI-HQ 评估你与 Agent 协作的成熟度（对话访谈 + 报告）。
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push("/interview")}
              className="min-h-[88px] flex flex-col items-center justify-center gap-2 rounded-[14px] bg-[hsla(0,0%,100%,0.9)] hover:bg-white text-[#18191a] font-semibold text-[14px] tracking-[0.2px] px-3 py-3 transition-all border border-[rgba(0,0,0,0.06)]"
            >
              <Sparkles className="w-5 h-5 text-raycast-red shrink-0" />
              <span className="text-center leading-snug">AI-MBTI</span>
              <span className="text-[11px] font-medium text-[#5c5d5e]">开始测试</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/hq-interview")}
              className="min-h-[88px] flex flex-col items-center justify-center gap-2 rounded-[14px] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[14px] tracking-[0.2px] px-3 py-3 transition-all"
            >
              <Zap className="w-5 h-5 shrink-0" />
              <span className="text-center leading-snug">AI-HQ</span>
              <span className="text-[11px] font-medium text-indigo-100/90">开始评估</span>
            </button>
          </div>

          <p className="mt-5 text-center text-dim-gray text-[12px] tracking-[0.4px]">完全匿名</p>
        </div>
      </motion.div>
    </main>
  );
}
