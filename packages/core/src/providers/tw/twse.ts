import { compactToIsoDate, parseTwNumber, TW_INDUSTRIES } from "./parse.ts";
import type { TwDailyPrice, TwInstitutionalFlow, TwSecurity } from "./types.ts";

/** Response shape of the www.twse.com.tw `rwd` JSON endpoints. */
interface TwseTable {
  title?: string;
  fields?: string[];
  data?: string[][];
}

export interface TwseMiIndexResponse {
  stat?: string;
  tables?: TwseTable[];
}

export interface TwseT86Response {
  stat?: string;
  date?: string;
  fields?: string[];
  data?: string[][];
}

/** Row of openapi.twse.com.tw `/v1/opendata/t187ap03_L` (上市公司基本資料). */
export interface TwseCompanyRow {
  公司代號: string;
  公司簡稱: string;
  產業別: string;
}

export const twseUrls = {
  /** 每日收盤行情 for every security except warrants. */
  dailyQuotes: (compactDate: string) =>
    `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${compactDate}&type=ALLBUT0999&response=json`,
  /** 三大法人買賣超日報. */
  institutional: (compactDate: string) =>
    `https://www.twse.com.tw/rwd/zh/fund/T86?date=${compactDate}&selectType=ALLBUT0999&response=json`,
  companies: "https://openapi.twse.com.tw/v1/opendata/t187ap03_L",
};

export function parseTwseCompanies(rows: TwseCompanyRow[]): TwSecurity[] {
  return rows.map((r) => ({
    symbol: r.公司代號.trim(),
    name: r.公司簡稱.trim(),
    board: "TWSE",
    industry: TW_INDUSTRIES[r.產業別.trim()] ?? null,
  }));
}

/** Returns an empty array on non-trading days (TWSE answers with a "no data" `stat`). */
export function parseTwseDailyQuotes(res: TwseMiIndexResponse, date: string): TwDailyPrice[] {
  const table = res.tables?.find((t) => t.title?.includes("每日收盤行情"));
  if (!table?.fields || !table.data) return [];

  const col = columnIndex(table.fields, [
    "證券代號",
    "成交股數",
    "成交筆數",
    "成交金額",
    "開盤價",
    "最高價",
    "最低價",
    "收盤價",
  ]);

  const out: TwDailyPrice[] = [];
  for (const row of table.data) {
    const open = parseTwNumber(row[col.開盤價]);
    const high = parseTwNumber(row[col.最高價]);
    const low = parseTwNumber(row[col.最低價]);
    const close = parseTwNumber(row[col.收盤價]);
    // No trades that day: prices are printed as "--".
    if (open == null || high == null || low == null || close == null) continue;
    out.push({
      symbol: (row[col.證券代號] as string).trim(),
      date,
      open,
      high,
      low,
      close,
      volume: parseTwNumber(row[col.成交股數]) ?? 0,
      turnover: parseTwNumber(row[col.成交金額]) ?? 0,
      transactions: parseTwNumber(row[col.成交筆數]) ?? 0,
    });
  }
  return out;
}

export function parseTwseInstitutional(res: TwseT86Response): TwInstitutionalFlow[] {
  if (!res.fields || !res.data || !res.date) return [];
  const date = compactToIsoDate(res.date);
  const col = columnIndex(res.fields, [
    "證券代號",
    "外陸資買賣超股數(不含外資自營商)",
    "外資自營商買賣超股數",
    "投信買賣超股數",
    "自營商買賣超股數",
  ]);

  return res.data.map((row) => ({
    symbol: (row[col.證券代號] as string).trim(),
    date,
    foreignNet:
      (parseTwNumber(row[col["外陸資買賣超股數(不含外資自營商)"]]) ?? 0) +
      (parseTwNumber(row[col.外資自營商買賣超股數]) ?? 0),
    trustNet: parseTwNumber(row[col.投信買賣超股數]) ?? 0,
    dealerNet: parseTwNumber(row[col.自營商買賣超股數]) ?? 0,
  }));
}

/** Looks up column positions by header name so a reordered response fails loudly. */
function columnIndex<const K extends string>(fields: string[], names: K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const name of names) {
    const i = fields.indexOf(name);
    if (i === -1) throw new Error(`TWSE response is missing column "${name}"`);
    out[name] = i;
  }
  return out;
}
