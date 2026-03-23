"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle, Scale, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { copy } from "@/lib/copy";

const features = [
  { icon: MessageCircle, label: "自然对话", hint: "任务嵌入情境" },
  { icon: Scale, label: "可解释评分", hint: "五维 + 证据链" },
  { icon: Sparkles, label: "轻量上手", hint: "无需安装客户端" },
] as const;

export default function HomePage() {
  return (
    <main className="glass-page">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden"
      >
        <div
          className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-500/35 via-violet-500/25 to-cyan-400/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-cyan-400/25 via-indigo-400/20 to-transparent blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[min(90vw,520px)] w-[min(90vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-violet-500/10 to-transparent blur-3xl"
          aria-hidden
        />

        <Card className="relative overflow-hidden ring-1 ring-indigo-200/20">
          <CardHeader className="relative z-[1] space-y-4">
            <Badge variant="glow" className="w-fit gap-1.5 px-3.5 py-1.5 font-semibold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI Literacy Lab · 研究原型
            </Badge>
            <div>
              <h1 className="glass-hero-title">{copy.home.title}</h1>
              <CardDescription className="mt-3 max-w-prose text-base leading-relaxed">
                {copy.home.subtitle}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="relative z-[1] space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Button asChild size="lg" className="w-full shadow-lg sm:w-auto">
                <Link href="/profile">{copy.home.cta}</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                全流程在浏览器内完成 · 适合课堂与实验室场景
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {features.map(({ icon: Icon, label, hint }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
                  className="glass-inset flex gap-3 p-4 transition-shadow duration-300 hover:shadow-[0_0_28px_-8px_rgba(99,102,241,0.3)]"
                >
                  <span className="tech-icon-tile h-10 w-10 shrink-0">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
