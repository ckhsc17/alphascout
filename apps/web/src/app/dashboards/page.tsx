import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { GitHubSignInButton } from "@/components/auth-buttons";
import { Card, Skeleton } from "@/components/ui";
import { listOwnDashboards, listPublicDashboards } from "@/lib/dashboards";
import { getSessionUser } from "@/lib/session";
import { createDashboardAction } from "./actions";

export const metadata: Metadata = { title: "Dashboards" };

const VISIBILITY_LABELS = { private: "私人", unlisted: "連結分享", public: "公開" } as const;

export default function DashboardsPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
        <p className="mt-1 text-sm text-muted">
          跟你的 AI 說想看什麼，它會透過 MCP 幫你建好
          dashboard；也可以在這裡手動調整版面、分享或複製別人的 dashboard。
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Mine />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Community />
      </Suspense>
    </main>
  );
}

async function Mine() {
  await connection();
  const user = await getSessionUser();
  if (!user) {
    return (
      <Card title="我的 dashboards">
        <div className="py-4 text-center">
          <p className="mb-4 text-sm text-muted">登入後就能建立自己的 dashboard。</p>
          <GitHubSignInButton />
        </div>
      </Card>
    );
  }
  const mine = await listOwnDashboards(user.id);
  return (
    <Card
      title="我的 dashboards"
      subtitle={`${mine.length} 個`}
      action={
        <form action={createDashboardAction} className="flex shrink-0 gap-2">
          <input
            name="title"
            placeholder="新 dashboard 名稱"
            maxLength={120}
            className="w-40 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1 text-sm text-background"
          >
            建立
          </button>
        </form>
      }
    >
      {mine.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">
          還沒有 dashboard。可以在右上角建立空白的，或請你的 AI 透過{" "}
          <Link href="/mcp" className="text-accent underline underline-offset-2">
            MCP
          </Link>{" "}
          直接建好。
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {mine.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/d/${d.id}`} className="min-w-0 hover:text-accent">
                <span className="font-medium">{d.title}</span>
                {d.description && <span className="ml-2 truncate text-muted">{d.description}</span>}
              </Link>
              <span className="shrink-0 text-xs text-muted">
                {VISIBILITY_LABELS[d.visibility]} · {d.widgets} 個 widget ·{" "}
                {d.updatedAt.toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function Community() {
  await connection();
  const list = await listPublicDashboards();
  return (
    <Card title="社群 dashboards" subtitle="設為公開的 dashboard">
      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">目前還沒有公開的 dashboard。</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {list.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/d/${d.id}`} className="min-w-0 hover:text-accent">
                <span className="font-medium">{d.title}</span>
                {d.description && <span className="ml-2 truncate text-muted">{d.description}</span>}
              </Link>
              <span className="shrink-0 text-xs text-muted">
                {d.ownerName} · {d.updatedAt.toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
