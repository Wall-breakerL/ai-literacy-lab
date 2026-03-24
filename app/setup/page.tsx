"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function SetupPage() {
  const router = useRouter();
  const [rawPrompt, setRawPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSkip() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("ai-literacy-identity-id");
    }
    router.push("/select-scenario");
  }

  async function submit() {
    if (!rawPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual_prompt",
          rawPrompt: rawPrompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ai-literacy-identity-id", data.identityId);
      }
      router.push(`/select-scenario?identityId=${data.identityId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="glass-page max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="ring-1 ring-indigo-200/20">
          <CardHeader>
            <CardTitle className="section-title">{copy.setup.title}</CardTitle>
            <CardDescription>{copy.setup.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="raw">{copy.setup.promptLabel}</Label>
              <textarea
                id="raw"
                className="border-input bg-background min-h-[160px] w-full rounded-md border px-3 py-2 text-sm"
                value={rawPrompt}
                onChange={(e) => setRawPrompt(e.target.value)}
                placeholder={copy.setup.promptPlaceholder}
              />
              <Button
                type="button"
                disabled={loading || !rawPrompt.trim()}
                onClick={submit}
              >
                {loading ? copy.setup.saving : copy.setup.saveContinue}
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <p className="text-xs text-muted-foreground">{copy.setup.hint}</p>
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-0 text-sm text-muted-foreground"
              onClick={handleSkip}
            >
              {copy.setup.skip}
            </Button>
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
