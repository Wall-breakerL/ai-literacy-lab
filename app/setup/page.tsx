"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import type { IdentitySource } from "@/lib/identity/types";
import { chatPathWithQuery } from "@/lib/chat-entry";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function SetupPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"prompt" | "form">("prompt");
  const [rawPrompt, setRawPrompt] = useState("");
  const [roleContext, setRoleContext] = useState("");
  const [domain, setDomain] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [aiFamiliarity, setAiFamiliarity] = useState("");
  const [riskSensitivity, setRiskSensitivity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToChat(identityId?: string) {
    router.push(chatPathWithQuery(identityId));
  }

  function handleSkip() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("ai-literacy-identity-id");
    }
    goToChat(undefined);
  }

  async function submit(source: IdentitySource) {
    setLoading(true);
    setError(null);
    try {
      const structuredSummary =
        source === "structured_form"
          ? {
              roleContext,
              domain,
              goals: goals.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean),
              constraints: constraints.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean),
              communicationStyle,
              aiFamiliarity,
              riskSensitivity,
            }
          : undefined;
      const res = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          rawPrompt: source === "manual_prompt" ? rawPrompt : "",
          structuredSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ai-literacy-identity-id", data.identityId);
      }
      goToChat(data.identityId);
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tab === "prompt" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTab("prompt")}
              >
                {copy.setup.tabPrompt}
              </Button>
              <Button
                type="button"
                variant={tab === "form" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTab("form")}
              >
                {copy.setup.tabForm}
              </Button>
            </div>

            {tab === "prompt" ? (
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
                  onClick={() => submit("manual_prompt")}
                >
                  {loading ? copy.setup.saving : copy.setup.saveContinue}
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                <div>
                  <Label>角色与情境</Label>
                  <Input value={roleContext} onChange={(e) => setRoleContext(e.target.value)} />
                </div>
                <div>
                  <Label>领域</Label>
                  <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
                </div>
                <div>
                  <Label>目标（逗号分隔）</Label>
                  <Input value={goals} onChange={(e) => setGoals(e.target.value)} />
                </div>
                <div>
                  <Label>约束（逗号分隔）</Label>
                  <Input value={constraints} onChange={(e) => setConstraints(e.target.value)} />
                </div>
                <div>
                  <Label>沟通风格</Label>
                  <Input value={communicationStyle} onChange={(e) => setCommunicationStyle(e.target.value)} />
                </div>
                <div>
                  <Label>对 AI 的熟悉度</Label>
                  <Input value={aiFamiliarity} onChange={(e) => setAiFamiliarity(e.target.value)} />
                </div>
                <div>
                  <Label>风险敏感度</Label>
                  <Input value={riskSensitivity} onChange={(e) => setRiskSensitivity(e.target.value)} />
                </div>
                <Button type="button" disabled={loading} onClick={() => submit("structured_form")}>
                  {loading ? copy.setup.saving : copy.setup.saveContinue}
                </Button>
              </div>
            )}

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
