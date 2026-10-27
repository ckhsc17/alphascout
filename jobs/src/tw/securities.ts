import {
  parseTpexCompanies,
  parseTwseCompanies,
  type TpexCompanyRow,
  type TwseCompanyRow,
  tpexUrls,
  twseUrls,
} from "@alphascout/core/providers/tw";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { fetchJson } from "../lib/http.ts";

/** Syncs the list of TWSE- and TPEx-listed companies. Delisted ones are marked inactive. */
export async function syncTwSecurities(db: Db): Promise<number> {
  const [listed, otc] = await Promise.all([
    fetchJson<TwseCompanyRow[]>(twseUrls.companies),
    fetchJson<TpexCompanyRow[]>(tpexUrls.companies),
  ]);
  const securities = [...parseTwseCompanies(listed), ...parseTpexCompanies(otc)];
  if (securities.length < 1000) {
    throw new Error(`only ${securities.length} TW securities returned; refusing to sync`);
  }

  await upsertRows(
    db,
    schema.securities,
    securities.map((s) => ({ market: "TW" as const, ...s, isActive: true, updatedAt: new Date() })),
    [schema.securities.market, schema.securities.symbol],
  );

  await db
    .update(schema.securities)
    .set({ isActive: false, updatedAt: sql`now()` })
    .where(
      and(
        eq(schema.securities.market, "TW"),
        notInArray(
          schema.securities.symbol,
          securities.map((s) => s.symbol),
        ),
      ),
    );

  return securities.length;
}

/** symbol → security id for active TW securities. */
export async function loadTwSecurityIds(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: schema.securities.id, symbol: schema.securities.symbol })
    .from(schema.securities)
    .where(and(eq(schema.securities.market, "TW"), eq(schema.securities.isActive, true)));
  return new Map(rows.map((r) => [r.symbol, r.id]));
}
