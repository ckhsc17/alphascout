import { eq, or, schema } from "@alphascout/db";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConsentButtons } from "@/components/auth-buttons";
import { Skeleton } from "@/components/ui";
import { getWriteDb } from "@/lib/db";

export const metadata: Metadata = { title: "授權" };

const SCOPE_LABELS: Record<string, string> = {
  openid: "確認你的身分",
  profile: "讀取你的名稱與頭像",
  email: "讀取你的 email",
  offline_access: "在你不在線時保持連線（refresh token）",
};

export default function ConsentPage({ searchParams }: PageProps<"/consent">) {
  return (
    <main className="mx-auto max-w-md py-16">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Consent({ searchParams }: { searchParams: PageProps<"/consent">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const clientId = typeof sp.client_id === "string" ? sp.client_id : "";
  const scopes = typeof sp.scope === "string" ? sp.scope.split(" ").filter(Boolean) : [];
  const [client] = clientId
    ? await getWriteDb()
        .select({ name: schema.oauthClient.name, uri: schema.oauthClient.uri })
        .from(schema.oauthClient)
        .where(
          or(
            eq(schema.oauthClient.clientId, clientId),
            eq(schema.oauthClient.clientDiscoveryId, clientId),
          ),
        )
    : [];
  const name = client?.name ?? hostOf(clientId) ?? "未知的應用程式";

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h1 className="text-lg font-semibold">{name} 想要連接你的 AlphaScout 帳號</h1>
      {client?.uri && <p className="mt-1 text-xs text-muted">{client.uri}</p>}
      <p className="mt-4 text-sm">允許後，這個 AI 工具可以：</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
        <li>查詢 AlphaScout 的所有公開資料</li>
        <li>讀取、建立、修改與刪除你的 dashboards</li>
        {scopes.map((s) => (SCOPE_LABELS[s] ? <li key={s}>{SCOPE_LABELS[s]}</li> : null))}
      </ul>
      <div className="mt-6">
        <ConsentButtons />
      </div>
      <p className="mt-4 text-xs text-muted">只有在你信任這個 AI 工具時才允許。</p>
    </div>
  );
}

function hostOf(clientId: string) {
  try {
    return new URL(clientId).host;
  } catch {
    return null;
  }
}
