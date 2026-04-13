'use client';

import { useState, useEffect, useRef } from 'react';
import { housingData } from '@/data/housing';
import { HARD_CONSTRAINTS, SOFT_CONSTRAINTS } from '@/data/constraints';
import { getAgentResponse } from '@/lib/agentA';
import { checkProgress, evaluate } from '@/lib/agentB';
import { resetProbes, addMessage } from '@/lib/probes';
import { Housing, ConversationMessage, EvaluationResult } from '@/types';
import HousingCard from '@/components/HousingCard';
import HousingModal from '@/components/HousingModal';
import ChatInterface from '@/components/ChatInterface';
import ResultDisplay from '@/components/ResultDisplay';

type Stage = 'chat' | 'result';

export default function Home() {
  const [stage, setStage] = useState<Stage>('chat');
  const [modalHouse, setModalHouse] = useState<Housing | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 进度状态
  const [selectedHouse, setSelectedHouse] = useState<string | null>(null);
  const [reasonGiven, setReasonGiven] = useState(false);

  const processingRef = useRef(false);

  useEffect(() => {
    resetProbes();
    const initialMessage: ConversationMessage = {
      role: 'agent',
      content: '你好！我来帮你找一套合适的房子。我这里有6套房源，你可以先看看，有问题随时问我。',
      timestamp: Date.now(),
    };
    addMessage('agent', initialMessage.content);
    setMessages([initialMessage]);
  }, []);

  const handleHouseClick = (housing: Housing) => {
    setModalHouse(housing);
  };

  // 检查是否可以查看结果
  const canShowResult = selectedHouse !== null;

  const handleShowResult = async () => {
    if (!canShowResult || isProcessing) return;
    setIsProcessing(true);

    try {
      const evaluation = await evaluate(messages, selectedHouse, reasonGiven);
      setResult(evaluation);
      setStage('result');
    } catch (error) {
      console.error('Evaluation error:', error);
    }

    setIsProcessing(false);
  };

  const handleUserMessage = async (message: string) => {
    if (processingRef.current || isProcessing) return;
    processingRef.current = true;
    setIsProcessing(true);

    addMessage('user', message);
    const currentMessages = [...messages, { role: 'user' as const, content: message, timestamp: Date.now() }];
    setMessages(currentMessages);

    // 获取 AI 回复
    try {
      const response = await getAgentResponse(currentMessages, message);
      const aiMsg: ConversationMessage = {
        role: 'agent',
        content: response,
        timestamp: Date.now(),
      };
      addMessage('agent', response);
      const messagesWithAI = [...currentMessages, aiMsg];
      setMessages(messagesWithAI);

      // 调用 B 检查进度
      try {
        const progress = await checkProgress(messagesWithAI);
        if (progress.selectedHouse) {
          setSelectedHouse(progress.selectedHouse);
        }
        if (progress.reasonGiven) {
          setReasonGiven(true);
        }
      } catch (error) {
        console.error('Error checking progress:', error);
        // 进度检查失败不影响主流程，静默处理
      }
    } catch (error) {
      console.error('Error getting response:', error);
      // 显示错误消息给用户
      const errorMsg: ConversationMessage = {
        role: 'agent',
        content: `抱歉，AI 响应出现了问题：${error instanceof Error ? error.message : '未知错误'}。请稍后再试。`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    processingRef.current = false;
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-black flex flex-col">
      {/* Header */}
      <header className="relative bg-black/50 backdrop-blur-xl border-b border-white/5 py-4 px-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <h1 className="text-xl font-bold text-white">Human-AI Performance Lab</h1>
          <p className="text-sm text-slate-500">租房选房源场景</p>
        </div>
      </header>

      {/* Constraints Display */}
      <div className="bg-black/30 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-red-500/10 text-red-400 rounded-full font-medium text-xs border border-red-500/20">硬约束</span>
            <span className="text-slate-400">{HARD_CONSTRAINTS[0].description}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-full font-medium text-xs border border-blue-500/20">软约束</span>
            <div className="flex gap-3 text-slate-500">
              {SOFT_CONSTRAINTS.map((c) => (
                <span key={c.id}>{c.description}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {stage === 'chat' && (
        <main className="flex-1 max-w-6xl mx-auto w-full p-4 flex gap-4 relative">
          {/* Left: Housing Cards */}
          <div className="w-80 flex-shrink-0">
            <h3 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wider">房源列表 · 点击查看详情</h3>
            <div className="space-y-2">
              {housingData.map((housing) => (
                <HousingCard
                  key={housing.id}
                  housing={housing}
                  onClick={() => handleHouseClick(housing)}
                  isSelected={selectedHouse === housing.id}
                  compact
                />
              ))}
            </div>
          </div>

          {/* Right: Chat */}
          <div className="flex-1 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.05] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                与AI助手对话
              </h2>
            </div>
            <ChatInterface
              messages={messages}
              onUserMessage={handleUserMessage}
              isProcessing={isProcessing}
            />
          </div>

          {/* Result Button - Bottom Left */}
          <div className="absolute bottom-6 left-6">
            <button
              onClick={handleShowResult}
              disabled={!canShowResult || isProcessing}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                canShowResult
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20'
                  : 'bg-white/[0.05] text-white/30 cursor-not-allowed border border-white/[0.05]'
              }`}
            >
              {isProcessing ? '生成中...' : '查看结果'}
            </button>
          </div>
        </main>
      )}

      {/* Result */}
      {stage === 'result' && result && (
        <main className="flex-1 flex justify-center items-center p-8">
          <ResultDisplay result={result} />
        </main>
      )}

      {/* Modal */}
      {modalHouse && (
        <HousingModal
          housing={modalHouse}
          onClose={() => setModalHouse(null)}
        />
      )}
    </div>
  );
}
