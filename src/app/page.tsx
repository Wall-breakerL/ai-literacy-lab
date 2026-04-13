"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const [identity, setIdentity] = useState("");
  const router = useRouter();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity.trim()) return;

    // Use sessionStorage to pass identity to the interview page
    sessionStorage.setItem("ai_mbti_identity", identity.trim());
    router.push("/interview");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(215,201,175,0.03)] rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-surface-100 p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] relative overflow-hidden">
          {/* Subtle top highlight inner shadow handled by box-shadow, but we can add a red accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-raycast-red to-transparent opacity-50" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-[10px] bg-card-surface shadow-card-ring flex items-center justify-center border border-[rgba(255,255,255,0.06)]">
              <Sparkles className="w-5 h-5 text-raycast-red" />
            </div>
            <h1 className="text-2xl font-medium tracking-[0.2px]">AI-MBTI</h1>
          </div>

          <p className="text-medium-gray text-[16px] leading-[1.6] mb-8 font-medium">
            通过一场轻松的对话访谈，发现你与AI协作的独特风格。
            <br/><br/>
            在开始前，请用一句话描述你的身份或职业。这将帮助我们更好地设定访谈场景。
          </p>

          <form onSubmit={handleStart} className="space-y-6">
            <div>
              <input
                type="text"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="例如：前端开发工程师、新媒体运营..."
                className="w-full bg-void border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-[16px] text-near-white placeholder:text-dim-gray focus:outline-none focus:border-raycast-blue focus:ring-1 focus:ring-raycast-blue transition-all"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!identity.trim()}
              className="w-full h-[52px] bg-[hsla(0,0%,100%,0.9)] hover:bg-white text-[#18191a] font-semibold text-[16px] rounded-pill tracking-[0.3px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:hover:bg-[hsla(0,0%,100%,0.9)]"
            >
              开始访谈
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-dim-gray text-[12px] mt-6 tracking-[0.4px]">
          测试约需 3-6 分钟 · 沉浸式对话体验
        </p>
      </motion.div>
    </main>
  );
}
