"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FeedbackDialogue } from "@/components/FeedbackDialogue";
import type { FeedbackContext } from "@/lib/types";

const MOCK_FEEDBACK_CONTEXT: FeedbackContext = {
  sessionId: "feedback-debug-session",
  identity: "调试用户",
  personalityCode: "IFAL",
  personalityName: "细节修补师",
  role: "产品 / 研究混合角色",
  recentUse: "用 AI 拆解产品方案、生成访谈提纲和审阅报告",
  goal: "让 AI 输出更贴近真实工作场景的建议",
  totalQuestions: 16,
  answeredQuestions: 15,
  skipRate: 1 / 16,
  reportSummary:
    "用户偏向先设定框架和验收标准，再让 AI 协助局部推进。报告建议用户在复杂任务开始前要求 AI 复述目标、列出待确认信息，并把风险点单独标注。",
  reportTags: ["框架优先", "审计输出", "局部修补"],
  collaborationManifesto: "我会先说明目标和验收标准，请你把不确定点标出来，再给我可执行的下一步。",
  promptTemplateTitles: ["任务启动", "审计输出"],
};

export default function FeedbackDebugPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-void px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-[14px] text-dim-gray transition-colors hover:text-light-gray"
        >
          <ArrowLeft className="h-4 w-4" />
          返回测试首页
        </button>

        <section className="rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-surface-100 p-6 shadow-card-ring sm:p-8">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-blue">
            Feedback Debug
          </p>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[0.2px] text-near-white">
            调试反馈对话
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-dim-gray">
            使用一份模拟报告上下文调用真实反馈接口。
          </p>
        </section>

        <FeedbackDialogue context={MOCK_FEEDBACK_CONTEXT} />
      </div>
    </main>
  );
}
