"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { UserProfile, ChatMessage, Scenario } from "@/lib/types";
import { SCENARIO_IDS } from "@/lib/constants";
import { copy } from "@/lib/copy";

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
          borderRadius: "var(--radius-md)",
          maxWidth: "85%",
          background: isUser ? "var(--color-primary)" : "var(--color-surface-muted)",
          color: isUser ? "var(--color-on-primary)" : "var(--color-text)",
          textAlign: "left",
          fontSize: "var(--text-sm)",
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
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {showThinking ? copy.chat.collapseThinking : copy.chat.expandThinking}
          </button>
          {showThinking && (
            <div
            style={{
              marginTop: "var(--space-xs)",
              padding: "var(--space-sm)",
              background: "var(--color-surface-muted)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
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
      ? copy.chat.loading
      : scenario?.visibleTask ?? copy.chat.loadFailed;

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
          profile,
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
        { role: "assistant", content: copy.chat.errorFallback },
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
      <main className="page-main page-main--wide" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--color-text-muted)" }}>{copy.common.redirecting}</p>
      </main>
    );
  }

  return (
    <main className="page-main page-main--wide">
      <div
        className="card"
        style={{
          padding: "var(--space-md)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <strong style={{ fontSize: "var(--text-sm)" }}>{copy.chat.taskLabel}</strong>
        <p style={{ marginTop: "var(--space-xs)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>{visibleTask}</p>
      </div>

      <div
        className="card"
        style={{
          minHeight: 280,
          padding: "var(--space-md)",
          marginBottom: "var(--space-md)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", marginBottom: "var(--space-md)" }}>
          {messages.length === 0 && (
            <p style={{ color: "var(--color-text-subtle)", fontSize: "var(--text-sm)" }}>
              {copy.chat.taskPlaceholder}
            </p>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {loading && (
            <p style={{ color: "var(--color-text-subtle)", fontSize: "var(--text-sm)" }} className="typing-dots">
              {copy.chat.loading}<span>.</span><span>.</span><span>.</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSend}>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <input
              type="text"
              placeholder={copy.chat.inputPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                padding: "var(--space-sm) var(--space-md)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
              }}
            />
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "var(--space-sm) var(--space-md)" }}>
              {copy.chat.send}
            </button>
          </div>
        </form>
      </div>

      {ending && (
        <p style={{ marginBottom: "var(--space-sm)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
          {copy.chat.endingHint}
        </p>
      )}
      <button
        type="button"
        onClick={handleEndConversation}
        disabled={ending}
        className="btn-primary"
      >
        {ending ? copy.chat.ending : copy.chat.endConversation}
      </button>
    </main>
  );
}
