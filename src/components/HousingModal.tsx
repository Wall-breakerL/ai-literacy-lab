'use client';

import { Housing } from '@/types';
import { getViolatedSoftConstraints } from '@/data/constraints';

interface HousingModalProps {
  housing: Housing;
  onClose: () => void;
}

export default function HousingModal({ housing, onClose }: HousingModalProps) {
  const violatedConstraints = getViolatedSoftConstraints(housing);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 backdrop-blur-2xl rounded-2xl max-w-md w-full shadow-2xl border border-white/[0.05] relative overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />

        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-bold text-white">{housing.name}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-slate-500">价格</span>
              <span className="font-semibold text-orange-400">{housing.price}元/月</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-slate-500">面积</span>
              <span className="font-semibold text-white">{housing.area}㎡</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-slate-500">地铁距离</span>
              <span className="font-semibold text-white">{housing.metroDistance}米</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-slate-500">朝向</span>
              <span className="font-semibold text-white">{housing.orientation}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-slate-500">楼层</span>
              <span className="font-semibold text-white">{housing.floor}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-slate-500">装修</span>
              <span className="font-semibold text-white">{housing.decoration}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-slate-500">周边配套</span>
              <span className="font-semibold text-white">{housing.facility}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-500">房龄</span>
              <span className="font-semibold text-white">{housing.age}年</span>
            </div>
          </div>

          {violatedConstraints.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <div className="text-xs text-yellow-400/80">
                不满足的软约束：{violatedConstraints.join('、')}
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
