import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human-AI 协作原型",
  description: "双任务协作流程原型（内测体验）",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-lab-bg text-lab-fg antialiased">{children}</body>
    </html>
  );
}
