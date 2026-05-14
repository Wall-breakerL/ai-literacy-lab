"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownTextVariant = "body" | "summary" | "compact";

interface MarkdownTextProps {
  content?: string;
  variant?: MarkdownTextVariant;
  className?: string;
}

const variantStyles: Record<
  MarkdownTextVariant,
  {
    paragraph: string;
    list: string;
    listItem: string;
    heading: string;
    code: string;
    pre: string;
  }
> = {
  body: {
    paragraph: "mb-3 last:mb-0 text-[15px] text-light-gray leading-[1.75] tracking-[0.2px]",
    list: "mb-3 last:mb-0 pl-5 space-y-1.5 text-[15px] text-light-gray leading-[1.65]",
    listItem: "pl-1",
    heading: "mb-2 text-[15px] font-semibold text-near-white",
    code: "px-1 py-0.5 rounded bg-void text-[13px] font-mono text-raycast-blue border border-border/70",
    pre: "mb-3 p-3 rounded-[10px] bg-void border border-border/70 overflow-x-auto text-[13px] font-mono text-light-gray",
  },
  summary: {
    paragraph: "mb-3 last:mb-0 text-[24px] font-medium text-near-white tracking-[0.2px] leading-[1.45]",
    list: "mb-3 last:mb-0 pl-5 space-y-1.5 text-[18px] text-near-white leading-[1.55]",
    listItem: "pl-1",
    heading: "mb-2 text-[22px] font-semibold text-near-white",
    code: "px-1 py-0.5 rounded bg-void text-[18px] font-mono text-raycast-blue border border-border/70",
    pre: "mb-3 p-3 rounded-[10px] bg-void border border-border/70 overflow-x-auto text-[14px] font-mono text-light-gray",
  },
  compact: {
    paragraph: "mb-2 last:mb-0 text-[14px] text-light-gray leading-relaxed",
    list: "mb-2 last:mb-0 pl-5 space-y-1 text-[14px] text-light-gray leading-relaxed",
    listItem: "pl-1",
    heading: "mb-1.5 text-[14px] font-semibold text-near-white",
    code: "px-1 py-0.5 rounded bg-void text-[12px] font-mono text-raycast-blue border border-border/70",
    pre: "mb-2 p-3 rounded-[10px] bg-void border border-border/70 overflow-x-auto text-[12px] font-mono text-light-gray",
  },
};

export function MarkdownText({ content, variant = "body", className = "" }: MarkdownTextProps) {
  const text = content?.trim();
  if (!text) return null;

  const styles = variantStyles[variant];

  return (
    <div className={`min-w-0 break-words [&>*:first-child]:mt-0 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }: { children?: ReactNode }) => (
            <p className={styles.paragraph}>{children}</p>
          ),
          strong: ({ children }: { children?: ReactNode }) => (
            <strong className="font-semibold text-near-white">{children}</strong>
          ),
          em: ({ children }: { children?: ReactNode }) => (
            <em className="italic text-light-gray">{children}</em>
          ),
          ul: ({ children }: { children?: ReactNode }) => (
            <ul className={`list-disc ${styles.list}`}>{children}</ul>
          ),
          ol: ({ children }: { children?: ReactNode }) => (
            <ol className={`list-decimal ${styles.list}`}>{children}</ol>
          ),
          li: ({ children }: { children?: ReactNode }) => (
            <li className={styles.listItem}>{children}</li>
          ),
          h1: ({ children }: { children?: ReactNode }) => (
            <p className={styles.heading}>{children}</p>
          ),
          h2: ({ children }: { children?: ReactNode }) => (
            <p className={styles.heading}>{children}</p>
          ),
          h3: ({ children }: { children?: ReactNode }) => (
            <p className={styles.heading}>{children}</p>
          ),
          blockquote: ({ children }: { children?: ReactNode }) => (
            <blockquote className="mb-3 border-l-2 border-raycast-blue/50 pl-3 text-light-gray">
              {children}
            </blockquote>
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
          code: ({ className: codeClassName, children }: { className?: string; children?: ReactNode }) => {
            const inline = !codeClassName;
            return inline ? (
              <code className={styles.code}>{children}</code>
            ) : (
              <code className={codeClassName}>{children}</code>
            );
          },
          pre: ({ children }: { children?: ReactNode }) => (
            <pre className={styles.pre}>{children}</pre>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
