import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AsOf, Card, type Column, Notes, Skeleton, Table } from "@/components/ui";
import { requireDataset } from "@/lib/data";
import { fmtCompact, fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "內部人交易" };

export default function InsidersPage({ searchParams }: PageProps<"/insiders">) {
  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">美股內部人交易（Form 4）</h1>
        <p className="mt-1 text-sm text-muted">
          董事、高管與 10% 大股東買賣自家股票必須在兩個工作天內申報。公開市場買進（代碼
          P）是用自己的錢押注公司，通常被視為最有意義的訊號。
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Trades searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Trades({ searchParams }: { searchParams: PageProps<"/insiders">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const ticker = typeof sp.ticker === "string" ? sp.ticker.toUpperCase() : undefined;
  const result = await requireDataset("us.insider_trades", {
    codes: ["P"],
    days: 30,
    min_value_usd: ticker ? 0 : 100000,
    limit: 100,
    ...(ticker ? { ticker } : {}),
  });

  const columns: Column<Record<string, unknown>>[] = [
    { key: "transaction_date", label: "交易日" },
    {
      key: "ticker",
      label: "公司",
      render: (r) => (
        <Link
          href={`/insiders?ticker=${encodeURIComponent(String(r.ticker))}`}
          className="font-medium hover:text-accent"
        >
          {String(r.ticker ?? "—")}
        </Link>
      ),
    },
    { key: "insider", label: "內部人" },
    {
      key: "role",
      label: "身分",
      render: (r) => <span className="text-muted">{String(r.role)}</span>,
    },
    { key: "shares", label: "股數", align: "right", render: (r) => fmtNum(r.shares, 0) },
    { key: "price", label: "價格", align: "right", render: (r) => `$${fmtNum(r.price)}` },
    {
      key: "value_usd",
      label: "金額",
      align: "right",
      render: (r) => fmtCompact(r.value_usd, "$"),
    },
    {
      key: "planned_10b5_1",
      label: "預排",
      align: "right",
      render: (r) => (r.planned_10b5_1 ? <span className="text-muted">10b5-1</span> : ""),
    },
  ];

  return (
    <Card
      title={
        ticker ? `${ticker} 近 30 天公開市場買進` : "近 30 天公開市場買進（單筆 10 萬美元以上）"
      }
      subtitle={<AsOf value={result.asOf} source="SEC EDGAR" />}
      action={
        ticker && (
          <Link href="/insiders" className="shrink-0 text-xs text-accent">
            看全部
          </Link>
        )
      }
    >
      <Table columns={columns} rows={result.rows} empty="沒有符合的交易" />
      <Notes
        notes={[...(result.notes ?? []), "標示 10b5-1 的交易是事先排定的計畫，訊號價值較低。"]}
      />
    </Card>
  );
}
