import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 交互素养评估原型",
  description: "在自然对话中评估与 Agent 协作解决问题的能力",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
