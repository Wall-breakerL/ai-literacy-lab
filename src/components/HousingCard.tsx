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
        className={`w-full p-3 rounded-xl border transition-all text-left ${
          isSelected
            ? 'border-blue-500 bg-blue-500/20'
            : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <span className={`font-bold ${isSelected ? 'text-blue-400' : 'text-white'}`}>{housing.name}</span>
            <span className="ml-2 text-sm text-slate-400">
              {housing.price}元 | {housing.area}㎡ | {housing.metroDistance}米
            </span>
          </div>
          <span className="text-xs text-slate-500 hover:text-slate-300">详情</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-lg font-bold text-gray-900">{housing.name}</span>
        <span className="text-xl font-bold text-orange-600">{housing.price}元/月</span>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <div>面积：{housing.area}㎡</div>
        <div>地铁：{housing.metroDistance}米</div>
      </div>
      <div className="mt-2 text-xs text-gray-400">点击查看详情</div>
    </button>
  );
}
