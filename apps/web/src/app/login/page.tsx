import type { Metadata } from "next";
import { GitHubSignInButton } from "@/components/auth-buttons";

export const metadata: Metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">登入 AlphaScout</h1>
      <p className="mt-2 text-sm text-muted">
        登入後可以建立自己的 dashboard，也能讓你的 AI 透過 MCP 幫你建立與修改。我們只讀取你 GitHub
        的公開名稱、頭像與 email。
      </p>
      <div className="mt-8">
        <GitHubSignInButton />
      </div>
    </main>
  );
}
