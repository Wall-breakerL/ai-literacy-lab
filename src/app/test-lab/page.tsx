import { PersonalityAvatar } from "@/components/PersonalityAvatar";
import { PERSONALITY_PROFILES } from "@/lib/personalityProfiles";
import {
  runAiMbtiSelfTests,
  summarizeSelfTests,
  type SelfTestResult,
} from "@/lib/selfTests";

function TestSection({ title, results }: { title: string; results: SelfTestResult[] }) {
  const summary = summarizeSelfTests(results);

  return (
    <section className="rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-surface-100 p-5 shadow-card-ring">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-semibold text-near-white">{title}</h2>
        <span
          className={`rounded-pill px-3 py-1 text-[12px] font-semibold ${
            summary.failed === 0
              ? "bg-[rgba(95,201,146,0.12)] text-raycast-green"
              : "bg-[rgba(255,99,99,0.12)] text-raycast-red"
          }`}
        >
          {summary.failed === 0 ? "ALL PASS" : "NEEDS ATTENTION"}
        </span>
      </div>
      <div className="grid gap-3">
        {results.map((result) => (
          <div
            key={result.name}
            className="grid gap-2 rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-card-surface p-4 sm:grid-cols-[140px_1fr]"
          >
            <span
              className={`w-fit rounded-pill px-3 py-1 text-[12px] font-semibold ${
                result.status === "pass"
                  ? "bg-[rgba(95,201,146,0.12)] text-raycast-green"
                  : "bg-[rgba(255,99,99,0.12)] text-raycast-red"
              }`}
            >
              {result.status.toUpperCase()}
            </span>
            <div>
              <p className="text-[15px] font-semibold text-near-white">{result.name}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-light-gray">{result.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TestLabPage() {
  const mbtiResults = runAiMbtiSelfTests();
  const results = mbtiResults;
  const summary = summarizeSelfTests(results);
  const profiles = Object.values(PERSONALITY_PROFILES);

  return (
    <main className="min-h-screen bg-void px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-blue">
            Automated Browser Test Lab
          </p>
          <h1 className="text-[32px] font-semibold tracking-[0.2px] text-near-white">
            自动化测试结果
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-light-gray">
            这个页面在浏览器中直接运行核心产品逻辑测试，方便 Codex 代替你做回归检查，也方便你肉眼确认测试结果和头像体系。
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[16px] border border-[rgba(255,255,255,0.06)] bg-surface-100 p-5 shadow-card-ring">
            <p className="text-[12px] uppercase tracking-[0.4px] text-dim-gray">Total</p>
            <p className="mt-2 text-[32px] font-semibold text-near-white">{summary.total}</p>
          </div>
          <div className="rounded-[16px] border border-[rgba(95,201,146,0.18)] bg-[rgba(95,201,146,0.06)] p-5 shadow-card-ring">
            <p className="text-[12px] uppercase tracking-[0.4px] text-raycast-green">Passed</p>
            <p className="mt-2 text-[32px] font-semibold text-near-white">{summary.passed}</p>
          </div>
          <div className="rounded-[16px] border border-[rgba(255,99,99,0.18)] bg-[rgba(255,99,99,0.06)] p-5 shadow-card-ring">
            <p className="text-[12px] uppercase tracking-[0.4px] text-raycast-red">Failed</p>
            <p className="mt-2 text-[32px] font-semibold text-near-white">{summary.failed}</p>
          </div>
        </section>

        <TestSection title="AI-MBTI 核心逻辑测试" results={mbtiResults} />

        <section className="rounded-[20px] border border-[rgba(255,188,51,0.18)] bg-[rgba(255,188,51,0.05)] p-5 shadow-card-ring">
          <h2 className="text-[20px] font-semibold text-near-white">AI-HQ 核心逻辑测试</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-light-gray">
            SKIPPED：AI-HQ v0.1 已归档，后续会作为 AI-MBTI 报告补充模块重构。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-[20px] font-semibold text-near-white">头像体系烟测</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <h3 className="mt-1 text-[18px] font-semibold text-near-white">{profile.name}</h3>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
