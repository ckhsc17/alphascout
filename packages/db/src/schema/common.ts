import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const market = pgEnum("market", ["TW", "US"]);

/** Every tradable security we know about, across markets. */
export const securities = pgTable(
  "securities",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    market: market().notNull(),
    symbol: text().notNull(),
    name: text().notNull(),
    /** TW: TWSE (上市) / TPEx (上櫃) / ESB (興櫃). US: exchange code. */
    board: text(),
    industry: text(),
    /** US only: SEC Central Index Key of the issuer. */
    cik: text(),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.market, t.symbol), index().on(t.cik).where(sql`${t.cik} is not null`)],
);

export const ingestStatus = pgEnum("ingest_status", ["running", "succeeded", "failed"]);

/** One row per job execution; drives the data-freshness indicator on the site. */
export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    job: text().notNull(),
    /** The market date / period the run covered, e.g. "2026-10-27" or "2026Q3". */
    target: text(),
    status: ingestStatus().notNull().default("running"),
    rows: integer(),
    error: text(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.job, t.startedAt)],
);
