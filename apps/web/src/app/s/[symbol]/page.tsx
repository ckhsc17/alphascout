import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { type Bar, PriceChart } from "@/components/price-chart";
import { AsOf, Card, type Column, Notes, Skeleton, Stat, Table } from "@/components/ui";
import { loadDataset, requireDataset } from "@/lib/data";
import { fmtCompact, fmtNum, fmtPct, fmtSigned, trendClass } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/s/[symbol]">): Promise<Metadata> {
  const { symbol } = await params;
  return { title: decodeURIComponent(symbol).toUpperCase() };
}

export default function StockPage({ params }: PageProps<"/s/[symbol]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <StockContent params={params} />
    </Suspense>
  );
}

async function StockContent({ params }: { params: PageProps<"/s/[symbol]">["params"] }) {
  await connection();
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  const [search, technicals] = await Promise.all([
    requireDataset("tw.search", { query: symbol, limit: 1 }),
    requireDataset("tw.technicals", { symbol, days: 1 }),
  ]);
  const info = search.rows[0];
  const s = technicals.rows[0] ?? {};

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {symbol} <span className="text-muted">{String(info?.name ?? "")}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {String(info?.board ?? "")} · {String(info?.industry ?? "—")} ·{" "}
            <AsOf value={technicals.asOf} />
          </p>
        </div>
        <div className="tabular text-right">
          <div className="text-3xl font-semibold">{fmtNum(s.close)}</div>
          <div className={`text-sm ${trendClass(s.change_pct)}`}>{fmtPct(s.change_pct)}</div>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <Chart symbol={symbol} />
      </Suspense>

      <Card title="指標快照" subtitle="所有數字由 AlphaScout 依官方資料計算">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="20 日均線" value={fmtNum(s.sma20)} hint={relative(s.close, s.sma20)} />
          <Stat label="60 日均線" value={fmtNum(s.sma60)} hint={relative(s.close, s.sma60)} />
          <Stat label="RSI(14)" value={fmtNum(s.rsi14, 1)} />
          <Stat label="MACD 柱" value={fmtNum(s.macd_hist)} />
          <Stat
            label="量比"
            value={fmtNum(s.volume_ratio)}
            hint={`20 日均量 ${fmtNum(s.avg_volume_20d_lots, 0)} 張`}
          />
          <Stat label="52 週區間" value={`${fmtNum(s.low_52w)} – ${fmtNum(s.high_52w)}`} />
          <Stat label="外資連買" value={streak(s.foreign_streak)} />
          <Stat label="投信連買" value={streak(s.trust_streak)} />
          <Stat label="自營商連買" value={streak(s.dealer_streak)} />
          <Stat
            label="千張大戶持股"
            value={s.major_holder_pct == null ? "—" : `${fmtNum(s.major_holder_pct)}%`}
            hint={
              s.major_holder_change_4w == null
                ? "累積中"
                : `4 週 ${fmtSigned(s.major_holder_change_4w, 2)} pp`
            }
          />
          <Stat
            label="最新月營收 YoY"
            value={<span className={trendClass(s.revenue_yoy)}>{fmtPct(s.revenue_yoy)}</span>}
          />
          <Stat label="ATR(14)" value={fmtNum(s.atr14)} />
          <Stat
            label="外資持股"
            value={s.foreign_holding_pct == null ? "—" : `${fmtNum(s.foreign_holding_pct)}%`}
            hint={
              s.foreign_holding_change_20d == null
                ? undefined
                : `20 日 ${fmtSigned(s.foreign_holding_change_20d, 2)} pp`
            }
          />
          <Stat
            label="融資餘額"
            value={s.margin_balance_lots == null ? "—" : `${fmtNum(s.margin_balance_lots, 0)} 張`}
            hint={s.margin_change_5d == null ? undefined : `5 日 ${fmtPct(s.margin_change_5d)}`}
          />
          <Stat
            label="券資比"
            value={s.short_margin_ratio == null ? "—" : `${fmtNum(s.short_margin_ratio)}%`}
          />
          <Stat
            label="當沖比"
            value={s.day_trade_pct == null ? "—" : `${fmtNum(s.day_trade_pct, 1)}%`}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Flows symbol={symbol} />
        </Suspense>
        <div className="space-y-4">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Revenue symbol={symbol} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-40" />}>
            <MajorHolders symbol={symbol} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function relative(close: unknown, ma: unknown) {
  const c = Number(close);
  const m = Number(ma);
  if (!ma || !Number.isFinite(c) || !Number.isFinite(m) || m === 0) return undefined;
  return `股價${c >= m ? "在上方" : "在下方"} ${fmtPct(((c - m) / m) * 100, 1)}`;
}

function streak(v: unknown) {
  if (v == null) return "—";
  const n = Number(v);
  if (n === 0) return "持平";
  return <span className={trendClass(n)}>{n > 0 ? `連買 ${n} 天` : `連賣 ${-n} 天`}</span>;
}

async function Chart({ symbol }: { symbol: string }) {
  await connection();
  const prices = await requireDataset("tw.prices", { symbol, days: 250 });
  return (
    <Card title="日 K 線" subtitle="近一年 · 紅漲綠跌">
      <PriceChart bars={prices.rows as unknown as Bar[]} />
    </Card>
  );
}

async function Flows({ symbol }: { symbol: string }) {
  await connection();
  const flows = await requireDataset("tw.institutional_flows", { symbol, days: 20 });
  const rows = [...flows.rows].reverse();
  const cell = (key: string) => (r: Record<string, unknown>) => (
    <span className={trendClass(r[key])}>{fmtSigned(r[key])}</span>
  );
  const columns: Column<Record<string, unknown>>[] = [
    { key: "date", label: "日期" },
    { key: "foreign_net_lots", label: "外資", align: "right", render: cell("foreign_net_lots") },
    { key: "trust_net_lots", label: "投信", align: "right", render: cell("trust_net_lots") },
    { key: "dealer_net_lots", label: "自營商", align: "right", render: cell("dealer_net_lots") },
    { key: "total_net_lots", label: "合計", align: "right", render: cell("total_net_lots") },
  ];
  return (
    <Card title="三大法人買賣超（張）" subtitle={<AsOf value={flows.asOf} />}>
      <Table columns={columns} rows={rows} />
    </Card>
  );
}

async function Revenue({ symbol }: { symbol: string }) {
  await connection();
  const revenue = await requireDataset("tw.monthly_revenue", { symbol, months: 12 });
  const rows = [...revenue.rows].reverse();
  const columns: Column<Record<string, unknown>>[] = [
    { key: "month", label: "月份" },
    {
      key: "revenue",
      label: "營收（千元）",
      align: "right",
      render: (r) => fmtCompact(Number(r.revenue) * 1000),
    },
    {
      key: "mom",
      label: "MoM",
      align: "right",
      render: (r) => <span className={trendClass(r.mom)}>{fmtPct(r.mom, 1)}</span>,
    },
    {
      key: "yoy",
      label: "YoY",
      align: "right",
      render: (r) => <span className={trendClass(r.yoy)}>{fmtPct(r.yoy, 1)}</span>,
    },
  ];
  return (
    <Card title="月營收" subtitle={<AsOf value={revenue.asOf} source="公開資訊觀測站" />}>
      <Table columns={columns} rows={rows} />
    </Card>
  );
}

async function MajorHolders({ symbol }: { symbol: string }) {
  await connection();
  const loaded = await loadDataset("tw.major_holders", { symbol, weeks: 8 });
  if (!loaded.ok) return null;
  const { result } = loaded;
  const columns: Column<Record<string, unknown>>[] = [
    { key: "week_date", label: "週" },
    { key: "holders", label: "千張大戶人數", align: "right", render: (r) => fmtNum(r.holders, 0) },
    { key: "pct", label: "持股比例", align: "right", render: (r) => `${fmtNum(r.pct)}%` },
    {
      key: "total_holders",
      label: "總股東數",
      align: "right",
      render: (r) => fmtNum(r.total_holders, 0),
    },
  ];
  return (
    <Card title="千張大戶（集保）" subtitle={<AsOf value={result.asOf} source="集保結算所" />}>
      <Table columns={columns} rows={[...result.rows].reverse()} />
      <Notes notes={result.notes} />
    </Card>
  );
}
