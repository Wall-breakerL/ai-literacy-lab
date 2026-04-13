"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FinalReport, Message } from "@/lib/types";
import { DimensionCard } from "@/components/DimensionCard";
import { motion } from "framer-motion";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const generateReport = async () => {
      const historyStr = sessionStorage.getItem("ai_mbti_history");
      const identityStr = sessionStorage.getItem("ai_mbti_identity");

      if (!historyStr || !identityStr) {
        router.push("/");
        return;
      }

      try {
        const messages: Message[] = JSON.parse(historyStr);
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, identity: identityStr }),
        });

        if (!res.ok) throw new Error("Report generation failed");

        const data = await res.json();
        setReport(data);
      } catch (err) {
        console.error("Error:", err);
        setError("生成报告时发生错误，请稍后再试。");
      } finally {
        setLoading(false);
      }
    };

    generateReport();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-void relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[rgba(85,179,255,0.05)] rounded-full blur-[80px] pointer-events-none" />
        <Loader2 className="w-8 h-8 text-raycast-blue animate-spin mb-6" />
        <p className="text-light-gray text-[16px] tracking-[0.2px]">
          正在深度分析你的 AI-MBTI 特征...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-void">
        <p className="text-raycast-red text-[16px] mb-6">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-surface-100 border border-[rgba(255,255,255,0.06)] rounded-lg text-near-white"
        >
          返回首页
        </button>
      </div>
    );
  }

  // Map scores for radar chart
  const radarData = report.dimensions.map((d) => ({
    subject: d.label,
    score: d.score,
    fullMark: 100,
  }));

  return (
    <div className="min-h-screen bg-void py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-dim-gray hover:text-light-gray transition-colors text-[14px]"
          >
            <ArrowLeft className="w-4 h-4" />
            重新测试
          </button>
          <div className="text-[14px] font-semibold tracking-[0.4px] text-dim-gray uppercase">
            你的 AI 协作画像
          </div>
        </motion.div>

        {/* Overview Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row gap-8 items-center bg-surface-100 p-8 rounded-[20px] shadow-card-ring border border-[rgba(255,255,255,0.06)] relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[rgba(85,179,255,0.05)] rounded-full blur-[60px] pointer-events-none" />

          {/* Radar Chart */}
          <div className="w-full md:w-[300px] h-[300px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#9c9c9d", fontSize: 12, fontWeight: 500 }}
                />
                <Radar
                  name="AI-MBTI"
                  dataKey="score"
                  stroke="#55b3ff"
                  fill="#55b3ff"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary & Tags */}
          <div className="flex-1 space-y-6 relative z-10">
            <h2 className="text-[24px] font-medium text-near-white tracking-[0.2px] leading-[1.4]">
              {report.summary}
            </h2>
            <div className="flex flex-wrap gap-2">
              {report.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-card-surface border border-[rgba(255,255,255,0.08)] rounded-pill text-[12px] font-semibold text-light-gray"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Dimension Details */}
        <div className="space-y-4">
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[20px] font-medium text-near-white tracking-[0.2px] mb-6"
          >
            深度维度解析
          </motion.h3>

          {report.dimensions.map((dim, i) => (
            <DimensionCard key={dim.dimension} report={dim} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
