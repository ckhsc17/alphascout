import {
  bigint,
  bigserial,
  date,
  doublePrecision,
  integer,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
} from "drizzle-orm/pg-core";
import { securities } from "./common.ts";

const securityId = () =>
  bigint({ mode: "number" })
    .notNull()
    .references(() => securities.id, { onDelete: "cascade" });

const price = () => numeric({ precision: 12, scale: 2, mode: "number" });

export const twDailyPrices = pgTable(
  "tw_daily_prices",
  {
    securityId: securityId(),
    date: date().notNull(),
    open: price(),
    high: price(),
    low: price(),
    close: price(),
    /** Shares traded. */
    volume: bigint({ mode: "number" }).notNull(),
    /** Turnover in TWD. */
    turnover: bigint({ mode: "number" }),
    transactions: integer(),
  },
  (t) => [primaryKey({ columns: [t.securityId, t.date] })],
);

/** 三大法人買賣超, in shares. */
export const twInstitutionalFlows = pgTable(
  "tw_institutional_flows",
  {
    securityId: securityId(),
    date: date().notNull(),
    foreignNet: bigint({ mode: "number" }).notNull(),
    trustNet: bigint({ mode: "number" }).notNull(),
    dealerNet: bigint({ mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.securityId, t.date] })],
);

/**
 * Daily per-stock chip data beyond 三大法人: margin trading (融資融券), foreign holding ratio and
 * day-trading volume. Columns are nullable because each comes from a separate report.
 */
export const twDailyChips = pgTable(
  "tw_daily_chips",
  {
    securityId: securityId(),
    date: date().notNull(),
    /** 融資餘額, lots. */
    marginBalance: integer(),
    /** 融券餘額, lots. */
    shortBalance: integer(),
    /** 資券互抵, lots. */
    marginShortOffset: integer(),
    /** 外資及陸資持股比率, %. */
    foreignHoldingPct: real(),
    /** 當日沖銷交易成交股數, shares. */
    dayTradeVolume: bigint({ mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.securityId, t.date] })],
);

/** 集保戶股權分散表 (TDCC), weekly. One row per holding tier. */
export const twShareholdingDist = pgTable(
  "tw_shareholding_dist",
  {
    securityId: securityId(),
    weekDate: date().notNull(),
    /** TDCC tier number (1–15 are share ranges; 16 is the 差異數調整 row, 17 is the total). */
    tier: integer().notNull(),
    holders: integer().notNull(),
    shares: bigint({ mode: "number" }).notNull(),
    pct: doublePrecision().notNull(),
  },
  (t) => [primaryKey({ columns: [t.securityId, t.weekDate, t.tier] })],
);

export const twMonthlyRevenue = pgTable(
  "tw_monthly_revenue",
  {
    securityId: securityId(),
    /** First day of the reported month. */
    month: date().notNull(),
    /** Revenue in thousand TWD, as reported. */
    revenue: bigint({ mode: "number" }).notNull(),
    mom: doublePrecision(),
    yoy: doublePrecision(),
  },
  (t) => [primaryKey({ columns: [t.securityId, t.month] })],
);

/** 內部人持股轉讓事前申報 (MOPS). */
export const twInsiderTransfers = pgTable("tw_insider_transfers", {
  id: bigserial({ mode: "number" }).primaryKey(),
  securityId: securityId(),
  reportedOn: date().notNull(),
  insiderName: text().notNull(),
  /** e.g. 董事, 監察人, 經理人, 大股東. */
  role: text(),
  method: text(),
  shares: bigint({ mode: "number" }).notNull(),
  sourceKey: text().notNull().unique(),
});

/**
 * Denormalized per-day feature table. The screener queries only this table, so every
 * screenable field lives here as its own column.
 */
export const twIndicatorSnapshots = pgTable(
  "tw_indicator_snapshots",
  {
    securityId: securityId(),
    date: date().notNull(),
    close: doublePrecision(),
    changePct: doublePrecision(),
    sma5: doublePrecision(),
    sma20: doublePrecision(),
    sma60: doublePrecision(),
    sma120: doublePrecision(),
    rsi14: doublePrecision(),
    macd: doublePrecision(),
    macdSignal: doublePrecision(),
    macdHist: doublePrecision(),
    bbUpper: doublePrecision(),
    bbLower: doublePrecision(),
    atr14: doublePrecision(),
    avgVolume20d: doublePrecision(),
    volumeRatio: doublePrecision(),
    high52w: doublePrecision(),
    low52w: doublePrecision(),
    foreignNetBuyStreak: integer(),
    trustNetBuyStreak: integer(),
    dealerNetBuyStreak: integer(),
    majorHolderPct: doublePrecision(),
    majorHolderPctChange4w: doublePrecision(),
    revenueYoy: doublePrecision(),
    marginBalance: integer(),
    /** % change in 融資餘額 over 5 sessions. */
    marginChange5d: real(),
    /** 券資比: short balance ÷ margin balance, %. */
    shortMarginRatio: real(),
    foreignHoldingPct: real(),
    /** Change in foreign holding ratio over 20 sessions, percentage points. */
    foreignHoldingChange20d: real(),
    /** Day-trade volume ÷ total volume, %. */
    dayTradePct: real(),
  },
  (t) => [primaryKey({ columns: [t.securityId, t.date] })],
);
