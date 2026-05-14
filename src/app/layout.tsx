import type { Metadata } from "next";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-MBTI · 了解你的AI协作风格",
  description: "通过一场轻松的访谈，发现你与AI协作的独特风格",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AnalyticsTracker />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
