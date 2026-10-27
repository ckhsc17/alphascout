import {
  isoToCompactDate,
  isoToSlashDate,
  parseTpexDailyQuotes,
  parseTpexInstitutional,
  parseTwseDailyQuotes,
  parseTwseInstitutional,
  type TpexResponse,
  type TwDailyPrice,
  type TwInstitutionalFlow,
  type TwseMiIndexResponse,
  type TwseT86Response,
  tpexUrls,
  twseUrls,
} from "@alphascout/core/providers/tw";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { fetchJson } from "../lib/http.ts";

export interface TwDayResult {
  prices: number;
  flows: number;
}

/**
 * Fetches one trading day of quotes and institutional flows from both boards and stores the rows
 * for securities we track. Returns zero counts on non-trading days.
 */
export async function ingestTwDay(
  db: Db,
  date: string,
  securityIds: Map<string, number>,
): Promise<TwDayResult> {
  const compact = isoToCompactDate(date);
  const slash = isoToSlashDate(date);

  const twseQuotes = parseTwseDailyQuotes(
    await fetchJson<TwseMiIndexResponse>(twseUrls.dailyQuotes(compact)),
    date,
  );
  if (twseQuotes.length === 0) return { prices: 0, flows: 0 };

  const twseFlows = parseTwseInstitutional(
    await fetchJson<TwseT86Response>(twseUrls.institutional(compact)),
  );
  const tpexQuotes = parseTpexDailyQuotes(
    await fetchJson<TpexResponse>(tpexUrls.dailyQuotes(slash)),
  );
  const tpexFlows = parseTpexInstitutional(
    await fetchJson<TpexResponse>(tpexUrls.institutional(slash)),
  );

  // Guard against an endpoint silently returning a different session than the one requested.
  for (const row of [
    ...tpexQuotes.slice(0, 1),
    ...twseFlows.slice(0, 1),
    ...tpexFlows.slice(0, 1),
  ]) {
    if (row.date !== date) throw new Error(`expected data for ${date}, got ${row.date}`);
  }

  const prices = toPriceRows([...twseQuotes, ...tpexQuotes], securityIds);
  const flows = toFlowRows([...twseFlows, ...tpexFlows], securityIds);

  await upsertRows(db, schema.twDailyPrices, prices, [
    schema.twDailyPrices.securityId,
    schema.twDailyPrices.date,
  ]);
  await upsertRows(db, schema.twInstitutionalFlows, flows, [
    schema.twInstitutionalFlows.securityId,
    schema.twInstitutionalFlows.date,
  ]);
  return { prices: prices.length, flows: flows.length };
}

function toPriceRows(rows: TwDailyPrice[], ids: Map<string, number>) {
  return rows.flatMap(({ symbol, ...rest }) => {
    const securityId = ids.get(symbol);
    return securityId ? [{ securityId, ...rest }] : [];
  });
}

function toFlowRows(rows: TwInstitutionalFlow[], ids: Map<string, number>) {
  return rows.flatMap(({ symbol, ...rest }) => {
    const securityId = ids.get(symbol);
    return securityId ? [{ securityId, ...rest }] : [];
  });
}
