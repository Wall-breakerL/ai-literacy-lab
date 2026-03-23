"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, GraduationCap, Briefcase, Sparkles, Zap } from "lucide-react";
import type { UserProfile } from "@/lib/types";
import { getFirstScenarioForProfile } from "@/lib/scenario-router";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ROLES: {
  value: UserProfile["role"];
  label: string;
  desc: string;
  icon: typeof GraduationCap;
}[] = [
  { value: "student", label: copy.profile.roleStudent, desc: "课业、导师、校园沟通", icon: GraduationCap },
  { value: "general", label: copy.profile.roleGeneral, desc: "职场与日常决策", icon: Briefcase },
];

const LEVELS: {
  value: UserProfile["level"];
  label: string;
  hint: string;
  icon: typeof Sparkles;
}[] = [
  { value: "novice", label: copy.profile.levelNovice, hint: "刚开始接触或偶尔使用", icon: Sparkles },
  { value: "intermediate", label: copy.profile.levelIntermediate, hint: "有固定使用习惯", icon: Zap },
];

export default function ProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState<UserProfile["role"]>("student");
  const [level, setLevel] = useState<UserProfile["level"]>("novice");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile: UserProfile = { role, level };
    const scenarioId = getFirstScenarioForProfile(profile);
    const params = new URLSearchParams({ role, level });
    router.push(`/chat/${scenarioId}?${params.toString()}`);
  }

  return (
    <main className="glass-page">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="relative mb-6 overflow-hidden pt-0 ring-1 ring-indigo-200/15">
          <div
            className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500/70 via-violet-500/60 to-cyan-400/60"
            aria-hidden
          />
          <CardHeader className="pt-6">
            <CardTitle className="section-title">{copy.profile.title}</CardTitle>
            <CardDescription className="section-subtitle">{copy.profile.subtitle}</CardDescription>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-8">
          <fieldset className="space-y-3 border-0 p-0">
            <legend className="mb-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.profile.roleLegend}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLES.map((r, i) => {
                const selected = role === r.value;
                const Icon = r.icon;
                return (
                  <motion.button
                    key={r.value}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setRole(r.value)}
                    className={cn(
                      "glass-select-card",
                      selected && "glass-select-card--active"
                    )}
                  >
                    <div className="mb-3 flex w-full items-center justify-between">
                      <span
                        className={cn(
                          "tech-icon-tile h-11 w-11",
                          selected && "tech-icon-tile--active"
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      {selected && (
                        <Check className="h-5 w-5 text-indigo-600 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" aria-hidden />
                      )}
                    </div>
                    <span className="font-semibold text-foreground">{r.label}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{r.desc}</span>
                  </motion.button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-0 p-0">
            <legend className="mb-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.profile.levelLegend}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {LEVELS.map((l, i) => {
                const selected = level === l.value;
                const Icon = l.icon;
                return (
                  <motion.button
                    key={l.value}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.05 }}
                    onClick={() => setLevel(l.value)}
                    className={cn(
                      "glass-select-card",
                      selected && "glass-select-card--active"
                    )}
                  >
                    <div className="mb-3 flex w-full items-center justify-between">
                      <span
                        className={cn(
                          "tech-icon-tile h-11 w-11",
                          selected && "tech-icon-tile--active"
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      {selected && (
                        <Check className="h-5 w-5 text-indigo-600 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" aria-hidden />
                      )}
                    </div>
                    <span className="font-semibold text-foreground">{l.label}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{l.hint}</span>
                  </motion.button>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" size="lg" className="w-full shadow-lg">
            {copy.profile.cta}
          </Button>
        </form>
      </motion.div>
    </main>
  );
}
