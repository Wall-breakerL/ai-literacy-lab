"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UserProfile } from "@/lib/types";
import { getFirstScenarioForProfile } from "@/lib/scenario-router";
import { copy } from "@/lib/copy";

const ROLES: { value: UserProfile["role"]; label: string }[] = [
  { value: "student", label: copy.profile.roleStudent },
  { value: "general", label: copy.profile.roleGeneral },
];

const LEVELS: { value: UserProfile["level"]; label: string }[] = [
  { value: "novice", label: copy.profile.levelNovice },
  { value: "intermediate", label: copy.profile.levelIntermediate },
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
    <main className="page-main">
      <h1 style={{ marginBottom: "var(--space-sm)", fontSize: "var(--text-2xl)", fontWeight: 700 }}>
        {copy.profile.title}
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-lg)" }}>
        {copy.profile.subtitle}
      </p>
      <form onSubmit={handleSubmit}>
        <fieldset style={{ border: "none", marginBottom: "var(--space-lg)" }}>
          <legend style={{ fontWeight: 600, marginBottom: "var(--space-sm)" }}>{copy.profile.roleLegend}</legend>
          {ROLES.map((r) => (
            <label key={r.value} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
              <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <fieldset style={{ border: "none", marginBottom: "var(--space-lg)" }}>
          <legend style={{ fontWeight: 600, marginBottom: "var(--space-sm)" }}>{copy.profile.levelLegend}</legend>
          {LEVELS.map((l) => (
            <label key={l.value} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
              <input type="radio" name="level" value={l.value} checked={level === l.value} onChange={() => setLevel(l.value)} />
              {l.label}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn-primary">
          {copy.profile.cta}
        </button>
      </form>
    </main>
  );
}
