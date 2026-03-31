import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human-AI Performance Lab",
  description: "固定双场景连续测评系统（V3）",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-lab-bg text-lab-fg antialiased">{children}</body>
    </html>
  );
}
