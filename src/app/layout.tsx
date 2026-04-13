import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-MBTI · 了解你的AI协作风格",
  description: "通过一场轻松的访谈，发现你与AI协作的独特风格",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
