import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { UserNav } from "@/components/user-nav";
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
  title: { default: "AlphaScout", template: "%s · AlphaScout" },
  description: "AI-native 投資研究資料中心：台股籌碼、美股大佬持倉與內部人交易，支援 MCP。",
};

const NAV = [
  { href: "/", label: "雷達" },
  { href: "/investors", label: "大佬持倉" },
  { href: "/insiders", label: "內部人交易" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/mcp", label: "MCP" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 py-3 text-sm">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-1.5 font-semibold tracking-tight"
            >
              <img src="/logo.svg" alt="" width={24} height={24} />
              AlphaScout
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 text-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-4">
              <a
                href="https://github.com/ckhsc17/alphascout"
                className="text-muted hover:text-foreground"
              >
                GitHub
              </a>
              <Suspense fallback={<span className="w-10" />}>
                <UserNav />
              </Suspense>
            </div>
          </nav>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
          本站內容僅供研究與教育用途，不構成任何投資建議。投資有風險，請自行判斷。資料來源：證交所、櫃買中心、公開資訊觀測站、集保結算所、SEC
          EDGAR。
        </footer>
      </body>
    </html>
  );
}
