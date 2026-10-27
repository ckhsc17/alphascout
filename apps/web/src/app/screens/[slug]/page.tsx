import { NUMERIC_FIELDS, SCREEN_PRESETS } from "@alphascout/core/screener";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AsOf, Card, type Column, Skeleton, StockLink, Table } from "@/components/ui";
import { requireDataset } from "@/lib/data";
import { fmtNum, fmtPct, trendClass } from "@/lib/format";

export function generateStaticParams() {
  return SCREEN_PRESETS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/screens/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: SCREEN_PRESETS.find((p) => p.slug === slug)?.name ?? "策略" };
}

export default function ScreenPage({ params }: PageProps<"/screens/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      <ScreenContent params={params} />
    </Suspense>
  );
}

async function ScreenContent({ params }: { params: PageProps<"/screens/[slug]">["params"] }) {
  const { slug } = await params;
  const preset = SCREEN_PRESETS.find((p) => p.slug === slug);
  if (!preset) notFound();

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{preset.name}</h1>
        <p className="mt-1 text-sm text-muted">{preset.description}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Results slug={slug} />
      </Suspense>
      <Card
        title="篩選條件（JSON）"
        subtitle="可以貼給你的 AI 修改，再用 MCP 的 screen_tw_stocks 執行"
      >
        <pre className="overflow-x-auto text-xs">{JSON.stringify(preset.screen, null, 2)}</pre>
      </Card>
    </main>
  );
}

const BASE_KEYS = new Set(["symbol", "name", "board", "industry", "close", "change_pct"]);

async function Results({ slug }: { slug: string }) {
  await connection();
  const result = await requireDataset("tw.screen", { preset: slug });
  const extraKeys = Object.keys(result.rows[0] ?? {}).filter((k) => !BASE_KEYS.has(k));

  const columns: Column<Record<string, unknown>>[] = [
    { key: "symbol", label: "股票", render: (r) => <StockLink symbol={r.symbol} name={r.name} /> },
    {
      key: "industry",
      label: "產業",
      render: (r) => <span className="text-muted">{String(r.industry ?? "—")}</span>,
    },
    { key: "close", label: "收盤", align: "right", render: (r) => fmtNum(r.close) },
    {
      key: "change_pct",
      label: "漲跌",
      align: "right",
      render: (r) => <span className={trendClass(r.change_pct)}>{fmtPct(r.change_pct)}</span>,
    },
    ...extraKeys.map((k) => ({
      key: k,
      label: NUMERIC_FIELDS[k as keyof typeof NUMERIC_FIELDS]?.description ?? k,
      align: "right" as const,
      render: (r: Record<string, unknown>) => fmtNum(r[k]),
    })),
  ];

  return (
    <Card title={`${result.rows.length} 檔符合`} subtitle={<AsOf value={result.asOf} />}>
      <Table columns={columns} rows={result.rows} empty="今天沒有符合的股票" />
    </Card>
  );
}
