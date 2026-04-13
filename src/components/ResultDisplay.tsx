'use client';

import { EvaluationResult } from '@/types';

interface ResultDisplayProps {
  result: EvaluationResult;
}

export default function ResultDisplay({ result }: ResultDisplayProps) {
  return (
    <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/[0.05] max-w-md w-full relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <h2 className="text-2xl font-bold text-white mb-6 text-center relative">评测结果</h2>

      {/* Decision Result */}
      <div className="mb-6 p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]">
        <div className="text-sm text-slate-500 mb-1">最终选择</div>
        <div className="text-xl font-bold text-white">
          房源{result.decision.choice}
          {result.decision.isOptimal && (
            <span className="ml-2 text-sm text-green-400 font-normal">✓ 最优解</span>
          )}
        </div>
      </div>

      {/* FAA Scores */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">FAA 能力评分</h3>
        <div className="space-y-2">
          <ScoreBar label="Frame" value={result.faa.frame} />
          <ScoreBar label="Ask" value={result.faa.ask} />
          <ScoreBar label="Review" value={result.faa.review} />
          <ScoreBar label="Edit" value={result.faa.edit} />
          <ScoreBar label="Synthesize" value={result.faa.synthesize} />
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
          <span className="font-semibold text-slate-300">综合得分</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{result.faa.total}</span>
        </div>
      </div>

      {/* MBTI Scores */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">AI-MBTI 风格</h3>
        <div className="space-y-3">
          <MBTIBar
            label="Relation"
            value={result.mbti.relation}
            leftLabel="工具型"
            rightLabel="伙伴型"
          />
          <MBTIBar
            label="Workflow"
            value={result.mbti.workflow}
            leftLabel="框架型"
            rightLabel="探索型"
          />
          <MBTIBar
            label="Epistemic"
            value={result.mbti.epistemic}
            leftLabel="审计型"
            rightLabel="信任型"
          />
          <MBTIBar
            label="RepairScope"
            value={result.mbti.repairScope}
            leftLabel="全局"
            rightLabel="局部"
          />
        </div>
      </div>

      {/* Profile */}
      <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-white/5">
        <div className="text-sm text-blue-400 mb-2">风格描述</div>
        <div className="text-slate-300 mb-3">{result.profile.summary}</div>
        <div className="flex flex-wrap gap-2">
          {result.profile.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-white/5 text-slate-300 text-xs rounded-full border border-white/10"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500 w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-semibold w-10 text-right text-slate-400">{value}</span>
    </div>
  );
}

function MBTIBar({
  label,
  value,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{leftLabel} 0</span>
        <span className="font-medium text-purple-400">
          {label}: {value}%
        </span>
        <span>100 {rightLabel}</span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
