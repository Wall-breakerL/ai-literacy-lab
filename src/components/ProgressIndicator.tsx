"use client";

interface ProgressIndicatorProps {
  questionnaireProgress: { current: number; total: number };
}

export function ProgressIndicator({ questionnaireProgress }: ProgressIndicatorProps) {
  const { current, total } = questionnaireProgress;
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex gap-2 items-center justify-center py-2 px-4 bg-surface-100 rounded-pill border border-[rgba(255,255,255,0.06)] shadow-card-ring">
      <span className="text-[12px] font-semibold tracking-[0.4px] text-dim-gray mr-2 uppercase">
        问卷进度
      </span>
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
          <div
            className="h-full bg-raycast-blue rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-dim-gray">
          {current}/{total}
        </span>
      </div>
    </div>
  );
}
