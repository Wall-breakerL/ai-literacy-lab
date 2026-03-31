import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human-AI 协作测评",
  description: "固定双任务的人机协作测评流程",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-lab-bg text-lab-fg antialiased">{children}</body>
    </html>
  );
}
