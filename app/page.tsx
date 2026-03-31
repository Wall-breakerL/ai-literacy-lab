"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FrameworkStrip } from "@/components/home/framework-strip";
import { Hero } from "@/components/home/hero";
import { IntroGrid } from "@/components/home/intro-grid";
import { StartCta } from "@/components/home/start-cta";
import { TestFlow } from "@/components/home/test-flow";
import { CreateSessionResponseSchema } from "@/domain";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error("原型会话创建失败，请稍后重试。");
      }
      const data = CreateSessionResponseSchema.parse(await response.json());
      router.push(`/lab/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "原型服务暂时不可用，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <Hero />
      <IntroGrid />
      <TestFlow />
      <StartCta error={error} loading={loading} onStart={handleStart} />
      <FrameworkStrip />
    </main>
  );
}
