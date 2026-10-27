import { TRACKED_INVESTORS } from "@alphascout/core/providers/sec";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AsOf, Card, type Column, Notes, Skeleton, Stat, Table } from "@/components/ui";
import { requireDataset } from "@/lib/data";
import { ACTION_LABELS, fmtCompact, fmtNum, fmtPct, trendClass } from "@/lib/format";

export function generateStaticParams() {
  return TRACKED_INVESTORS.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/investors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: TRACKED_INVESTORS.find((i) => i.slug === slug)?.name ?? "大佬持倉" };
}

export default function InvestorPage({ params }: PageProps<"/investors/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[36rem]" />}>
      <InvestorContent params={params} />
    </Suspense>
  );
}

async function InvestorContent({ params }: { params: PageProps<"/investors/[slug]">["params"] }) {
  const { slug } = await params;
  const investor = TRACKED_INVESTORS.find((i) => i.slug === slug);
  if (!investor) notFound();

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{investor.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {investor.manager} · SEC CIK {investor.cik}
          {investor.note ? ` · ${investor.note}` : ""}
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Moves slug={slug} />
      </Suspense>
    </main>
  );
}

const ORDER = ["new", "add", "trim", "exit", "hold"] as const;

async function Moves({ slug }: { slug: string }) {
  await connection();
  const result = await requireDataset("us.13f_changes", { investor: slug, limit: 500 });
  const rows = result.rows;
  const counts = Object.fromEntries(
    ORDER.map((a) => [a, rows.filter((r) => r.action === a).length]),
  );
  const held = rows.filter((r) => r.action !== "exit");
  const total = held.reduce((sum, r) => sum + Number(r.value_usd), 0);
  const top10 = [...held]
    .sort((a, b) => Number(b.weight_pct) - Number(a.weight_pct))
    .slice(0, 10)
    .reduce((sum, r) => sum + Number(r.weight_pct), 0);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "ticker",
      label: "標的",
      render: (r) => (
        <span>
          <span className="font-medium">{String(r.ticker ?? "—")}</span>
          <span className="ml-1.5 text-muted">{String(r.issuer ?? "")}</span>
          {r.put_call !== "none" && (
            <span className="ml-1.5 text-xs uppercase text-muted">{String(r.put_call)}</span>
          )}
        </span>
      ),
    },
    {
      key: "action",
      label: "動作",
      render: (r) => (
        <span
          className={
            r.action === "new" || r.action === "add"
              ? "text-up-western"
              : r.action === "hold"
                ? "text-muted"
                : "text-down-western"
          }
        >
          {ACTION_LABELS[String(r.action)]}
        </span>
      ),
    },
    {
      key: "shares_change_pct",
      label: "股數變化",
      align: "right",
      render: (r) => (
        <span className={trendClass(r.shares_change_pct, "western")}>
          {fmtPct(r.shares_change_pct, 1)}
        </span>
      ),
    },
    { key: "shares", label: "持股", align: "right", render: (r) => fmtCompact(r.shares) },
    {
      key: "value_usd",
      label: "市值",
      align: "right",
      render: (r) => fmtCompact(r.value_usd, "$"),
    },
    { key: "weight_pct", label: "權重", align: "right", render: (r) => `${fmtNum(r.weight_pct)}%` },
  ];

  const sections = ORDER.filter((a) => a !== "hold" && counts[a]).map((action) => ({
    action,
    rows: rows.filter((r) => r.action === action),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="申報季度" value={String(result.asOf)} />
        <Stat label="申報市值" value={fmtCompact(total, "$")} />
        <Stat label="前 10 大集中度" value={`${fmtNum(top10, 1)}%`} />
        <Stat label="新建倉" value={counts.new} />
        <Stat label="加碼 / 減碼" value={`${counts.add} / ${counts.trim}`} />
        <Stat label="清倉" value={counts.exit} />
      </div>
      {sections.map(({ action, rows: sectionRows }) => (
        <Card
          key={action}
          title={`${ACTION_LABELS[action]}（${sectionRows.length}）`}
          subtitle={<AsOf value={result.asOf} source="與前一季相比" />}
        >
          <Table columns={columns} rows={sectionRows} />
        </Card>
      ))}
      <Card title={`完整持倉（${held.length}）`} subtitle="依權重排序">
        <Table columns={columns} rows={held} />
        <Notes notes={result.notes} />
      </Card>
    </div>
  );
}
