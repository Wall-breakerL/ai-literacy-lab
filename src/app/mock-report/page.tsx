"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateMockReport } from "@/lib/mockReport";

/**
 * 模拟报告入口页面
 * 自动注入模拟数据到 sessionStorage 并跳转到报告页
 */
export default function MockReportPage() {
  const router = useRouter();

  useEffect(() => {
    // 生成模拟报告数据
    const mockReport = generateMockReport();

    // 注入到 sessionStorage（模拟真实访谈流程）
    sessionStorage.setItem("ai_mbti_identity", "模拟用户");
    sessionStorage.setItem("ai_mbti_history", JSON.stringify([
      { role: "assistant", content: "这是一个模拟的访谈记录" },
      { role: "user", content: "我想快速预览报告效果" },
    ]));
    sessionStorage.setItem("ai_mbti_answers", JSON.stringify([
      { questionId: "mock-1", score: 68, skipped: false },
      { questionId: "mock-2", score: 42, skipped: false },
      { questionId: "mock-3", score: 58, skipped: false },
      { questionId: "mock-4", score: 72, skipped: false },
    ]));
    sessionStorage.setItem("ai_mbti_target_context", JSON.stringify(mockReport.targetContext));

    // 跳转到报告页
    router.push("/report");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-void">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-raycast-blue border-r-transparent" />
        <p className="mt-4 text-light-gray">正在加载模拟报告...</p>
      </div>
    </div>
  );
}
