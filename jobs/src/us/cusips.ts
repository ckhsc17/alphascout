import { type Db, schema, upsertRows } from "@alphascout/db";
import { sql } from "drizzle-orm";
import { fetchJson } from "../lib/http.ts";

type FigiResult =
  | { data: { figi: string; ticker?: string; name?: string; exchCode?: string }[] }
  | { warning: string }
  | { error: string };

/**
 * Maps CUSIPs that appear in 13F holdings to tickers via OpenFIGI. Unmatched CUSIPs are stored
 * with a null ticker so they are not looked up again.
 */
export async function mapNewCusips(db: Db): Promise<number> {
  const pending = await db.execute<{ cusip: string }>(sql`
    select distinct h.cusip from ${schema.us13fHoldings} h
    left join ${schema.cusipMap} m on m.cusip = h.cusip
    where m.cusip is null
  `);
  const cusips = pending.map((r) => r.cusip);
  if (cusips.length === 0) return 0;

  const apiKey = process.env.OPENFIGI_API_KEY;
  // Without a key OpenFIGI accepts 10 jobs per request; with one, 100.
  const batchSize = apiKey ? 100 : 10;
  let mapped = 0;

  for (let i = 0; i < cusips.length; i += batchSize) {
    const batch = cusips.slice(i, i + batchSize);
    const results = await fetchJson<FigiResult[]>("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-OPENFIGI-APIKEY": apiKey } : {}),
      },
      body: JSON.stringify(batch.map((idValue) => ({ idType: "ID_CUSIP", idValue }))),
    });

    const rows = batch.map((cusip, j) => {
      const result = results[j];
      const candidates = result && "data" in result ? result.data : [];
      // Prefer the US composite listing over individual exchanges.
      const best = candidates.find((c) => c.exchCode === "US") ?? candidates[0];
      if (best?.ticker) mapped++;
      return {
        cusip,
        ticker: best?.ticker ?? null,
        figi: best?.figi ?? null,
        name: best?.name ?? null,
        source: "openfigi",
        updatedAt: new Date(),
      };
    });
    await upsertRows(db, schema.cusipMap, rows, [schema.cusipMap.cusip]);
  }
  return mapped;
}
