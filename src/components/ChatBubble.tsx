"use client";

import type { ReactNode } from "react";
import { Message } from "@/lib/types";
import { stripHiddenReasoning } from "@/lib/sanitizeAssistantContent";
import { motion } from "framer-motion";
import { User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatBubbleProps {
  message: Message;
  isTyping?: boolean;
  /** Typing 时主行文案，默认「思考中…」；问卷生成轮可传「生成问卷中…」 */
  typingPrimaryLabel?: string;
  /** 显示在主文案下方，例如多次重试仍等待时 */
  typingNotice?: string | null;
}

const mdComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 last:mb-0 text-near-white leading-[1.6]">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-near-white">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-light-gray">{children}</em>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc pl-5 mb-2 space-y-1 text-near-white">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal pl-5 mb-2 space-y-1 text-near-white">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-[1.5]">{children}</li>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      className="text-raycast-blue underline underline-offset-2 hover:opacity-90"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children }: { className?: string; children?: ReactNode }) => {
    const inline = !className;
    return inline ? (
      <code className="px-1 py-0.5 rounded bg-void text-[14px] font-mono text-raycast-blue border border-[rgba(255,255,255,0.08)]">
        {children}
      </code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="mb-2 p-3 rounded-lg bg-void border border-[rgba(255,255,255,0.08)] overflow-x-auto text-[14px] font-mono text-light-gray">
      {children}
    </pre>
  ),
};

function formatThinkDurationLabel(sec: number): string {
  if (!Number.isFinite(sec) || sec < 1) return "不到1";
  return `${Math.round(sec)}`;
}

export function ChatBubble({
  message,
  isTyping,
  typingPrimaryLabel = "思考中…",
  typingNotice,
}: ChatBubbleProps) {
  const isUser = message.role === "user";
  const safeContent = stripHiddenReasoning(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}
    >
      <div className={`flex max-w-[85%] gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-[8px] bg-card-surface shadow-card-ring flex items-center justify-center border border-[rgba(255,255,255,0.06)]">
            {isUser ? (
              <User className="w-4 h-4 text-medium-gray" />
            ) : (
              <Sparkles className="w-4 h-4 text-raycast-blue" />
            )}
          </div>
        </div>

        <div className="flex flex-col min-w-0">
          {!isUser && !isTyping && message.model && (
            <p className="mb-1 text-[12px] text-dim-gray tracking-raycast-small pl-0.5">
              模型：{message.model}
              {message.thinkDurationSec != null
                ? `（已思考${formatThinkDurationLabel(message.thinkDurationSec)}秒）`
                : ""}
            </p>
          )}
          <div
            className={`px-5 py-3.5 rounded-[12px] shadow-card-ring border border-[rgba(255,255,255,0.06)] leading-[1.6] text-[16px] tracking-[0.2px]
            ${
              isUser
                ? "bg-surface-100 text-near-white"
                : "bg-surface-200 text-near-white"
            }
          `}
          >
            {isTyping ? (
              <div className="flex gap-1.5 h-6 items-center px-1">
                <div className="w-1.5 h-1.5 bg-medium-gray rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-medium-gray rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-medium-gray rounded-full animate-bounce" />
              </div>
            ) : isUser ? (
              <div className="whitespace-pre-wrap">{safeContent}</div>
            ) : (
              <div className="[&>*:first-child]:mt-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {safeContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
          {!isUser && isTyping && (
            <div className="mt-1.5 space-y-1 pl-0.5">
              <p className="text-[12px] text-dim-gray tracking-raycast-small">{typingPrimaryLabel}</p>
              {typingNotice ? (
                <p className="text-[11px] text-dim-gray/90 tracking-raycast-small leading-snug">
                  {typingNotice}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
