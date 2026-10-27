import type { Db } from "@alphascout/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { DatasetError, defineDataset, isoDate, type Row, round } from "./define.ts";

const TW_SOURCE = "TWSE / TPEx / MOPS / TDCC open data";
const LOT = 1000;

const twSymbol = z
  .string()
  .trim()
  .regex(/^[0-9A-Z]{4,6}$/, "Taiwan stock code, e.g. 2330");

export async function resolveTwSecurity(db: Db, symbol: string) {
  const rows = await db.execute<{ id: number; symbol: string; name: string }>(
    sql`select id, symbol, name from securities where market = 'TW' and symbol = ${symbol}`,
  );
  const security = rows[0];
  if (!security) {
    throw new DatasetError(
      `Unknown Taiwan stock "${symbol}". Use search_securities to find codes.`,
    );
  }
  return security;
}

export const twSearch = defineDataset({
  id: "tw.search",
  title: "Search Taiwan stocks",
  description: "Find TWSE / TPEx listed companies by code or (partial) name.",
  params: z.object({
    query: z.string().trim().min(1).describe("Code or name, e.g. 2330 or 台積"),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  example: { query: "台積" },
  source: TW_SOURCE,
  columns: {
    symbol: { type: "string", description: "Stock code" },
    name: { type: "string", description: "Short name" },
    board: { type: "string", description: "TWSE (上市) or TPEx (上櫃)" },
    industry: { type: "string", description: "Industry" },
  },
  async run(db, { query, limit }) {
    const like = `%${query}%`;
    const rows = await db.execute<Row>(sql`
      select symbol, name, board, industry from securities
      where market = 'TW' and is_active and (symbol like ${`${query}%`} or name like ${like})
      order by (symbol = ${query}) desc, length(symbol), symbol
      limit ${limit}`);
    return { asOf: null, rows: [...rows] };
  },
});

export const twPrices = defineDataset({
  id: "tw.prices",
  title: "Daily prices",
  description: "Daily OHLCV bars for one Taiwan stock, oldest first.",
  params: z.object({ symbol: twSymbol, days: z.number().int().min(1).max(500).default(120) }),
  example: { symbol: "2330", days: 60 },
  source: TW_SOURCE,
  columns: {
    date: { type: "date", description: "Trading date" },
    open: { type: "number", description: "Open", unit: "TWD" },
    high: { type: "number", description: "High", unit: "TWD" },
    low: { type: "number", description: "Low", unit: "TWD" },
    close: { type: "number", description: "Close", unit: "TWD" },
    volume_lots: { type: "number", description: "Volume", unit: "lots (1,000 shares)" },
  },
  async run(db, { symbol, days }) {
    const s = await resolveTwSecurity(db, symbol);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select * from (
        select date, open::float8, high::float8, low::float8, close::float8, volume
        from tw_daily_prices where security_id = ${s.id}
        order by date desc limit ${days}
      ) t order by date`);
    const out = rows.map((r) => ({
      date: isoDate(r.date),
      open: round(r.open),
      high: round(r.high),
      low: round(r.low),
      close: round(r.close),
      volume_lots: round(Number(r.volume) / LOT, 0),
    }));
    return { asOf: out.at(-1)?.date ?? null, rows: out };
  },
});

const SNAPSHOT_COLUMNS = {
  date: { type: "date", description: "Trading date" },
  close: { type: "number", description: "Close", unit: "TWD" },
  change_pct: { type: "number", description: "Daily change", unit: "%" },
  sma5: { type: "number", description: "5-day simple moving average", unit: "TWD" },
  sma20: { type: "number", description: "20-day SMA (月線)", unit: "TWD" },
  sma60: { type: "number", description: "60-day SMA (季線)", unit: "TWD" },
  sma120: { type: "number", description: "120-day SMA (半年線)", unit: "TWD" },
  rsi14: { type: "number", description: "14-day RSI (Wilder)" },
  macd: { type: "number", description: "MACD line (12, 26)" },
  macd_signal: { type: "number", description: "MACD signal (9)" },
  macd_hist: { type: "number", description: "MACD histogram" },
  bb_upper: { type: "number", description: "Bollinger upper band (20, 2σ)", unit: "TWD" },
  bb_lower: { type: "number", description: "Bollinger lower band (20, 2σ)", unit: "TWD" },
  atr14: { type: "number", description: "14-day Average True Range", unit: "TWD" },
  avg_volume_20d_lots: {
    type: "number",
    description: "Average volume of the previous 20 sessions",
    unit: "lots",
  },
  volume_ratio: { type: "number", description: "Today's volume ÷ 20-day average volume" },
  high_52w: { type: "number", description: "52-week high", unit: "TWD" },
  low_52w: { type: "number", description: "52-week low", unit: "TWD" },
  foreign_streak: {
    type: "number",
    description: "Consecutive days of foreign net buying (+) or selling (−)",
  },
  trust_streak: {
    type: "number",
    description: "Consecutive days of investment-trust (投信) net buying (+) or selling (−)",
  },
  dealer_streak: {
    type: "number",
    description: "Consecutive days of dealer net buying (+) or selling (−)",
  },
  major_holder_pct: {
    type: "number",
    description: "Share of depository shares held by 1,000+ lot holders (千張大戶)",
    unit: "%",
  },
  major_holder_change_4w: {
    type: "number",
    description: "Change in major-holder share vs. ~4 weeks earlier",
    unit: "percentage points",
  },
  revenue_yoy: {
    type: "number",
    description: "YoY growth of the latest published monthly revenue",
    unit: "%",
  },
  margin_balance_lots: {
    type: "number",
    description: "Margin-loan balance (融資餘額)",
    unit: "lots",
  },
  margin_change_5d: {
    type: "number",
    description: "Change in margin-loan balance vs. 5 sessions earlier",
    unit: "%",
  },
  short_margin_ratio: { type: "number", description: "Short ÷ margin balance (券資比)", unit: "%" },
  foreign_holding_pct: {
    type: "number",
    description: "Share of outstanding shares held by foreign investors",
    unit: "%",
  },
  foreign_holding_change_20d: {
    type: "number",
    description: "Change in foreign holding ratio vs. 20 sessions earlier",
    unit: "percentage points",
  },
  day_trade_pct: { type: "number", description: "Day-trade share of volume (當沖比)", unit: "%" },
} as const;

/** SQL select list for snapshot columns, aliased to dataset column names. */
export const SNAPSHOT_SELECT = sql.raw(`
  s.date, s.close, s.change_pct, s.sma5, s.sma20, s.sma60, s.sma120, s.rsi14,
  s.macd, s.macd_signal, s.macd_hist, s.bb_upper, s.bb_lower, s.atr14,
  s.avg_volume20d / 1000 as avg_volume_20d_lots, s.volume_ratio, s.high52w as high_52w,
  s.low52w as low_52w, s.foreign_net_buy_streak as foreign_streak,
  s.trust_net_buy_streak as trust_streak, s.dealer_net_buy_streak as dealer_streak,
  s.major_holder_pct, s.major_holder_pct_change4w as major_holder_change_4w, s.revenue_yoy,
  s.margin_balance as margin_balance_lots, s.margin_change5d as margin_change_5d,
  s.short_margin_ratio, s.foreign_holding_pct,
  s.foreign_holding_change20d as foreign_holding_change_20d, s.day_trade_pct`);

export function formatSnapshotRow(r: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [key, spec] of Object.entries(SNAPSHOT_COLUMNS)) {
    const v = r[key];
    out[key] =
      spec.type === "date"
        ? isoDate(v)
        : key.endsWith("streak") || key.endsWith("_lots")
          ? (v as number | null)
          : round(v);
  }
  return out;
}

export const twTechnicals = defineDataset({
  id: "tw.technicals",
  title: "Indicator snapshots",
  description:
    "Daily technical, flow, major-holder and revenue indicators for one Taiwan stock, oldest first. Use days=1 for the latest snapshot.",
  params: z.object({ symbol: twSymbol, days: z.number().int().min(1).max(250).default(1) }),
  example: { symbol: "2330", days: 1 },
  source: TW_SOURCE,
  columns: SNAPSHOT_COLUMNS,
  async run(db, { symbol, days }) {
    const sec = await resolveTwSecurity(db, symbol);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select * from (
        select ${SNAPSHOT_SELECT} from tw_indicator_snapshots s
        where s.security_id = ${sec.id} order by s.date desc limit ${days}
      ) t order by date`);
    const out = rows.map(formatSnapshotRow);
    return { asOf: (out.at(-1)?.date as string | undefined) ?? null, rows: out };
  },
});

export const twInstitutionalFlows = defineDataset({
  id: "tw.institutional_flows",
  title: "Institutional flows (三大法人)",
  description: "Daily net buying / selling by foreign investors, investment trusts and dealers.",
  params: z.object({ symbol: twSymbol, days: z.number().int().min(1).max(250).default(20) }),
  example: { symbol: "2330", days: 20 },
  source: TW_SOURCE,
  columns: {
    date: { type: "date", description: "Trading date" },
    foreign_net_lots: {
      type: "number",
      description: "Foreign net buy (+) / sell (−)",
      unit: "lots",
    },
    trust_net_lots: { type: "number", description: "Investment trust net", unit: "lots" },
    dealer_net_lots: { type: "number", description: "Dealer net", unit: "lots" },
    total_net_lots: { type: "number", description: "Sum of the three", unit: "lots" },
  },
  async run(db, { symbol, days }) {
    const s = await resolveTwSecurity(db, symbol);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select * from (
        select date, foreign_net, trust_net, dealer_net from tw_institutional_flows
        where security_id = ${s.id} order by date desc limit ${days}
      ) t order by date`);
    const out = rows.map((r) => {
      const f = Number(r.foreign_net);
      const t = Number(r.trust_net);
      const d = Number(r.dealer_net);
      return {
        date: isoDate(r.date),
        foreign_net_lots: round(f / LOT, 0),
        trust_net_lots: round(t / LOT, 0),
        dealer_net_lots: round(d / LOT, 0),
        total_net_lots: round((f + t + d) / LOT, 0),
      };
    });
    return { asOf: out.at(-1)?.date ?? null, rows: out };
  },
});

export const twChips = defineDataset({
  id: "tw.chips",
  title: "Margin, foreign holding & day trading (融資融券・外資持股・當沖)",
  description:
    "Daily margin-loan and short balances, foreign holding ratio and day-trade share for one Taiwan stock, oldest first.",
  params: z.object({ symbol: twSymbol, days: z.number().int().min(1).max(250).default(20) }),
  example: { symbol: "2330", days: 20 },
  source: TW_SOURCE,
  notes: ["History starts 2026-04; earlier dates are not loaded."],
  columns: {
    date: { type: "date", description: "Trading date" },
    margin_balance_lots: {
      type: "number",
      description: "Margin-loan balance (融資餘額)",
      unit: "lots",
    },
    margin_change_lots: {
      type: "number",
      description: "Change in margin-loan balance vs. the previous session",
      unit: "lots",
    },
    short_balance_lots: { type: "number", description: "Short balance (融券餘額)", unit: "lots" },
    short_margin_ratio: {
      type: "number",
      description: "Short ÷ margin balance (券資比)",
      unit: "%",
    },
    foreign_holding_pct: {
      type: "number",
      description: "Share of outstanding shares held by foreign investors",
      unit: "%",
    },
    day_trade_pct: { type: "number", description: "Day-trade share of volume (當沖比)", unit: "%" },
  },
  async run(db, { symbol, days }) {
    const s = await resolveTwSecurity(db, symbol);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select * from (
        select c.date, c.margin_balance, c.short_balance, c.foreign_holding_pct,
          c.day_trade_volume, p.volume,
          c.margin_balance - lag(c.margin_balance) over (order by c.date) as margin_change
        from tw_daily_chips c
        left join tw_daily_prices p on p.security_id = c.security_id and p.date = c.date
        where c.security_id = ${s.id}
        order by c.date desc limit ${days + 1}
      ) t order by date`);
    // One extra row was fetched so the first returned row has a previous-day change.
    const out = rows.slice(rows.length > days ? 1 : 0).map((r) => {
      const margin = r.margin_balance == null ? null : Number(r.margin_balance);
      const short = r.short_balance == null ? null : Number(r.short_balance);
      const volume = Number(r.volume ?? 0);
      return {
        date: isoDate(r.date),
        margin_balance_lots: margin,
        margin_change_lots: r.margin_change == null ? null : Number(r.margin_change),
        short_balance_lots: short,
        short_margin_ratio: margin && short != null ? round((short / margin) * 100) : null,
        foreign_holding_pct: round(r.foreign_holding_pct),
        day_trade_pct:
          r.day_trade_volume != null && volume > 0
            ? round((Number(r.day_trade_volume) / volume) * 100)
            : null,
      };
    });
    return { asOf: out.at(-1)?.date ?? null, rows: out };
  },
});

export const twMajorHolders = defineDataset({
  id: "tw.major_holders",
  title: "Major holders (千張大戶)",
  description: "Weekly TDCC shareholding by holders of 1,000+ lots, oldest first.",
  params: z.object({ symbol: twSymbol, weeks: z.number().int().min(1).max(104).default(12) }),
  example: { symbol: "2330", weeks: 12 },
  source: "TDCC open data (集保戶股權分散表)",
  notes: ["TDCC publishes only the latest week; history accumulates from 2026-10 onward."],
  columns: {
    week_date: { type: "date", description: "Data date of the weekly report" },
    holders: { type: "number", description: "Number of 1,000+ lot holders" },
    pct: { type: "number", description: "Share of depository shares they hold", unit: "%" },
    total_holders: { type: "number", description: "Total number of holders" },
  },
  async run(db, { symbol, weeks }) {
    const s = await resolveTwSecurity(db, symbol);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select * from (
        select m.week_date, m.holders, m.pct, t.holders as total_holders
        from tw_shareholding_dist m
        left join tw_shareholding_dist t
          on t.security_id = m.security_id and t.week_date = m.week_date and t.tier = 17
        where m.security_id = ${s.id} and m.tier = 15
        order by m.week_date desc limit ${weeks}
      ) x order by week_date`);
    const out = rows.map((r) => ({
      week_date: isoDate(r.week_date),
      holders: Number(r.holders),
      pct: round(r.pct),
      total_holders: r.total_holders == null ? null : Number(r.total_holders),
    }));
    return { asOf: out.at(-1)?.week_date ?? null, rows: out };
  },
});

export const twMonthlyRevenue = defineDataset({
  id: "tw.monthly_revenue",
  title: "Monthly revenue",
  description: "Monthly revenue with MoM and YoY growth, oldest first.",
  params: z.object({ symbol: twSymbol, months: z.number().int().min(1).max(36).default(12) }),
  example: { symbol: "2330", months: 12 },
  source: "MOPS (公開資訊觀測站)",
  columns: {
    month: { type: "string", description: "Reported month (YYYY-MM)" },
    revenue: { type: "number", description: "Revenue", unit: "thousand TWD" },
    mom: { type: "number", description: "Month-over-month change", unit: "%" },
    yoy: { type: "number", description: "Year-over-year change", unit: "%" },
  },
  async run(db, { symbol, months }) {
    const s = await resolveTwSecurity(db, symbol);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select * from (
        select month, revenue, mom, yoy from tw_monthly_revenue
        where security_id = ${s.id} order by month desc limit ${months}
      ) t order by month`);
    const out = rows.map((r) => ({
      month: isoDate(r.month)?.slice(0, 7) ?? null,
      revenue: Number(r.revenue),
      mom: round(r.mom),
      yoy: round(r.yoy),
    }));
    return { asOf: out.at(-1)?.month ?? null, rows: out };
  },
});

export const twInsiderTransfers = defineDataset({
  id: "tw.insider_transfers",
  title: "Insider transfer filings (內部人持股轉讓申報)",
  description:
    "Pre-filed insider share transfers (intent to sell or gift), newest first. Omit symbol for the whole market.",
  params: z.object({
    symbol: twSymbol.optional(),
    days: z.number().int().min(1).max(365).default(30),
  }),
  example: { days: 7 },
  source: "TWSE / TPEx open data",
  notes: ["Only the latest daily report is published; history accumulates from 2026-10 onward."],
  columns: {
    reported_on: { type: "date", description: "Filing date" },
    symbol: { type: "string", description: "Stock code" },
    name: { type: "string", description: "Company" },
    insider_name: { type: "string", description: "Insider" },
    role: { type: "string", description: "Relationship, e.g. 董事本人" },
    method: { type: "string", description: "Transfer method" },
    lots: { type: "number", description: "Shares to transfer", unit: "lots" },
  },
  async run(db, { symbol, days }) {
    const sec = symbol ? await resolveTwSecurity(db, symbol) : null;
    const rows = await db.execute<Record<string, unknown>>(sql`
      select i.reported_on, s.symbol, s.name, i.insider_name, i.role, i.method, i.shares
      from tw_insider_transfers i join securities s on s.id = i.security_id
      where i.reported_on >= current_date - ${days}::int
        ${sec ? sql`and i.security_id = ${sec.id}` : sql``}
      order by i.reported_on desc, i.shares desc limit 200`);
    const out = rows.map((r) => ({
      reported_on: isoDate(r.reported_on),
      symbol: r.symbol as string,
      name: r.name as string,
      insider_name: r.insider_name as string,
      role: (r.role as string | null) ?? null,
      method: (r.method as string | null) ?? null,
      lots: round(Number(r.shares) / LOT, 0),
    }));
    return { asOf: out[0]?.reported_on ?? null, rows: out };
  },
});
