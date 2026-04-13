'use client';

import { Housing } from '@/types';

interface HousingCardProps {
  housing: Housing;
  onClick: () => void;
  isSelected: boolean;
  compact?: boolean;
}

export default function HousingCard({ housing, onClick, isSelected, compact = false }: HousingCardProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full p-3 rounded-xl border transition-all text-left group ${
          isSelected
            ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
            : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]'
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <span className={`font-bold transition-colors ${isSelected ? 'text-blue-400' : 'text-white group-hover:text-blue-300'}`}>{housing.name}</span>
            <span className="ml-2 text-sm text-slate-500">
              {housing.price}元 | {housing.area}㎡ | {housing.metroDistance}米
            </span>
          </div>
          <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">详情</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-2xl border-2 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
          : 'border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15]'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-lg font-bold text-white">{housing.name}</span>
        <span className="text-xl font-bold text-orange-400">{housing.price}元/月</span>
      </div>
      <div className="text-sm text-slate-400 space-y-1">
        <div>面积：{housing.area}㎡</div>
        <div>地铁：{housing.metroDistance}米</div>
      </div>
      <div className="mt-2 text-xs text-slate-500">点击查看详情</div>
    </button>
  );
}
