import {
  parseTwInsiderTransfers,
  type TwInsiderTransferRow,
  twInsiderTransferUrls,
} from "@alphascout/core/providers/tw";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { fetchJson } from "../lib/http.ts";

/** Stores the latest daily insider transfer reports from both boards (no history is published). */
export async function ingestTwInsiderTransfers(
  db: Db,
  securityIds: Map<string, number>,
): Promise<number> {
  const rows = [];
  for (const url of Object.values(twInsiderTransferUrls)) {
    for (const { symbol, ...r } of parseTwInsiderTransfers(
      await fetchJson<TwInsiderTransferRow[]>(url),
    )) {
      const securityId = securityIds.get(symbol);
      if (securityId) rows.push({ securityId, ...r });
    }
  }
  return upsertRows(db, schema.twInsiderTransfers, rows, [schema.twInsiderTransfers.sourceKey]);
}
