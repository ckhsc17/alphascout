import { SCREEN_PRESETS } from "@alphascout/core/screener";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AsOf, Card, Skeleton, StockLink } from "@/components/ui";
import { loadDataset } from "@/lib/data";
import { fmtCompact, fmtPct, trendClass } from "@/lib/format";

export default function Home() {
  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">今日雷達</h1>
        <p className="mt-1 text-sm text-muted">
          台股策略篩選、美股大佬動向與內部人買進。也可以用你自己的 AI 透過{" "}
          <Link href="/mcp" className="text-accent underline underline-offset-2">
            MCP
          </Link>{" "}
          直接查詢這些資料。
        </p>
        <Suspense fallback={<p className="mt-2 h-4 text-xs text-muted">載入資料狀態…</p>}>
          <Freshness />
        </Suspense>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">台股策略</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SCREEN_PRESETS.map((preset) => (
            <Suspense key={preset.slug} fallback={<Skeleton className="h-64" />}>
              <PresetCard slug={preset.slug} name={preset.name} description={preset.description} />
            </Suspense>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <ConsensusCard />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <InsiderClustersCard />
        </Suspense>
      </section>
    </main>
  );
}

async function Freshness() {
  await connection();
  const loaded = await loadDataset("meta.freshness");
  if (!loaded.ok) return null;
  const byJob = Object.fromEntries(loaded.result.rows.map((r) => [r.job, r.target]));
  return (
    <p className="mt-2 text-xs text-muted">
      台股資料至 {String(byJob["tw:daily"] ?? "—")} · 13F 至{" "}
      {String(byJob["us:13f"] ? "最新申報" : "—")} · Form 4 至 {String(byJob["us:form4"] ?? "—")}
    </p>
  );
}

async function PresetCard({
  slug,
  name,
  description,
}: {
  slug: string;
  name: string;
  description: string;
}) {
  await connection();
  const loaded = await loadDataset("tw.screen", { preset: slug });
  const rows = loaded.ok ? loaded.result.rows : [];
  return (
    <Card
      title={name}
      subtitle={description}
      action={
        <Link href={`/screens/${slug}`} className="shrink-0 text-xs text-accent">
          全部 {rows.length}
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">今天沒有符合的股票</p>
      ) : (
        <ul className="tabular space-y-2 text-sm">
          {rows.slice(0, 6).map((r) => (
            <li key={String(r.symbol)} className="flex items-center justify-between gap-2">
              <StockLink symbol={r.symbol} name={r.name} />
              <span className="flex gap-3">
                <span>{String(r.close)}</span>
                <span className={`w-16 text-right ${trendClass(r.change_pct)}`}>
                  {fmtPct(r.change_pct)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function ConsensusCard() {
  await connection();
  const loaded = await loadDataset("us.13f_consensus", {
    mode: "buying",
    min_investors: 3,
    limit: 12,
  });
  if (!loaded.ok) return null;
  const { result } = loaded;
  return (
    <Card
      title="大佬共識買進（13F）"
      subtitle={<AsOf value={result.asOf} source="至少 3 位追蹤中的大佬在同一季新建倉或加碼" />}
      action={
        <Link href="/investors" className="shrink-0 text-xs text-accent">
          大佬列表
        </Link>
      }
    >
      <ul className="tabular space-y-2.5 text-sm">
        {result.rows.map((r) => (
          <li key={String(r.ticker ?? r.issuer)}>
            <div className="flex items-baseline justify-between gap-2">
              <span>
                <span className="font-medium">{String(r.ticker ?? "—")}</span>
                <span className="ml-1.5 text-xs text-muted">{String(r.issuer ?? "")}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">
                {String(r.investors)} 位 · {fmtCompact(r.total_value_usd, "$")}
              </span>
            </div>
            <div className="truncate text-xs text-muted">{String(r.investor_names)}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function InsiderClustersCard() {
  await connection();
  const loaded = await loadDataset("us.insider_clusters", { days: 30, min_insiders: 3, limit: 12 });
  if (!loaded.ok) return null;
  const { result } = loaded;
  return (
    <Card
      title="內部人集體買進（Form 4）"
      subtitle="近 30 天，至少 3 位內部人各自在公開市場買進 2.5 萬美元以上，排除 10b5-1 預排交易"
      action={
        <Link href="/insiders" className="shrink-0 text-xs text-accent">
          所有交易
        </Link>
      }
    >
      {result.rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">近期沒有符合的公司</p>
      ) : (
        <ul className="tabular space-y-2.5 text-sm">
          {result.rows.map((r) => (
            <li key={String(r.ticker)}>
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/insiders?ticker=${encodeURIComponent(String(r.ticker))}`}
                  className="font-medium hover:text-accent"
                >
                  {String(r.ticker)}
                </Link>
                <span className="shrink-0 text-xs text-muted">
                  {String(r.insiders)} 位 · {fmtCompact(r.total_value_usd, "$")} · 最近{" "}
                  {String(r.last_date)}
                </span>
              </div>
              <div className="truncate text-xs text-muted">{String(r.insider_names)}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
