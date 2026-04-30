import { PersonalityAvatar } from "@/components/PersonalityAvatar";
import { PERSONALITY_PROFILES } from "@/lib/personalityProfiles";

export default function AvatarPreviewPage() {
  const profiles = Object.values(PERSONALITY_PROFILES);

  return (
    <main className="min-h-screen bg-void px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-blue">
            AI-MBTI Avatar System
          </p>
          <h1 className="text-[32px] font-semibold tracking-[0.2px] text-near-white">
            16 型画像 PNG 预览
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-light-gray">
            这是一套原创 AI 协作人格画像。每个类型使用已经选定的统一风格 PNG 成图。
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {profiles.map((profile) => (
            <article
              key={profile.code}
              className="rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-surface-100 p-5 shadow-card-ring"
            >
              <div className="mb-4 flex justify-center">
                <PersonalityAvatar profile={profile} />
              </div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-blue">
                {profile.code}
              </p>
              <h2 className="mt-1 text-[18px] font-semibold text-near-white">
                {profile.name}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-light-gray">
                {profile.tagline}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
