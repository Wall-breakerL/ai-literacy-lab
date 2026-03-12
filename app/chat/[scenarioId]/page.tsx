"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { UserProfile, ChatMessage, Scenario } from "@/lib/types";
import { SCENARIO_IDS } from "@/lib/constants";

const markdownStyles: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.6,
  fontSize: "0.9375rem",
};
const markdownStylesBlock: React.CSSProperties = {
  ...markdownStyles,
  marginTop: "0.5em",
  marginBottom: "0.5em",
};
/** 气泡内标题不放大字号，与正文统一层次，仅用字重区分 */
const headingStyle: React.CSSProperties = {
  ...markdownStylesBlock,
  fontSize: "0.9375rem",
  fontWeight: 700,
  marginTop: "0.6em",
  marginBottom: "0.35em",
};

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showThinking, setShowThinking] = useState(false);
  const isUser = message.role === "user";
  return (
    <div
      style={{
        marginBottom: "0.75rem",
        textAlign: isUser ? "right" : "left",
      }}
    >
      <div
        className="chat-bubble-markdown"
        style={{
          display: "inline-block",
          padding: "0.6rem 0.85rem",
          borderRadius: 8,
          maxWidth: "85%",
          background: isUser ? "#111" : "#eee",
          color: isUser ? "#fff" : "#111",
          textAlign: "left",
          fontSize: "0.9375rem",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkBreaks]}
          components={{
            p: ({ children }) => <p style={markdownStylesBlock}>{children}</p>,
            h1: ({ children }) => <p style={headingStyle}>{children}</p>,
            h2: ({ children }) => <p style={headingStyle}>{children}</p>,
            h3: ({ children }) => <p style={headingStyle}>{children}</p>,
            h4: ({ children }) => <p style={headingStyle}>{children}</p>,
            h5: ({ children }) => <p style={headingStyle}>{children}</p>,
            h6: ({ children }) => <p style={headingStyle}>{children}</p>,
            strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
            em: ({ children }) => <em>{children}</em>,
            ul: ({ children }) => <ul style={{ ...markdownStylesBlock, paddingLeft: "1.2em", margin: "0.25em 0" }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ ...markdownStylesBlock, paddingLeft: "1.2em", margin: "0.25em 0" }}>{children}</ol>,
            li: ({ children }) => <li style={markdownStyles}>{children}</li>,
            hr: () => <hr style={{ border: "none", borderTop: "1px solid currentColor", opacity: 0.4, margin: "0.5em 0" }} />,
            code: ({ children }) => <code style={{ background: "rgba(0,0,0,0.08)", padding: "0.1em 0.3em", borderRadius: 4, fontSize: "0.9em" }}>{children}</code>,
            pre: ({ children }) => <pre style={{ ...markdownStylesBlock, overflow: "auto", whiteSpace: "pre-wrap" }}>{children}</pre>,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {!isUser && message.thinking && (
        <div style={{ marginTop: "0.35rem", maxWidth: "85%" }}>
          <button
            type="button"
            onClick={() => setShowThinking((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              fontSize: "0.8rem",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {showThinking ? "收起思考过程" : "展开思考过程"}
          </button>
          {showThinking && (
            <div
              style={{
                marginTop: "0.25rem",
                padding: "0.5rem",
                background: "#f9f9f9",
                borderRadius: 6,
                fontSize: "0.8rem",
                color: "#555",
              }}
            >
              <ReactMarkdown>{message.thinking}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const RESULT_STORAGE_KEY = "ai-literacy-last-result";

function getProfileFromSearchParams(
  searchParams: URLSearchParams
): UserProfile | null {
  const role = searchParams.get("role");
  const level = searchParams.get("level");
  if (
    (role === "student" || role === "general") &&
    (level === "novice" || level === "intermediate")
  ) {
    return { role, level };
  }
  return null;
}

function generateSessionId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}`;
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenarioId = typeof params.scenarioId === "string" ? params.scenarioId : null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [scenario, setScenario] = useState<Scenario | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const p = getProfileFromSearchParams(searchParams);
    setProfile(p);
    if (!p) {
      router.replace("/profile");
      return;
    }
    if (!scenarioId || !(SCENARIO_IDS as readonly string[]).includes(scenarioId)) {
      router.replace("/profile");
      return;
    }
    let cancelled = false;
    fetch(`/api/scenarios/${scenarioId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Scenario | null) => {
        if (!cancelled) setScenario(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setScenario(null);
      });
    return () => { cancelled = true; };
  }, [scenarioId, searchParams, router]);

  const visibleTask =
    scenario === undefined
      ? "加载中…"
      : scenario?.visibleTask ?? "加载失败，请刷新重试";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !profile || !scenarioId || loading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          scenarioId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      const content = data.content ?? "（无回复内容）";
      const thinking = typeof data.thinking === "string" ? data.thinking : undefined;
      setMessages((prev) => [...prev, { role: "assistant", content, thinking }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "抱歉，暂时无法回复，请稍后再试。" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEndConversation() {
    if (!profile || !scenarioId || ending) return;

    if (!sessionIdRef.current) {
      sessionIdRef.current = generateSessionId();
    }
    const sessionId = sessionIdRef.current;

    setEnding(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scenarioId,
          profile,
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "评估失败");
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(data));
      }
      router.push("/result");
    } catch (err) {
      setEnding(false);
      alert(err instanceof Error ? err.message : "评估失败，请重试");
    }
  }

  if (!profile || !scenarioId) {
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        <p>正在跳转...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          padding: "1rem",
          background: "#f5f5f5",
          borderRadius: 8,
          marginBottom: "1.5rem",
        }}
      >
        <strong>本关任务</strong>
        <p style={{ marginTop: "0.25rem" }}>{visibleTask}</p>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          minHeight: 280,
          padding: "1rem",
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", marginBottom: "1rem" }}>
          {messages.length === 0 && (
            <p style={{ color: "#888", fontSize: "0.9rem" }}>
              在下方输入消息，与助手自然对话完成任务。
            </p>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {loading && (
            <p style={{ color: "#888", fontSize: "0.9rem" }} className="typing-dots">
              助手思考中<span>.</span><span>.</span><span>.</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSend}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="输入消息..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: 6,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.5rem 1rem",
                background: "#111",
                color: "#fff",
                border: "none",
                borderRadius: 6,
              }}
            >
              发送
            </button>
          </div>
        </form>
      </div>

      {ending && (
        <p
          style={{
            marginBottom: "0.75rem",
            color: "#666",
            fontSize: "0.9rem",
          }}
        >
          正在评分，请稍候…（约需 10–30 秒）
        </p>
      )}
      <button
        type="button"
        onClick={handleEndConversation}
        disabled={ending}
        style={{
          padding: "0.6rem 1.2rem",
          background: ending ? "#999" : "#333",
          color: "#fff",
          border: "none",
          borderRadius: 6,
        }}
      >
        {ending ? "正在提交…" : "结束并查看结果"}
      </button>
    </main>
  );
}
