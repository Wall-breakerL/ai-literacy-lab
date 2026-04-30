"use client";

import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import type {
  FeedbackChatResponse,
  FeedbackContext,
  FeedbackDialogueMessage,
  StructuredFeedback,
} from "@/lib/types";

type Props = {
  context: FeedbackContext;
};

type DialogueStatus = "idle" | "opening" | "ready" | "thinking" | "saving" | "saved" | "error";

export function FeedbackDialogue({ context }: Props) {
  const [messages, setMessages] = useState<FeedbackDialogueMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<DialogueStatus>("idle");
  const [error, setError] = useState("");
  const [savedLocation, setSavedLocation] = useState("");
  const [draft, setDraft] = useState<StructuredFeedback | null>(null);

  const startDialogue = useCallback(async () => {
    setStatus("opening");
    setError("");
    const response = await callFeedbackChat(context, []);
    if (!response.ok) {
      setStatus("error");
      setError(response.error);
      return;
    }
    setMessages([{ role: "assistant", content: response.data.assistantMessage }]);
    setStatus("ready");
  }, [context]);

  const saveDraft = useCallback(async (nextDraft: StructuredFeedback) => {
    setStatus("saving");
    setError("");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextDraft),
    }).catch((err) => err instanceof Error ? err : new Error(String(err)));

    if (response instanceof Error) {
      setStatus("error");
      setError(response.message);
      return;
    }

    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      setStatus("error");
      setError(typeof data.detail === "string" ? data.detail : "反馈保存失败，请稍后再试。");
      return;
    }

    const location =
      typeof data.url === "string"
        ? data.url
        : typeof data.file === "string"
          ? data.file
          : "";
    setSavedLocation(location);
    setStatus("saved");
  }, []);

  const submitMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || status === "thinking" || status === "saving" || status === "saved") return;
    setInput("");
    setError("");
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setStatus("thinking");

    const response = await callFeedbackChat(context, nextMessages);
    if (!response.ok) {
      setStatus("error");
      setError(response.error);
      return;
    }

    const assistantMessage = { role: "assistant" as const, content: response.data.assistantMessage };
    const visibleMessages = [...nextMessages, assistantMessage];
    setMessages(visibleMessages);

    if (response.data.action === "ready_to_save" && response.data.draft) {
      const nextDraft = {
        ...response.data.draft,
        rawDialogue: visibleMessages,
      };
      setDraft(nextDraft);
      await saveDraft(nextDraft);
      return;
    }

    setStatus("ready");
  }, [context, input, messages, saveDraft, status]);

  const retrySave = useCallback(async () => {
    if (!draft) return;
    await saveDraft(draft);
  }, [draft, saveDraft]);

  const isBusy = status === "opening" || status === "thinking" || status === "saving";
  const canType = status === "ready" || status === "error";

  return (
    <section className="rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-surface-100 p-6 shadow-card-ring sm:p-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-raycast-blue">
            <MessageCircle className="h-4 w-4" />
            Report Feedback
          </p>
          <h2 className="text-[20px] font-semibold leading-tight tracking-[0.2px] text-near-white">
            跟 Claude 说说这份报告的感受
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-dim-gray">
            你可以直接说哪里有用、哪里不准、题目哪里不贴。Claude 会整理成可改进的信息并写入 Notion。
          </p>
        </div>
      </div>

      {status === "idle" ? (
        <button
          type="button"
          onClick={startDialogue}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[12px] border border-[rgba(85,179,255,0.22)] bg-[rgba(85,179,255,0.08)] px-4 py-3 text-[14px] font-semibold text-light-gray transition-colors hover:border-raycast-blue hover:text-near-white"
        >
          <MessageCircle className="h-4 w-4" />
          开始反馈对话
        </button>
      ) : null}

      {messages.length ? (
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-[14px] border px-4 py-3 text-[14px] leading-relaxed ${
                message.role === "assistant"
                  ? "border-[rgba(85,179,255,0.14)] bg-[rgba(85,179,255,0.05)] text-light-gray"
                  : "border-[rgba(255,255,255,0.07)] bg-card-surface text-near-white"
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>
      ) : null}

      {isBusy ? (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-dim-gray">
          <Loader2 className="h-4 w-4 animate-spin" />
          {status === "saving" ? "正在写入 Notion..." : "Claude 正在整理反馈..."}
        </div>
      ) : null}

      {status === "saved" ? (
        <div className="mt-4 rounded-[14px] border border-[rgba(60,220,130,0.18)] bg-[rgba(60,220,130,0.07)] p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-near-white">
            <CheckCircle2 className="h-4 w-4 text-[rgb(80,220,140)]" />
            反馈已记录
          </div>
          <p className="mt-2 break-words text-[13px] leading-relaxed text-dim-gray">
            这条反馈会用于后续优化题目、报告和 prompt 模板。{savedLocation ? `记录位置：${savedLocation}` : ""}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[14px] border border-[rgba(255,99,99,0.2)] bg-[rgba(255,99,99,0.08)] p-4 text-[13px] text-light-gray">
          <div className="mb-2 flex items-center gap-2 font-semibold text-near-white">
            <AlertCircle className="h-4 w-4 text-raycast-red" />
            反馈流程暂时失败
          </div>
          <p className="break-words leading-relaxed text-dim-gray">{error}</p>
          {draft ? (
            <button
              type="button"
              onClick={retrySave}
              className="mt-3 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-card-surface px-3 py-2 text-[13px] font-semibold text-light-gray hover:text-near-white"
            >
              重新写入
            </button>
          ) : null}
        </div>
      ) : null}

      {canType ? (
        <div className="mt-4 flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="直接说你的感受..."
            className="min-h-[52px] flex-1 resize-none rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-card-surface px-4 py-3 text-[14px] text-near-white placeholder:text-dim-gray focus:border-raycast-blue focus:outline-none"
            rows={2}
          />
          <button
            type="button"
            onClick={submitMessage}
            disabled={!input.trim()}
            className="h-[52px] w-[52px] shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[hsla(0,0%,100%,0.9)] text-[#18191a] transition-colors hover:bg-white disabled:opacity-40"
            aria-label="发送反馈"
          >
            <Send className="mx-auto h-4 w-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

async function callFeedbackChat(
  context: FeedbackContext,
  messages: FeedbackDialogueMessage[]
): Promise<{ ok: true; data: FeedbackChatResponse } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/feedback/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, messages }),
    });
    const data = await response.json().catch(() => ({})) as Partial<FeedbackChatResponse> & {
      detail?: string;
      error?: string;
    };
    if (!response.ok || !data.assistantMessage || !data.action) {
      return { ok: false, error: data.detail || data.error || "反馈对话请求失败。" };
    }
    return { ok: true, data: data as FeedbackChatResponse };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
