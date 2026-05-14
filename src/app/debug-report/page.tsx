"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ParticleBackground } from "@/components/ParticleBackground";
import { PERSONALITY_PROFILES } from "@/lib/personalityProfiles";
import type { Dimension, QuestionnaireAnswer, QuestionnaireQuestion } from "@/lib/types";

const PERSONALITY_CODES = [
  "IFAG",
  "IFAL",
  "IFTG",
  "IFTL",
  "IEAG",
  "IEAL",
  "IETG",
  "IETL",
  "CFAG",
  "CFAL",
  "CFTG",
  "CFTL",
  "CEAG",
  "CEAL",
  "CETG",
  "CETL",
];

const DIMENSION_CONFIG: Array<{
  dimension: Dimension;
  highLetter: string;
  forward: [string, string];
  reverse: [string, string];
}> = [
  {
    dimension: "Relation",
    highLetter: "C",
    forward: ["通用", "我倾向于把 AI 当成讨论伙伴，而不只是执行工具。"],
    reverse: ["写产品需求文档", "写产品需求文档时，我会直接告诉 AI 要写什么内容。"],
  },
  {
    dimension: "Workflow",
    highLetter: "F",
    forward: ["通用", "用 AI 时，我习惯先明确目标，再开始对话。"],
    reverse: ["写产品需求文档", "写产品需求文档时，我会先让 AI 给几个方向，再选一个深入。"],
  },
  {
    dimension: "Epistemic",
    highLetter: "A",
    forward: ["通用", "AI 给出答案后，我通常会先验证再使用。"],
    reverse: ["写产品需求文档", "写产品需求文档时，我会直接采纳 AI 的建议。"],
  },
  {
    dimension: "RepairScope",
    highLetter: "G",
    forward: ["通用", "AI 的输出不理想时，我更愿意重新描述问题，而不是只改局部。"],
    reverse: ["写产品需求文档", "写产品需求文档时，如果不满意，我会局部修改。"],
  },
];

function sideForCode(code: string, dimension: Dimension) {
  const index: Record<Dimension, number> = {
    Relation: 0,
    Workflow: 1,
    Epistemic: 2,
    RepairScope: 3,
  };
  const config = DIMENSION_CONFIG.find((item) => item.dimension === dimension);
  return code[index[dimension]] === config?.highLetter ? "high" : "low";
}

function scoreFor(code: string, dimension: Dimension, reverse: boolean) {
  const side = sideForCode(code, dimension);
  if (side === "high") return reverse ? 0 : 5;
  return reverse ? 5 : 0;
}

function makeQuestion(
  code: string,
  config: (typeof DIMENSION_CONFIG)[number],
  reverse: boolean,
  index: number
): QuestionnaireQuestion {
  const [scenario, question] = reverse ? config.reverse : config.forward;
  return {
    dimension: config.dimension,
    scenario,
    question,
    questionType: index < 8 ? (scenario === "通用" ? "universal" : "semi_specific") : "specific",
    reverse,
  };
}

function makeBatch(code: string, batchIndex: 1 | 2) {
  return DIMENSION_CONFIG.flatMap((config, dimensionIndex) => {
    const baseIndex = (batchIndex - 1) * 8 + dimensionIndex * 2;
    return [
      makeQuestion(code, config, false, baseIndex),
      makeQuestion(code, config, true, baseIndex + 1),
    ];
  });
}

function answerFromQuestion(code: string, question: QuestionnaireQuestion): QuestionnaireAnswer {
  return {
    dimension: question.dimension,
    question: question.question,
    scenario: question.scenario,
    reverse: question.reverse ?? false,
    score: scoreFor(code, question.dimension, question.reverse ?? false),
    skipped: false,
  };
}

export default function DebugReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState("CEAL");
  const selectedProfile = PERSONALITY_PROFILES[selectedCode];

  const selectedLabel = useMemo(
    () => `${selectedCode} · ${selectedProfile?.name ?? "未知类型"}`,
    [selectedCode, selectedProfile?.name]
  );

  const generateMockReport = () => {
    setLoading(true);
    const batch1 = makeBatch(selectedCode, 1);
    const batch2 = makeBatch(selectedCode, 2);
    const answers1 = batch1.map((question) => answerFromQuestion(selectedCode, question));
    const answers2 = batch2.map((question) => answerFromQuestion(selectedCode, question));

    const mockSessionState = {
      sessionId: `debug-session-${selectedCode}-${Date.now()}`,
      turn: 20,
      phase: "report" as const,
      background: {
        role: "产品经理",
        recentUse: "写产品需求文档",
        goal: "提高效率，并获得更多 idea/思路/选择/灵感",
        tools: ["ChatGPT", "Claude"],
        summary: `产品经理，使用 AI 写产品需求文档，调试人格 ${selectedLabel}`,
      },
      openProbes: [],
      questionnaireBatches: {
        batch1,
        batch2,
      },
      batchAnswers: {
        batch1: answers1,
        batch2: answers2,
      },
      answers: [...answers1, ...answers2],
      evidence: [
        { turn: 1, dimension: "Relation", quote: "我喜欢和 AI 讨论，而不是只下指令", signal: "strong" as const, evidenceKind: "quote" as const },
        { turn: 2, dimension: "Workflow", quote: "我习惯先让 AI 给几个方向，再选一个", signal: "strong" as const, evidenceKind: "quote" as const },
        { turn: 3, dimension: "Epistemic", quote: "我会验证 AI 的输出", signal: "strong" as const, evidenceKind: "quote" as const },
      ],
      scenarioGuidance: {
        status: "ready" as const,
        scenarioSummary: "写产品需求文档",
        granularity: "balanced" as const,
        includeTopics: ["需求文档", "方案比较"],
        avoidTopics: [],
      },
    };

    sessionStorage.setItem("ai_mbti_session_state", JSON.stringify(mockSessionState));
    sessionStorage.setItem("ai_mbti_answers", JSON.stringify([...answers1, ...answers2]));
    sessionStorage.setItem("ai_mbti_identity", "产品经理");
    sessionStorage.setItem("ai_mbti_target_context", JSON.stringify({
      role: "产品经理",
      tools: ["ChatGPT", "Claude"],
      recentUse: "写产品需求文档",
      goal: "提高效率，并获得更多 idea/思路/选择/灵感",
    }));
    router.push("/report");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-near-white">
      <ParticleBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-raycast-blue">调试工具</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">报告海报调试</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-dim-gray">
            选择任意 AI-MBTI 类型，直接生成对应倾向的调试报告，用来检查 16 种海报在移动端是否完整可见。
          </p>
        </div>

        <section className="rounded-[18px] border border-white/10 bg-surface-100/75 p-5 shadow-card-ring backdrop-blur-sm sm:p-7">
          <div className="space-y-5">
            <div className="grid gap-3">
              <span className="text-sm font-semibold text-light-gray">选择人格类型</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PERSONALITY_CODES.map((code) => {
                  const selected = selectedCode === code;
                  const profile = PERSONALITY_PROFILES[code];
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedCode(code)}
                      className={`rounded-[10px] border px-3 py-2 text-left transition ${
                        selected
                          ? "border-raycast-blue bg-raycast-blue/15 text-near-white"
                          : "border-white/10 bg-card-surface text-dim-gray hover:border-white/20 hover:text-light-gray"
                      }`}
                    >
                      <span className="block text-[12px] font-semibold">{code}</span>
                      <span className="mt-0.5 block text-[11px]">{profile?.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[10px] border border-white/10 bg-card-surface p-4">
              <h3 className="mb-2 text-sm font-semibold text-near-white">当前模拟数据</h3>
              <ul className="space-y-1 text-sm text-dim-gray">
                <li>类型：{selectedLabel}</li>
                <li>职业：产品经理</li>
                <li>场景：写产品需求文档</li>
                <li>问卷：16 题已填写，分数按所选人格自动生成</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={generateMockReport}
              disabled={loading}
              className="w-full rounded-[10px] bg-raycast-blue px-6 py-3 text-sm font-semibold text-near-white transition hover:bg-raycast-blue/90 disabled:opacity-50"
            >
              {loading ? "跳转中..." : `生成 ${selectedLabel} 调试报告`}
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full rounded-[10px] border border-white/10 bg-card-surface px-6 py-3 text-sm font-semibold text-dim-gray transition hover:border-white/20 hover:text-light-gray"
            >
              返回首页
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
