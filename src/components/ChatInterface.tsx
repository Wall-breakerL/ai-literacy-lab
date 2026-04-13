'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ConversationMessage } from '@/types';

interface ChatInterfaceProps {
  messages: ConversationMessage[];
  onUserMessage: (message: string) => void;
  isProcessing: boolean;
}

export default function ChatInterface({
  messages,
  onUserMessage,
  isProcessing,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onUserMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px]">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex animate-message-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-2xl rounded-tl-xl rounded-tr-2xl rounded-bl-sm'
                  : 'bg-white/[0.08] text-slate-200 rounded-bl-2xl rounded-tl-xl rounded-tr-2xl rounded-br-sm border border-white/[0.05]'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isProcessing && (
          <div className="flex justify-start animate-message-in">
            <div className="bg-white/[0.08] rounded-bl-2xl rounded-tl-xl rounded-tr-2xl rounded-br-sm px-4 py-3 border border-white/[0.05]">
              <div className="flex items-center gap-2 text-slate-400">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse-dot" style={{ animationDelay: '200ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse-dot" style={{ animationDelay: '400ms' }} />
                </div>
                <span className="text-sm">AI思考中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-black/20">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isProcessing ? '等待AI回复...' : '输入消息...'}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white/[0.08] disabled:bg-white/[0.02] text-white placeholder:text-slate-500 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed font-medium transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
