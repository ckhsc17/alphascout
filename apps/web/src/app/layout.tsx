import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlphaScout",
  description: "AI-native 投資研究資料中心：台股籌碼、美股大佬持倉與內部人交易，支援 MCP。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-foreground/10 px-6 py-4 text-xs text-foreground/60">
          本站內容僅供研究與教育用途，不構成任何投資建議。投資有風險，請自行判斷。
        </footer>
      </body>
    </html>
  );
}
