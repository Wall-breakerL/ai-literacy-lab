"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UserProfile } from "@/lib/types";
import { getFirstScenarioForProfile } from "@/lib/scenario-router";

const ROLES: { value: UserProfile["role"]; label: string }[] = [
  { value: "student", label: "学生" },
  { value: "general", label: "通用（职场/生活）" },
];

const LEVELS: { value: UserProfile["level"]; label: string }[] = [
  { value: "novice", label: "新手" },
  { value: "intermediate", label: "有一定经验" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState<UserProfile["role"]>("student");
  const [level, setLevel] = useState<UserProfile["level"]>("novice");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile: UserProfile = { role, level };
    const scenarioId = getFirstScenarioForProfile(profile);
    const params = new URLSearchParams({
      role,
      level,
    });
    router.push(`/chat/${scenarioId}?${params.toString()}`);
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>选择你的画像</h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        用于分配更适合你的任务场景，评估维度对所有用户一致。
      </p>
      <form onSubmit={handleSubmit}>
        <fieldset style={{ border: "none", marginBottom: "1.5rem" }}>
          <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>身份 / 使用场景</legend>
          {ROLES.map((r) => (
            <label key={r.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <fieldset style={{ border: "none", marginBottom: "1.5rem" }}>
          <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>AI 使用熟练度</legend>
          {LEVELS.map((l) => (
            <label key={l.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <input
                type="radio"
                name="level"
                value={l.value}
                checked={level === l.value}
                onChange={() => setLevel(l.value)}
              />
              {l.label}
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          style={{
            padding: "0.6rem 1.2rem",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
          }}
        >
          进入场景
        </button>
      </form>
    </main>
  );
}
