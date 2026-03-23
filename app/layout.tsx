import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";

const notoSans = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AI 交互素养评估",
  description: "在自然对话中评估与 AI 协作解决问题的能力",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={notoSans.variable}>
      <body className={`${notoSans.className} min-h-screen antialiased`}>
        <div className="body-bg" aria-hidden="true">
          <span className="body-tech-grid" />
          <span className="bg-orb-3" />
        </div>
        <AppProviders>
          <div className="app-shell">{children}</div>
        </AppProviders>
      </body>
    </html>
  );
}
