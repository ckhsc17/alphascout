import { parseTdccCsv, TDCC_SHAREHOLDING_URL } from "@alphascout/core/providers/tw";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { fetchText } from "../lib/http.ts";

/** Stores the latest week of TDCC shareholding distribution (no history is published). */
export async function ingestTdccLatest(db: Db, securityIds: Map<string, number>): Promise<number> {
  const csv = await fetchText(TDCC_SHAREHOLDING_URL);
  const rows = parseTdccCsv(csv).flatMap(({ symbol, ...r }) => {
    const securityId = securityIds.get(symbol);
    return securityId ? [{ securityId, ...r }] : [];
  });
  return upsertRows(db, schema.twShareholdingDist, rows, [
    schema.twShareholdingDist.securityId,
    schema.twShareholdingDist.weekDate,
    schema.twShareholdingDist.tier,
  ]);
}
