import { compactToIsoDate, parseTwNumber } from "./parse.ts";

export interface TwShareholdingTier {
  symbol: string;
  weekDate: string;
  tier: number;
  holders: number;
  shares: number;
  pct: number;
}

/** 集保戶股權分散表, latest week only. */
export const TDCC_SHAREHOLDING_URL = "https://opendata.tdcc.com.tw/getOD.ashx?id=1-5";

/** Tier 15 is holders of more than 1,000,000 shares (1,000 lots) — the "千張大戶". */
export const MAJOR_HOLDER_TIER = 15;
/** Tier 17 is the total across all tiers. */
export const TOTAL_TIER = 17;

/**
 * Tiers we store: 400+ lots (12–15) and the total. Storing all 17 tiers for every security
 * would add ~170 MB a year.
 */
export const STORED_TIERS = new Set([12, 13, 14, 15, TOTAL_TIER]);

/** CSV columns: 資料日期,證券代號,持股分級,人數,股數,占集保庫存數比例% */
export function parseTdccCsv(csv: string, tiers: Set<number> = STORED_TIERS): TwShareholdingTier[] {
  const out: TwShareholdingTier[] = [];
  for (const line of csv.replace(/^﻿/, "").split(/\r?\n/).slice(1)) {
    const [date, symbol, tier, holders, shares, pct] = line.split(",");
    const tierNo = Number(tier);
    if (!date || !symbol || !tiers.has(tierNo)) continue;
    out.push({
      symbol: symbol.trim(),
      weekDate: compactToIsoDate(date.trim()),
      tier: tierNo,
      holders: parseTwNumber(holders) ?? 0,
      shares: parseTwNumber(shares) ?? 0,
      pct: parseTwNumber(pct) ?? 0,
    });
  }
  return out;
}
