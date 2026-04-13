"use client";

import { Message } from "@/lib/types";
import { motion } from "framer-motion";
import { User, Sparkles } from "lucide-react";

interface ChatBubbleProps {
  message: Message;
  isTyping?: boolean;
}

export function ChatBubble({ message, isTyping }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}
    >
      <div className={`flex max-w-[85%] gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-[8px] bg-card-surface shadow-card-ring flex items-center justify-center border border-[rgba(255,255,255,0.06)]">
            {isUser ? (
              <User className="w-4 h-4 text-medium-gray" />
            ) : (
              <Sparkles className="w-4 h-4 text-raycast-blue" />
            )}
          </div>
        </div>

        {/* Bubble */}
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
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
