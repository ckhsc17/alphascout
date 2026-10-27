import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** 13F filers we track (Berkshire, Scion, Bridgewater, …). */
export const usInvestors = pgTable("us_investors", {
  cik: text().primaryKey(),
  name: text().notNull(),
  manager: text(),
  slug: text().notNull().unique(),
  isFeatured: boolean().notNull().default(false),
});

export const us13fFilings = pgTable(
  "us_13f_filings",
  {
    accessionNo: text().primaryKey(),
    cik: text()
      .notNull()
      .references(() => usInvestors.cik),
    periodOfReport: date().notNull(),
    filedAt: timestamp({ withTimezone: true }).notNull(),
    formType: text().notNull(),
    isAmendment: boolean().notNull().default(false),
    /** Amendments either restate the whole filing or add new holdings. */
    amendmentType: text(),
    totalValue: bigint({ mode: "number" }),
  },
  (t) => [index().on(t.cik, t.periodOfReport)],
);

export const putCall = pgEnum("put_call", ["none", "put", "call"]);

export const us13fHoldings = pgTable(
  "us_13f_holdings",
  {
    accessionNo: text()
      .notNull()
      .references(() => us13fFilings.accessionNo, { onDelete: "cascade" }),
    cusip: text().notNull(),
    putCall: putCall().notNull().default("none"),
    issuer: text().notNull(),
    titleOfClass: text(),
    /** Market value in USD. */
    value: bigint({ mode: "number" }).notNull(),
    shares: bigint({ mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.accessionNo, t.cusip, t.putCall] })],
);

export const positionAction = pgEnum("position_action", ["new", "exit", "add", "trim", "hold"]);

/** Precomputed quarter-over-quarter position changes per investor. */
export const us13fChanges = pgTable(
  "us_13f_changes",
  {
    cik: text()
      .notNull()
      .references(() => usInvestors.cik),
    period: date().notNull(),
    cusip: text().notNull(),
    putCall: putCall().notNull().default("none"),
    action: positionAction().notNull(),
    shares: bigint({ mode: "number" }).notNull(),
    prevShares: bigint({ mode: "number" }).notNull(),
    sharesChangePct: doublePrecision(),
    value: bigint({ mode: "number" }).notNull(),
    /** Share of the portfolio's total reported value, 0–1. */
    weight: doublePrecision().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cik, t.period, t.cusip, t.putCall] }),
    index().on(t.period, t.cusip),
  ],
);

/** 13F reports CUSIPs only; this maps them to tickers (via OpenFIGI). */
export const cusipMap = pgTable("cusip_map", {
  cusip: text().primaryKey(),
  ticker: text(),
  figi: text(),
  name: text(),
  source: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Non-derivative transactions from Form 4 filings. */
export const usInsiderTrades = pgTable(
  "us_insider_trades",
  {
    accessionNo: text().notNull(),
    line: integer().notNull(),
    issuerCik: text().notNull(),
    ticker: text(),
    insiderCik: text().notNull(),
    insiderName: text().notNull(),
    isDirector: boolean().notNull().default(false),
    isOfficer: boolean().notNull().default(false),
    isTenPercentOwner: boolean().notNull().default(false),
    officerTitle: text(),
    transactionDate: date().notNull(),
    /** SEC transaction code: P = open-market purchase, S = sale, A = grant, M = option exercise, … */
    code: text().notNull(),
    acquired: boolean().notNull(),
    shares: doublePrecision().notNull(),
    price: doublePrecision(),
    sharesOwnedAfter: doublePrecision(),
    filedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.accessionNo, t.line] }),
    index().on(t.issuerCik, t.transactionDate),
    index().on(t.transactionDate).where(sql`${t.code} = 'P'`),
  ],
);
