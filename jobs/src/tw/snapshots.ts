import { computeTwSnapshots, type FlowPoint, type PricePoint } from "@alphascout/core/features";
import { MAJOR_HOLDER_TIER } from "@alphascout/core/providers/tw";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { addDays } from "../lib/dates.ts";

/** Calendar days of history loaded before `from` so long-window indicators are warmed up. */
const LOOKBACK_DAYS = 400;
const SECURITIES_PER_BATCH = 200;

/** Recomputes `tw_indicator_snapshots` for every TW security for dates in [from, to]. */
export async function computeTwSnapshotRange(
  db: Db,
  securityIds: number[],
  from: string,
  to: string,
): Promise<number> {
  const historyFrom = addDays(from, -LOOKBACK_DAYS);
  let written = 0;

  for (let i = 0; i < securityIds.length; i += SECURITIES_PER_BATCH) {
    const batch = securityIds.slice(i, i + SECURITIES_PER_BATCH);
    const [prices, flows, holders, revenue] = await Promise.all([
      db
        .select()
        .from(schema.twDailyPrices)
        .where(
          and(
            inArray(schema.twDailyPrices.securityId, batch),
            gte(schema.twDailyPrices.date, historyFrom),
            lte(schema.twDailyPrices.date, to),
          ),
        )
        .orderBy(asc(schema.twDailyPrices.date)),
      db
        .select()
        .from(schema.twInstitutionalFlows)
        .where(
          and(
            inArray(schema.twInstitutionalFlows.securityId, batch),
            gte(schema.twInstitutionalFlows.date, historyFrom),
            lte(schema.twInstitutionalFlows.date, to),
          ),
        ),
      db
        .select()
        .from(schema.twShareholdingDist)
        .where(
          and(
            inArray(schema.twShareholdingDist.securityId, batch),
            eq(schema.twShareholdingDist.tier, MAJOR_HOLDER_TIER),
            gte(schema.twShareholdingDist.weekDate, historyFrom),
            lte(schema.twShareholdingDist.weekDate, to),
          ),
        ),
      db
        .select()
        .from(schema.twMonthlyRevenue)
        .where(
          and(
            inArray(schema.twMonthlyRevenue.securityId, batch),
            gte(schema.twMonthlyRevenue.month, historyFrom),
            lte(schema.twMonthlyRevenue.month, to),
          ),
        ),
    ]);

    const pricesBySecurity = groupBy(prices, (p) => p.securityId);
    const flowsBySecurity = groupBy(flows, (f) => f.securityId);
    const holdersBySecurity = groupBy(holders, (h) => h.securityId);
    const revenueBySecurity = groupBy(revenue, (r) => r.securityId);

    const rows = [];
    for (const [securityId, series] of pricesBySecurity) {
      const points: PricePoint[] = series.flatMap((p) =>
        p.open == null || p.high == null || p.low == null || p.close == null
          ? []
          : [
              {
                date: p.date,
                open: p.open,
                high: p.high,
                low: p.low,
                close: p.close,
                volume: p.volume,
              },
            ],
      );
      const flowPoints: FlowPoint[] = flowsBySecurity.get(securityId) ?? [];
      const extras = {
        majorHolders: holdersBySecurity.get(securityId) ?? [],
        revenue: revenueBySecurity.get(securityId) ?? [],
      };
      for (const snap of computeTwSnapshots(points, flowPoints, extras)) {
        if (snap.date >= from && snap.date <= to) rows.push({ securityId, ...snap });
      }
    }

    written += await upsertRows(db, schema.twIndicatorSnapshots, rows, [
      schema.twIndicatorSnapshots.securityId,
      schema.twIndicatorSnapshots.date,
    ]);
  }
  return written;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}
