import {
  isoToCompactDate,
  isoToSlashDate,
  parseDayTrades,
  parseTpexForeignHolding,
  parseTpexMargin,
  parseTwseForeignHolding,
  parseTwseMargin,
  type TpexResponse,
  type TwseChipsResponse,
  tpexChipUrls,
  twseChipUrls,
} from "@alphascout/core/providers/tw";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { fetchJson } from "../lib/http.ts";

type ChipRow = typeof schema.twDailyChips.$inferInsert;

/**
 * Stores margin balances, foreign holding ratios and day-trade volume for one trading day.
 * Call it only for dates that had a session: every report must have data, otherwise it throws
 * so a half-published day is retried instead of stored with gaps.
 */
export async function ingestTwChips(
  db: Db,
  date: string,
  securityIds: Map<string, number>,
): Promise<number> {
  const compact = isoToCompactDate(date);
  const slash = isoToSlashDate(date);

  const reports = {
    twseMargin: parseTwseMargin(await fetchJson<TwseChipsResponse>(twseChipUrls.margin(compact))),
    twseForeign: parseTwseForeignHolding(
      await fetchJson<TwseChipsResponse>(twseChipUrls.foreignHolding(compact)),
    ),
    twseDayTrade: parseDayTrades(
      await fetchJson<TwseChipsResponse>(twseChipUrls.dayTrade(compact)),
    ),
    tpexMargin: parseTpexMargin(await fetchJson<TpexResponse>(tpexChipUrls.margin(slash))),
    tpexForeign: parseTpexForeignHolding(
      await fetchJson<TpexResponse>(tpexChipUrls.foreignHolding(slash)),
    ),
    tpexDayTrade: parseDayTrades(await fetchJson<TpexResponse>(tpexChipUrls.dayTrade(slash))),
  };

  for (const [name, rows] of Object.entries(reports)) {
    if (rows.length === 0) throw new Error(`${name} has no rows for ${date}`);
    if (rows[0]?.date !== date) throw new Error(`${name}: expected ${date}, got ${rows[0]?.date}`);
  }

  const bySymbol = new Map<string, ChipRow>();
  const row = (symbol: string) => {
    const securityId = securityIds.get(symbol);
    if (!securityId) return null;
    let r = bySymbol.get(symbol);
    if (!r) {
      // Stocks with no day trades are left out of that report, so they start at 0.
      r = { securityId, date, dayTradeVolume: 0 };
      bySymbol.set(symbol, r);
    }
    return r;
  };

  for (const m of [...reports.twseMargin, ...reports.tpexMargin]) {
    const r = row(m.symbol);
    if (!r) continue;
    r.marginBalance = m.marginBalance;
    r.shortBalance = m.shortBalance;
    r.marginShortOffset = m.marginShortOffset;
  }
  for (const f of [...reports.twseForeign, ...reports.tpexForeign]) {
    const r = row(f.symbol);
    if (r) r.foreignHoldingPct = f.foreignHoldingPct;
  }
  for (const d of [...reports.twseDayTrade, ...reports.tpexDayTrade]) {
    const r = row(d.symbol);
    if (r) r.dayTradeVolume = d.dayTradeVolume;
  }

  return upsertRows(
    db,
    schema.twDailyChips,
    [...bySymbol.values()],
    [schema.twDailyChips.securityId, schema.twDailyChips.date],
  );
}
