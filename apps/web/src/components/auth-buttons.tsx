"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function GitHubSignInButton({ callbackURL = "/dashboards" }: { callbackURL?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // When this page was reached from an MCP authorization request, the OAuth provider
        // client plugin attaches the signed query so the flow resumes after GitHub.
        await authClient.signIn.social({ provider: "github", callbackURL });
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      {pending ? "前往 GitHub…" : "使用 GitHub 登入"}
    </button>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
      className="text-muted hover:text-foreground"
    >
      登出
    </button>
  );
}

export function ConsentButtons() {
  const [pending, setPending] = useState<"accept" | "deny" | null>(null);
  const decide = async (accept: boolean) => {
    setPending(accept ? "accept" : "deny");
    const res = await authClient.oauth2.consent({ accept });
    const url =
      (res.data as { url?: string; redirect_uri?: string } | null)?.url ??
      (res.data as { redirect_uri?: string } | null)?.redirect_uri;
    if (url) window.location.href = url;
    else setPending(null);
  };
  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => decide(true)}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending === "accept" ? "授權中…" : "允許"}
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => decide(false)}
        className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-60"
      >
        拒絕
      </button>
    </div>
  );
}
