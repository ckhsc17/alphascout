import type { WidgetSpec } from "@alphascout/core/dashboards";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { DashboardGrid } from "@/components/widgets/dashboard-grid";
import { WidgetView } from "@/components/widgets/widget-view";
import { getDashboard } from "@/lib/dashboards";
import { getSessionUser } from "@/lib/session";
import {
  deleteDashboardAction,
  forkDashboardAction,
  removeWidgetAction,
  saveLayoutAction,
  updateDashboardAction,
} from "./actions";

export const metadata: Metadata = { title: "Dashboard" };

const VISIBILITY_LABELS = {
  private: "私人",
  unlisted: "知道連結的人可看",
  public: "公開",
} as const;

export default function DashboardPage({ params }: PageProps<"/d/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <DashboardContent params={params} />
    </Suspense>
  );
}

async function DashboardContent({ params }: { params: PageProps<"/d/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const user = await getSessionUser();
  const dash = await getDashboard(id, user?.id);
  if (!dash) notFound();
  const isOwner = user?.id === dash.ownerId;

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{dash.title}</h1>
          {dash.description && <p className="mt-1 text-sm text-muted">{dash.description}</p>}
          <p className="mt-1 text-xs text-muted">
            {dash.ownerName ?? "匿名"} · {VISIBILITY_LABELS[dash.visibility]} · 更新於{" "}
            {dash.updatedAt.toISOString().slice(0, 10)}
            {dash.forkedFrom && (
              <>
                {" · 複製自 "}
                <Link href={`/d/${dash.forkedFrom}`} className="underline underline-offset-2">
                  {dash.forkedFrom}
                </Link>
              </>
            )}
          </p>
        </div>
        {!isOwner && (
          <form action={forkDashboardAction.bind(null, dash.id)}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface"
            >
              {user ? "複製到我的帳號" : "登入後複製"}
            </button>
          </form>
        )}
      </div>

      {isOwner && (
        <OwnerSettings
          id={dash.id}
          title={dash.title}
          description={dash.description}
          visibility={dash.visibility}
        />
      )}

      {dash.widgets.length === 0 ? (
        <EmptyState isOwner={isOwner} />
      ) : (
        <DashboardGrid
          editable={isOwner}
          onSaveLayout={isOwner ? saveLayoutAction.bind(null, dash.id) : undefined}
          items={dash.widgets.map((w) => ({
            id: w.id,
            ...w.position,
            node: (
              <WidgetFrame dashboardId={dash.id} widgetId={w.id} spec={w.spec} isOwner={isOwner} />
            ),
          }))}
        />
      )}
      <p className="text-xs text-muted">
        Widget
        存的是查詢條件而不是資料，每次打開都是最新數據。資料僅供研究與教育用途，不構成投資建議。
      </p>
    </main>
  );
}

function WidgetFrame({
  dashboardId,
  widgetId,
  spec,
  isOwner,
}: {
  dashboardId: string;
  widgetId: string;
  spec: WidgetSpec;
  isOwner: boolean;
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <header
        className={`widget-drag-handle flex items-center justify-between gap-2 border-b border-border px-3 py-2 ${isOwner ? "cursor-move" : ""}`}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{spec.title}</h2>
          {spec.description && <p className="truncate text-xs text-muted">{spec.description}</p>}
        </div>
        {isOwner && (
          <form action={removeWidgetAction.bind(null, dashboardId, widgetId)}>
            <button
              type="submit"
              title="移除 widget"
              className="widget-no-drag rounded px-1.5 text-muted hover:text-foreground"
            >
              ×
            </button>
          </form>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <Suspense
          fallback={<div className="h-full min-h-24 animate-pulse rounded bg-background" />}
        >
          <WidgetView spec={spec} />
        </Suspense>
      </div>
    </section>
  );
}

function OwnerSettings({
  id,
  title,
  description,
  visibility,
}: {
  id: string;
  title: string;
  description: string | null;
  visibility: keyof typeof VISIBILITY_LABELS;
}) {
  return (
    <details className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none text-muted">設定</summary>
      <form
        action={updateDashboardAction.bind(null, id)}
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
        <label className="grid gap-1">
          <span className="text-xs text-muted">名稱</span>
          <input
            name="title"
            defaultValue={title}
            maxLength={120}
            required
            className="rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted">誰可以看</span>
          <select
            name="visibility"
            defaultValue={visibility}
            className="rounded-md border border-border bg-background px-2 py-1.5"
          >
            {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 sm:col-span-2">
          <span className="text-xs text-muted">說明</span>
          <textarea
            name="description"
            defaultValue={description ?? ""}
            maxLength={1000}
            rows={2}
            className="rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <div className="flex items-center justify-between sm:col-span-2">
          <button type="submit" className="rounded-lg bg-foreground px-3 py-1.5 text-background">
            儲存
          </button>
        </div>
      </form>
      <form
        action={deleteDashboardAction.bind(null, id)}
        className="mt-4 border-t border-border pt-3"
      >
        <button type="submit" className="text-xs text-down-western hover:underline">
          刪除這個 dashboard（無法復原）
        </button>
      </form>
    </details>
  );
}

function EmptyState({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
      {isOwner ? (
        <>
          <p>這個 dashboard 還沒有 widget。</p>
          <p className="mt-2">
            把 AlphaScout 的帳號 MCP 加進你的 AI，然後說「幫我在這個 dashboard 加上…」。設定方式見{" "}
            <Link href="/mcp" className="text-accent underline underline-offset-2">
              MCP 說明
            </Link>
            。
          </p>
        </>
      ) : (
        <p>這個 dashboard 還沒有內容。</p>
      )}
    </div>
  );
}
