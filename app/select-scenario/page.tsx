"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { getDefaultEntryScenarioId } from "@/lib/scenario-router";
import { chatPathForScenarioWithQuery } from "@/lib/chat-entry";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";

function SelectScenarioPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identityId = searchParams.get("identityId") ?? undefined;

  const [taskPrompt, setTaskPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const body: { taskPrompt?: string; identityId?: string } = {};
      if (taskPrompt.trim()) body.taskPrompt = taskPrompt.trim();
      if (identityId) body.identityId = identityId;

      const res = await fetch("/api/scenario-select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { scenarioId?: string; error?: string };
      if (!res.ok || !data.scenarioId) throw new Error(data.error || "场景选择失败");
      router.push(chatPathForScenarioWithQuery(data.scenarioId, identityId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "场景选择失败");
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    const defaultScenarioId = getDefaultEntryScenarioId();
    router.push(chatPathForScenarioWithQuery(defaultScenarioId, identityId));
  }

  return (
    <main className="glass-page max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="ring-1 ring-indigo-200/20">
          <CardHeader>
            <CardTitle className="section-title">{copy.selectScenario.title}</CardTitle>
            <CardDescription>{copy.selectScenario.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="taskPrompt">{copy.selectScenario.promptLabel}</Label>
              <textarea
                id="taskPrompt"
                className="border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                placeholder={copy.selectScenario.promptPlaceholder}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                {loading ? copy.setup.saving : copy.selectScenario.submit}
              </Button>
              <Button type="button" variant="secondary" onClick={handleSkip} disabled={loading}>
                {copy.selectScenario.skip}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              <Link href="/" className="underline underline-offset-2">
                返回首页
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}

export default function SelectScenarioPage() {
  return (
    <Suspense
      fallback={
        <main className="glass-page">
          <p className="text-sm text-muted-foreground">{copy.common.redirecting}</p>
        </main>
      }
    >
      <SelectScenarioPageInner />
    </Suspense>
  );
}
