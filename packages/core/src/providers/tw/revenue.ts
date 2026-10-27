import { parseTwNumber } from "./parse.ts";
import type { TwBoard } from "./types.ts";

export interface TwMonthlyRevenue {
  symbol: string;
  /** First day of the reported month, e.g. "2026-08-01". */
  month: string;
  /** Revenue in thousand TWD. */
  revenue: number;
  /** Percent change vs. previous month. */
  mom: number | null;
  /** Percent change vs. same month last year. */
  yoy: number | null;
}

/**
 * MOPS monthly revenue summary page (Big5 HTML), one per board and month. The official OpenAPI
 * only carries the latest month, so history comes from here.
 */
export function mopsRevenueUrl(board: TwBoard, year: number, month: number): string {
  const market = board === "TWSE" ? "sii" : "otc";
  return `https://mopsov.twse.com.tw/nas/t21/${market}/t21sc03_${year - 1911}_${month}_0.html`;
}

/**
 * Data rows look like:
 * <tr align=right><td align=center>2330</td><td align=left>台積電</td><td nowrap> 514,805,337</td>
 *   <td nowrap> 467,580,548</td><td nowrap> 335,771,691</td><td nowrap> 10.09</td><Td nowrap> 53.32</td>…
 * i.e. code, name, this month, last month, same month last year, MoM %, YoY %, then cumulative.
 */
export function parseMopsRevenueHtml(html: string, month: string): TwMonthlyRevenue[] {
  const out: TwMonthlyRevenue[] = [];
  for (const row of html.split(/<tr align=right>/i).slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>([^<]*)<\/td>/gi)].map((m) => (m[1] ?? "").trim());
    const symbol = cells[0];
    if (!symbol || !/^[0-9A-Z]{4,6}$/.test(symbol)) continue;
    const revenue = parseTwNumber(cells[2]);
    if (revenue == null) continue;
    out.push({
      symbol,
      month,
      revenue,
      mom: parseTwNumber(cells[5]),
      yoy: parseTwNumber(cells[6]),
    });
  }
  return out;
}
