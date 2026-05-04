"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10 space-y-6"
      >
        <div className="bg-surface-100 p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-raycast-red via-indigo-500 to-transparent opacity-50" />

          <h1 className="text-xl font-medium tracking-[0.2px] text-near-white mb-2">AI-MBTI</h1>
          <p className="text-medium-gray text-[15px] leading-[1.65] mb-6 font-medium">
            通过轻量访谈、定制问卷和个性化报告，了解你与 AI 协作时的习惯、优势和下一步可尝试的工作方式。
          </p>

          <button
            type="button"
            onClick={() => router.push("/interview")}
            className="w-full min-h-[56px] flex items-center justify-center gap-2 rounded-[14px] bg-[hsla(0,0%,100%,0.92)] hover:bg-white text-[#18191a] font-semibold text-[15px] tracking-[0.2px] px-4 py-3 transition-all border border-[rgba(0,0,0,0.06)]"
          >
            <Sparkles className="w-5 h-5 text-raycast-red shrink-0" />
            开始 AI-MBTI 测评
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => router.push("/mock-report")}
            className="mt-3 w-full min-h-[44px] flex items-center justify-center gap-2 rounded-[12px] bg-card-surface hover:bg-surface-200 text-light-gray hover:text-near-white font-semibold text-[14px] tracking-[0.2px] px-4 py-2 transition-all border border-[rgba(255,255,255,0.08)]"
          >
            <MessageCircle className="w-4 h-4 text-raycast-blue shrink-0" />
            查看模拟报告
          </button>

          <p className="mt-5 text-center text-dim-gray text-[12px] tracking-[0.4px]">
            完全匿名 · 能力成熟度补充模块正在重构中
          </p>
        </div>
      </motion.div>
    </main>
  );
}
