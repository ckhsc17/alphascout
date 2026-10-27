import { mopsRevenueUrl, parseMopsRevenueHtml, type TwBoard } from "@alphascout/core/providers/tw";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { fetchText } from "../lib/http.ts";

/** Ingests monthly revenue for one month ("YYYY-MM") from both boards. */
export async function ingestTwRevenue(
  db: Db,
  yearMonth: string,
  securityIds: Map<string, number>,
): Promise<number> {
  const [year, month] = yearMonth.split("-").map(Number) as [number, number];
  const monthStart = `${yearMonth}-01`;
  const rows = [];
  for (const board of ["TWSE", "TPEx"] as TwBoard[]) {
    const html = await fetchText(mopsRevenueUrl(board, year, month), { encoding: "big5" });
    for (const { symbol, ...r } of parseMopsRevenueHtml(html, monthStart)) {
      const securityId = securityIds.get(symbol);
      if (securityId) rows.push({ securityId, ...r });
    }
  }
  return upsertRows(db, schema.twMonthlyRevenue, rows, [
    schema.twMonthlyRevenue.securityId,
    schema.twMonthlyRevenue.month,
  ]);
}

/** "YYYY-MM" strings from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
