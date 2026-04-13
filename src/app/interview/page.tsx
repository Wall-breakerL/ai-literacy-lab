"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText } from "lucide-react";
import { Message, AgentBOutput } from "@/lib/types";
import { ChatBubble } from "@/components/ChatBubble";
import { ProgressIndicator } from "@/components/ProgressIndicator";

export default function InterviewPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [coverage, setCoverage] = useState<AgentBOutput["analysis"]["coverage"]>({
    Relation: "uncovered",
    Workflow: "uncovered",
    Epistemic: "uncovered",
    RepairScope: "uncovered",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(0);

  const triggerTurn = useCallback(
    async (
      currentMessages: Message[],
      id: string,
      currentRound: number,
      options?: { signal?: AbortSignal }
    ) => {
      const signal = options?.signal;
      inFlightRef.current += 1;
      setIsTyping(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: currentMessages,
            identity: id,
            roundCount: currentRound,
          }),
          signal,
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("Chat API error:", res.status, data);
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.agentAMessage },
        ]);
        setCoverage(data.agentBOutput.analysis.coverage);
        setIsComplete(data.isComplete);
        setRoundCount(currentRound + 1);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "抱歉，刚才没能从访谈服务拿到回复（通常是服务端暂时不可用或请求超时）。请再发送一次；若多次失败可刷新页面后重试。",
          },
        ]);
      } finally {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setIsTyping(false);
      }
    },
    []
  );

  useEffect(() => {
    const storedIdentity = sessionStorage.getItem("ai_mbti_identity");
    if (!storedIdentity) {
      router.push("/");
      return;
    }
    setIdentity(storedIdentity);

    const ac = new AbortController();
    void triggerTurn([], storedIdentity, 0, { signal: ac.signal });
    return () => ac.abort();
  }, [router, triggerTurn]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping || isComplete) return;

    const newMessages = [...messages, { role: "user", content: inputValue } as Message];
    setMessages(newMessages);
    setInputValue("");

    triggerTurn(newMessages, identity, roundCount);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const goToReport = () => {
    sessionStorage.setItem("ai_mbti_history", JSON.stringify(messages));
    router.push("/report");
  };

  return (
    <div className="flex flex-col h-screen bg-void max-w-3xl mx-auto">
      {/* Header */}
      <header className="flex-shrink-0 h-[72px] flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.06)] bg-[#07080a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-raycast-red shadow-[0_0_8px_rgba(255,99,99,0.5)]" />
          <h1 className="text-[14px] font-semibold tracking-[0.2px] text-light-gray">
            深度访谈进行中
          </h1>
        </div>
        <ProgressIndicator coverage={coverage} />
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} />
        ))}
        {isTyping && (
          <ChatBubble message={{ role: "assistant", content: "" }} isTyping={true} />
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-6 bg-void border-t border-[rgba(255,255,255,0.06)]">
        {isComplete ? (
          <button
            onClick={goToReport}
            className="w-full h-[52px] bg-[hsla(0,0%,100%,0.9)] hover:bg-white text-[#18191a] font-semibold text-[16px] rounded-pill tracking-[0.3px] flex items-center justify-center gap-2 transition-all shadow-button-native"
          >
            <FileText className="w-5 h-5" />
            生成我的 AI-MBTI 报告
          </button>
        ) : (
          <div className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的回答... (Shift + Enter 换行)"
              className="w-full bg-surface-100 border border-[rgba(255,255,255,0.08)] rounded-[12px] px-4 py-4 pr-14 text-[16px] text-near-white placeholder:text-dim-gray focus:outline-none focus:border-raycast-blue focus:ring-1 focus:ring-[rgba(85,179,255,0.15)] resize-none shadow-card-ring min-h-[60px] max-h-[200px] transition-all"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="absolute right-3 bottom-3 p-2 bg-[#1b1c1e] text-near-white rounded-[8px] border border-[rgba(255,255,255,0.06)] hover:bg-[#252829] disabled:opacity-50 disabled:hover:bg-[#1b1c1e] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
