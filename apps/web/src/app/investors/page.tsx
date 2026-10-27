import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, type Column, Notes, Skeleton, Table } from "@/components/ui";
import { requireDataset } from "@/lib/data";
import { fmtCompact, fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "大佬持倉" };

export default function InvestorsPage() {
  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">大佬持倉（13F）</h1>
        <p className="mt-1 text-sm text-muted">
          管理資產超過 1 億美元的機構每季必須向 SEC
          申報美股持倉。點進去看每一季新建倉、加碼、減碼與清倉。
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <InvestorTable />
      </Suspense>
    </main>
  );
}

async function InvestorTable() {
  await connection();
  const result = await requireDataset("us.investors");
  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "name",
      label: "機構",
      render: (r) => (
        <Link href={`/investors/${r.slug}`} className="hover:text-accent">
          <span className="font-medium">{String(r.name)}</span>
          <span className="ml-1.5 text-muted">{String(r.manager ?? "")}</span>
        </Link>
      ),
    },
    { key: "latest_period", label: "最新一季", align: "right" },
    {
      key: "portfolio_value_usd",
      label: "申報市值",
      align: "right",
      render: (r) => fmtCompact(r.portfolio_value_usd, "$"),
    },
    { key: "positions", label: "持股數", align: "right", render: (r) => fmtNum(r.positions, 0) },
  ];
  return (
    <Card>
      <Table columns={columns} rows={result.rows} />
      <Notes
        notes={[
          "13F 在每季結束後 45 天內申報，持倉可能已是數個月前的狀態。",
          "只涵蓋美國上市股票與部分選擇權的多頭部位，看不到放空、現金與海外持股。",
        ]}
      />
    </Card>
  );
}
