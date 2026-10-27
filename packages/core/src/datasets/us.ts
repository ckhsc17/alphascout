import type { Db } from "@alphascout/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { DatasetError, defineDataset, isoDate, type Row, round } from "./define.ts";

const SEC_SOURCE = "SEC EDGAR (13F-HR, Form 4); tickers via OpenFIGI";
const THIRTEEN_F_NOTES = [
  "13F filings are due 45 days after quarter end, so positions can be up to ~4.5 months old.",
  "13F covers US-listed long positions and listed options only — no shorts, cash or non-US holdings.",
];

const investorParam = z
  .string()
  .trim()
  .min(1)
  .describe("Investor slug (e.g. berkshire-hathaway) or SEC CIK. See us.investors.");

const periodParam = z
  .union([z.literal("latest"), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .default("latest")
  .describe('Quarter end date (YYYY-MM-DD) or "latest"');

async function resolveInvestor(db: Db, investor: string) {
  const cik = /^\d+$/.test(investor) ? investor.padStart(10, "0") : null;
  const rows = await db.execute<{ cik: string; name: string; slug: string }>(sql`
    select cik, name, slug from us_investors
    where slug = ${investor.toLowerCase()} ${cik ? sql`or cik = ${cik}` : sql``}`);
  const found = rows[0];
  if (!found) {
    throw new DatasetError(
      `Unknown investor "${investor}". Use the us.investors dataset for slugs.`,
    );
  }
  return found;
}

async function resolvePeriod(db: Db, cik: string, period: string): Promise<string> {
  if (period !== "latest") return period;
  const rows = await db.execute<{ period: unknown }>(sql`
    select max(period) as period from us_13f_changes where cik = ${cik}`);
  const latest = isoDate(rows[0]?.period);
  if (!latest) throw new DatasetError("No quarter-over-quarter data for this investor yet.");
  return latest;
}

/** The latest quarter that at least `minFilers` tracked investors have reported. */
async function latestCommonPeriod(db: Db, minFilers = 10): Promise<string> {
  const rows = await db.execute<{ period: unknown }>(sql`
    select period from us_13f_changes group by period
    having count(distinct cik) >= ${minFilers} order by period desc limit 1`);
  const p = isoDate(rows[0]?.period);
  if (!p) throw new DatasetError("No 13F data available yet.");
  return p;
}

export const usInvestors = defineDataset({
  id: "us.investors",
  title: "Tracked investors (13F filers)",
  description:
    "Well-known investors whose 13F filings are tracked, with their latest reported quarter.",
  params: z.object({ featured_only: z.boolean().default(false) }),
  example: {},
  source: SEC_SOURCE,
  columns: {
    slug: { type: "string", description: "Identifier used by other datasets" },
    name: { type: "string", description: "Filer" },
    manager: { type: "string", description: "Manager / known as" },
    cik: { type: "string", description: "SEC CIK" },
    latest_period: { type: "date", description: "Latest reported quarter end" },
    portfolio_value_usd: { type: "number", description: "Reported 13F value", unit: "USD" },
    positions: { type: "number", description: "Number of positions in the latest quarter" },
  },
  async run(db, { featured_only }) {
    const rows = await db.execute<Record<string, unknown>>(sql`
      select i.slug, i.name, i.manager, i.cik, f.period_of_report, f.total_value,
        (select count(*) from us_13f_holdings h where h.accession_no = f.accession_no) as positions
      from us_investors i
      left join lateral (
        select * from us_13f_filings f
        where f.cik = i.cik and not f.is_amendment
        order by f.period_of_report desc, f.filed_at desc limit 1
      ) f on true
      ${featured_only ? sql`where i.is_featured` : sql``}
      order by i.is_featured desc, f.total_value desc nulls last`);
    return {
      asOf: null,
      rows: rows.map((r) => ({
        slug: r.slug as string,
        name: r.name as string,
        manager: (r.manager as string | null) ?? null,
        cik: r.cik as string,
        latest_period: isoDate(r.period_of_report),
        portfolio_value_usd: r.total_value == null ? null : Number(r.total_value),
        positions: r.positions == null ? null : Number(r.positions),
      })),
    };
  },
});

const changeColumns = {
  ticker: { type: "string", description: "Ticker (null when unmapped)" },
  issuer: { type: "string", description: "Issuer name as filed" },
  cusip: { type: "string", description: "CUSIP" },
  put_call: { type: "string", description: "none / put / call" },
  action: { type: "string", description: "new / add / trim / exit / hold vs. previous quarter" },
  shares: { type: "number", description: "Shares held at quarter end" },
  shares_change_pct: { type: "number", description: "Change in shares", unit: "%" },
  value_usd: { type: "number", description: "Position value at quarter end", unit: "USD" },
  weight_pct: { type: "number", description: "Share of reported portfolio", unit: "%" },
} as const;

function formatChange(r: Record<string, unknown>): Row {
  return {
    ticker: (r.ticker as string | null) ?? null,
    issuer: (r.issuer as string | null) ?? null,
    cusip: r.cusip as string,
    put_call: r.put_call as string,
    action: r.action as string,
    shares: Number(r.shares),
    shares_change_pct: round(r.shares_change_pct, 1),
    value_usd: Number(r.value),
    weight_pct: round(Number(r.weight) * 100),
  };
}

const ISSUER = sql.raw(
  "(select h.issuer from us_13f_holdings h where h.cusip = c.cusip limit 1) as issuer",
);

export const us13fChanges = defineDataset({
  id: "us.13f_changes",
  title: "13F portfolio and quarter-over-quarter moves",
  description:
    "One investor's positions for a quarter with what changed vs. the previous quarter (new, add, trim, exit, hold). Sorted by portfolio weight; exits last.",
  params: z.object({
    investor: investorParam,
    period: periodParam,
    actions: z
      .array(z.enum(["new", "add", "trim", "exit", "hold"]))
      .optional()
      .describe('Only these actions, e.g. ["new","add"]'),
    limit: z.number().int().min(1).max(500).default(50),
  }),
  example: { investor: "berkshire-hathaway", actions: ["new", "add", "exit"] },
  source: SEC_SOURCE,
  notes: THIRTEEN_F_NOTES,
  columns: changeColumns,
  async run(db, { investor, period, actions, limit }) {
    const inv = await resolveInvestor(db, investor);
    const p = await resolvePeriod(db, inv.cik, period);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select m.ticker, ${ISSUER}, c.cusip, c.put_call, c.action, c.shares,
        c.shares_change_pct, c.value, c.weight
      from us_13f_changes c left join cusip_map m on m.cusip = c.cusip
      where c.cik = ${inv.cik} and c.period = ${p}
        ${
          actions?.length
            ? sql`and c.action in (${sql.join(
                actions.map((a) => sql`${a}`),
                sql`, `,
              )})`
            : sql``
        }
      order by (c.action = 'exit'), c.weight desc
      limit ${limit}`);
    return { asOf: p, rows: rows.map(formatChange) };
  },
});

export const us13fConsensus = defineDataset({
  id: "us.13f_consensus",
  title: "13F consensus",
  description:
    "Securities that several tracked investors bought (new or add) in the same quarter, or that the most of them hold.",
  params: z.object({
    period: periodParam,
    mode: z
      .enum(["buying", "holding"])
      .default("buying")
      .describe("buying = new/add that quarter; holding = held at quarter end"),
    min_investors: z.number().int().min(1).max(20).default(3),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  example: { mode: "buying", min_investors: 3 },
  source: SEC_SOURCE,
  notes: THIRTEEN_F_NOTES,
  columns: {
    ticker: { type: "string", description: "Ticker (null when unmapped)" },
    issuer: { type: "string", description: "Issuer name as filed" },
    investors: { type: "number", description: "Number of tracked investors" },
    investor_names: { type: "string", description: "Who, comma-separated" },
    total_value_usd: { type: "number", description: "Combined position value", unit: "USD" },
  },
  async run(db, { period, mode, min_investors, limit }) {
    const p = period === "latest" ? await latestCommonPeriod(db) : period;
    const actionFilter =
      mode === "buying" ? sql`c.action in ('new', 'add')` : sql`c.action <> 'exit'`;
    const rows = await db.execute<Record<string, unknown>>(sql`
      select m.ticker, min(${sql.raw("(select h.issuer from us_13f_holdings h where h.cusip = c.cusip limit 1)")}) as issuer,
        count(distinct c.cik) as investors,
        string_agg(distinct i.name, ', ') as investor_names,
        sum(c.value) as total_value
      from us_13f_changes c
      join us_investors i on i.cik = c.cik
      left join cusip_map m on m.cusip = c.cusip
      where c.period = ${p} and c.put_call = 'none' and ${actionFilter}
      group by coalesce(m.ticker, c.cusip), m.ticker
      having count(distinct c.cik) >= ${min_investors}
      order by investors desc, total_value desc
      limit ${limit}`);
    return {
      asOf: p,
      rows: rows.map((r) => ({
        ticker: (r.ticker as string | null) ?? null,
        issuer: (r.issuer as string | null) ?? null,
        investors: Number(r.investors),
        investor_names: r.investor_names as string,
        total_value_usd: Number(r.total_value),
      })),
    };
  },
});

const insiderColumns = {
  transaction_date: { type: "date", description: "Trade date" },
  ticker: { type: "string", description: "Issuer ticker" },
  insider: { type: "string", description: "Reporting insider" },
  role: { type: "string", description: "Director / officer title / 10% owner" },
  code: {
    type: "string",
    description:
      "P = open-market buy, S = open-market sale, A = grant, M = option exercise, F = tax",
  },
  shares: { type: "number", description: "Shares traded" },
  price: { type: "number", description: "Price per share", unit: "USD" },
  value_usd: { type: "number", description: "shares × price", unit: "USD" },
  planned_10b5_1: {
    type: "boolean",
    description: "Filed as under a pre-scheduled Rule 10b5-1 plan (weaker signal)",
  },
} as const;

function insiderRole(r: Record<string, unknown>): string {
  const parts: string[] = [];
  if (r.officer_title) parts.push(String(r.officer_title));
  else if (r.is_officer) parts.push("Officer");
  if (r.is_director) parts.push("Director");
  if (r.is_ten_percent_owner) parts.push("10% owner");
  return parts.join(", ") || "Other";
}

export const usInsiderTrades = defineDataset({
  id: "us.insider_trades",
  title: "Insider trades (Form 4)",
  description:
    "Non-derivative insider transactions, newest first. Defaults to open-market purchases (code P), the strongest signal.",
  params: z.object({
    ticker: z.string().trim().toUpperCase().optional(),
    codes: z.array(z.string().length(1)).default(["P"]),
    days: z.number().int().min(1).max(365).default(30),
    min_value_usd: z.number().min(0).default(0),
    exclude_10b5_1: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  example: { codes: ["P"], days: 14, min_value_usd: 100000 },
  source: SEC_SOURCE,
  notes: [
    "Related entities in a joint filing group can report the same trade separately.",
    "History starts 2026-09-28.",
  ],
  columns: insiderColumns,
  async run(db, { ticker, codes, days, min_value_usd, exclude_10b5_1, limit }) {
    const rows = await db.execute<Record<string, unknown>>(sql`
      select transaction_date, ticker, insider_name, officer_title, is_officer, is_director,
        is_ten_percent_owner, code, shares, price, shares * coalesce(price, 0) as value, is10b51_plan
      from us_insider_trades
      where transaction_date >= current_date - ${days}::int
        and code in (${sql.join(
          codes.map((c) => sql`${c}`),
          sql`, `,
        )})
        and shares * coalesce(price, 0) >= ${min_value_usd}
        ${ticker ? sql`and ticker = ${ticker}` : sql``}
        ${exclude_10b5_1 ? sql`and is10b51_plan is not true` : sql``}
      order by transaction_date desc, value desc
      limit ${limit}`);
    const out = rows.map((r) => ({
      transaction_date: isoDate(r.transaction_date),
      ticker: (r.ticker as string | null) ?? null,
      insider: r.insider_name as string,
      role: insiderRole(r),
      code: r.code as string,
      shares: round(r.shares, 0),
      price: round(r.price),
      value_usd: round(r.value, 0),
      planned_10b5_1: (r.is10b51_plan as boolean | null) ?? null,
    }));
    return { asOf: out[0]?.transaction_date ?? null, rows: out };
  },
});

export const usInsiderClusters = defineDataset({
  id: "us.insider_clusters",
  title: "Insider cluster buying",
  description:
    "Companies where several different insiders each bought a meaningful amount on the open market within the window — a classic bullish signal.",
  params: z.object({
    days: z.number().int().min(1).max(180).default(30),
    min_insiders: z.number().int().min(2).max(20).default(3),
    min_value_per_insider_usd: z
      .number()
      .min(0)
      .default(25000)
      .describe(
        "Ignore insiders who bought less than this in total (filters out employee stock plans)",
      ),
    exclude_10b5_1: z.boolean().default(true),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  example: { days: 30, min_insiders: 3 },
  source: SEC_SOURCE,
  notes: ["History starts 2026-09-28."],
  columns: {
    ticker: { type: "string", description: "Issuer ticker" },
    insiders: { type: "number", description: "Distinct insiders buying" },
    insider_names: { type: "string", description: "Who, comma-separated" },
    total_value_usd: { type: "number", description: "Total purchased", unit: "USD" },
    first_date: { type: "date", description: "First purchase in window" },
    last_date: { type: "date", description: "Latest purchase in window" },
  },
  async run(db, { days, min_insiders, min_value_per_insider_usd, exclude_10b5_1, limit }) {
    const rows = await db.execute<Record<string, unknown>>(sql`
      with per_insider as (
        select ticker, insider_cik, min(insider_name) as insider_name,
          sum(shares * coalesce(price, 0)) as value,
          min(transaction_date) as first_date, max(transaction_date) as last_date
        from us_insider_trades
        where code = 'P' and ticker is not null
          and transaction_date >= current_date - ${days}::int
          ${exclude_10b5_1 ? sql`and is10b51_plan is not true` : sql``}
        group by ticker, insider_cik
        having sum(shares * coalesce(price, 0)) >= ${min_value_per_insider_usd}
      )
      select ticker, count(*) as insiders,
        string_agg(insider_name, ', ' order by value desc) as insider_names,
        sum(value) as total_value, min(first_date) as first_date, max(last_date) as last_date
      from per_insider
      group by ticker
      having count(*) >= ${min_insiders}
      order by insiders desc, total_value desc
      limit ${limit}`);
    return {
      asOf: null,
      rows: rows.map((r) => ({
        ticker: r.ticker as string,
        insiders: Number(r.insiders),
        insider_names: r.insider_names as string,
        total_value_usd: round(r.total_value, 0),
        first_date: isoDate(r.first_date),
        last_date: isoDate(r.last_date),
      })),
    };
  },
});
