"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ParticleBackground } from "@/components/ParticleBackground";

export default function DebugReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const generateMockReport = () => {
    setLoading(true);

    // 模拟的sessionState数据
    const mockSessionState = {
      sessionId: "debug-session-" + Date.now(),
      turn: 20,
      phase: "report" as const,
      background: {
        role: "产品经理",
        recentUse: "写产品需求文档",
        goal: "提高效率，并获得更多 idea/思路/选择/灵感",
        tools: ["ChatGPT", "Claude"],
        summary: "产品经理，使用AI写产品需求文档",
      },
      openProbes: [],
      batchAnswers: {
        hybrid_batch1: [
          { dimension: "Relation", scenario: "通用", question: "我倾向于把 AI 当成讨论伙伴，而不只是执行工具。", score: 4, reverse: false, skipped: false },
          { dimension: "Relation", scenario: "做事", question: "做事时，我期待 AI 主动提醒我可能忽略的问题。", score: 4, reverse: false, skipped: false },
          { dimension: "Workflow", scenario: "通用", question: "用 AI 时，我习惯先明确目标，再开始对话。", score: 2, reverse: true, skipped: false },
          { dimension: "Workflow", scenario: "完成任务", question: "完成任务前，我会先定好步骤，再让 AI 帮我推进。", score: 2, reverse: true, skipped: false },
          { dimension: "Epistemic", scenario: "通用", question: "AI 给出答案后，我通常会先验证再使用。", score: 2, reverse: true, skipped: false },
          { dimension: "Epistemic", scenario: "做决策", question: "做决策时，我会让 AI 列出依据，再判断是否采纳。", score: 2, reverse: true, skipped: false },
          { dimension: "RepairScope", scenario: "通用", question: "AI 的输出不理想时，我倾向于局部调整而不是重新开始。", score: 4, reverse: false, skipped: false },
          { dimension: "RepairScope", scenario: "调整方案", question: "调整方案时，我会在现有基础上小步迭代。", score: 4, reverse: false, skipped: false },
        ],
        hybrid_batch2: [
          { dimension: "Relation", scenario: "写产品需求文档", question: "写产品需求文档时，我会邀请 AI 一起讨论方案。", score: 5, reverse: false, skipped: false },
          { dimension: "Relation", scenario: "写产品需求文档", question: "写产品需求文档时，我会直接告诉 AI 要写什么内容。", score: 2, reverse: true, skipped: false },
          { dimension: "Workflow", scenario: "写产品需求文档", question: "写产品需求文档时，我会先让 AI 给几个方向，再选一个深入。", score: 5, reverse: false, skipped: false },
          { dimension: "Workflow", scenario: "写产品需求文档", question: "写产品需求文档时，我会先定好大纲，再让 AI 填充细节。", score: 1, reverse: true, skipped: false },
          { dimension: "Epistemic", scenario: "写产品需求文档", question: "写产品需求文档时，我会验证 AI 给的信息是否准确。", score: 1, reverse: true, skipped: false },
          { dimension: "Epistemic", scenario: "写产品需求文档", question: "写产品需求文档时，我会直接采纳 AI 的建议。", score: 4, reverse: false, skipped: false },
          { dimension: "RepairScope", scenario: "写产品需求文档", question: "写产品需求文档时，如果不满意，我会局部修改。", score: 5, reverse: false, skipped: false },
          { dimension: "RepairScope", scenario: "写产品需求文档", question: "写产品需求文档时，如果不满意，我会重新描述需求。", score: 2, reverse: true, skipped: false },
        ],
      },
      evidence: [
        { turn: 1, dimension: "Relation", quote: "我喜欢和 AI 讨论，而不是只下指令", signal: "strong" as const, evidenceKind: "quote" as const },
        { turn: 2, dimension: "Workflow", quote: "我习惯先让 AI 给几个方向，再选一个", signal: "strong" as const, evidenceKind: "quote" as const },
        { turn: 3, dimension: "Epistemic", quote: "我会验证 AI 的输出", signal: "strong" as const, evidenceKind: "quote" as const },
      ],
      scenarioGuidance: {
        status: "ready" as const,
        scenarioSummary: "在团队协作时",
        granularity: "balanced" as const,
        includeTopics: ["团队协作", "需求文档"],
        avoidTopics: [],
      },
    };

    console.log("[debug-report] Setting mock data:", mockSessionState);

    // 保存到sessionStorage
    sessionStorage.setItem("ai_mbti_session_state", JSON.stringify(mockSessionState));
    sessionStorage.setItem("ai_mbti_identity", "产品经理");
    sessionStorage.setItem("ai_mbti_target_context", JSON.stringify({
      role: "产品经理",
      tools: ["ChatGPT", "Claude"],
      recentUse: "写产品需求文档",
      goal: "提高效率，并获得更多 idea/思路/选择/灵感",
    }));

    console.log("[debug-report] Navigating to /report");

    // 跳转到报告页
    router.push("/report");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-near-white">
      <ParticleBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-raycast-blue">调试工具</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">报告生成调试</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-dim-gray">
            使用模拟数据直接测试报告生成，无需完成完整流程。
          </p>
        </div>

        <section className="rounded-[18px] border border-white/10 bg-surface-100/75 p-5 shadow-card-ring backdrop-blur-sm sm:p-7">
          <div className="space-y-4">
            <div className="rounded-[10px] border border-white/10 bg-card-surface p-4">
              <h3 className="mb-2 text-sm font-semibold text-near-white">模拟数据</h3>
              <ul className="space-y-1 text-sm text-dim-gray">
                <li>• 职业：产品经理</li>
                <li>• 场景：写产品需求文档</li>
                <li>• 倾向：伙伴型 + 探索型 + 信任型 + 局部型</li>
                <li>• 问卷：16题已填写（batch1 + batch2）</li>
                <li>• 证据：3条用户原话</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={generateMockReport}
              disabled={loading}
              className="w-full rounded-[10px] bg-raycast-blue px-6 py-3 text-sm font-semibold text-near-white transition hover:bg-raycast-blue/90 disabled:opacity-50"
            >
              {loading ? "跳转中..." : "生成调试报告"}
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
