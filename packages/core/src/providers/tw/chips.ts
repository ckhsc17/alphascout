import { compactToIsoDate, parseTwNumber } from "./parse.ts";
import type { TpexResponse } from "./tpex.ts";

/** Response shape shared by the TWSE `rwd` endpoints used here. */
export interface TwseChipsResponse {
  stat?: string;
  date?: string;
  fields?: string[];
  data?: (string | number)[][];
  tables?: { title?: string; fields?: string[]; data?: string[][] }[];
}

export interface TwMargin {
  symbol: string;
  date: string;
  /** 融資餘額, lots. */
  marginBalance: number;
  /** 融券餘額, lots. */
  shortBalance: number;
  /** 資券互抵, lots. */
  marginShortOffset: number;
}

export interface TwForeignHolding {
  symbol: string;
  date: string;
  /** 外資及陸資持股比率, %. */
  foreignHoldingPct: number;
}

export interface TwDayTrade {
  symbol: string;
  date: string;
  /** 當日沖銷交易成交股數. */
  dayTradeVolume: number;
}

export const twseChipUrls = {
  margin: (compactDate: string) =>
    `https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=${compactDate}&selectType=ALL&response=json`,
  foreignHolding: (compactDate: string) =>
    `https://www.twse.com.tw/rwd/zh/fund/MI_QFIIS?date=${compactDate}&selectType=ALLBUT0999&response=json`,
  dayTrade: (compactDate: string) =>
    `https://www.twse.com.tw/rwd/zh/dayTrading/TWTB4U?date=${compactDate}&selectType=All&response=json`,
};

export const tpexChipUrls = {
  margin: (slashDate: string) =>
    `https://www.tpex.org.tw/www/zh-tw/margin/balance?date=${encodeURIComponent(slashDate)}&response=json`,
  foreignHolding: (slashDate: string) =>
    `https://www.tpex.org.tw/www/zh-tw/insti/qfii?date=${encodeURIComponent(slashDate)}&response=json`,
  dayTrade: (slashDate: string) =>
    `https://www.tpex.org.tw/www/zh-tw/intraday/stat?type=Daily&date=${encodeURIComponent(slashDate)}&response=json`,
};

// Margin tables repeat 買進/賣出/前日餘額/今日餘額 for the 融資 and 融券 halves, so columns are
// addressed by position and the header is sanity-checked.

/** 融資融券彙總: 代號 名稱 | 融資 買進 賣出 現金償還 前日餘額 今日餘額 限額 | 融券 ... | 資券互抵 */
const TWSE_MARGIN = { marginBalance: 6, shortBalance: 12, offset: 14 };

export function parseTwseMargin(res: TwseChipsResponse): TwMargin[] {
  const table = res.tables?.find((t) => t.title?.includes("融資融券彙總"));
  if (!res.date || !table?.fields || !table.data) return [];
  assertHeader("TWSE margin", table.fields, {
    0: "代號",
    [TWSE_MARGIN.marginBalance]: "今日餘額",
    [TWSE_MARGIN.shortBalance]: "今日餘額",
    [TWSE_MARGIN.offset]: "資券互抵",
  });
  const date = compactToIsoDate(res.date);
  return table.data.map((row) => ({
    symbol: String(row[0]).trim(),
    date,
    marginBalance: parseTwNumber(row[TWSE_MARGIN.marginBalance]) ?? 0,
    shortBalance: parseTwNumber(row[TWSE_MARGIN.shortBalance]) ?? 0,
    marginShortOffset: parseTwNumber(row[TWSE_MARGIN.offset]) ?? 0,
  }));
}

/** 上櫃股票融資融券餘額: 代號 名稱 前資餘額 資買 資賣 現償 資餘額 ... 券餘額 ... 資券相抵 */
const TPEX_MARGIN = { marginBalance: 6, shortBalance: 14, offset: 18 };

export function parseTpexMargin(res: TpexResponse): TwMargin[] {
  const table = res.tables?.[0];
  if (!res.date || !table?.fields || !table.data) return [];
  assertHeader("TPEx margin", table.fields, {
    0: "代號",
    [TPEX_MARGIN.marginBalance]: "資餘額",
    [TPEX_MARGIN.shortBalance]: "券餘額",
    [TPEX_MARGIN.offset]: "資券相抵(張)",
  });
  const date = compactToIsoDate(res.date);
  return table.data.map((row) => ({
    symbol: String(row[0]).trim(),
    date,
    marginBalance: parseTwNumber(row[TPEX_MARGIN.marginBalance]) ?? 0,
    shortBalance: parseTwNumber(row[TPEX_MARGIN.shortBalance]) ?? 0,
    marginShortOffset: parseTwNumber(row[TPEX_MARGIN.offset]) ?? 0,
  }));
}

export function parseTwseForeignHolding(res: TwseChipsResponse): TwForeignHolding[] {
  if (!res.date || !res.fields || !res.data) return [];
  const symbolCol = res.fields.indexOf("證券代號");
  const pctCol = res.fields.indexOf("全體外資及陸資持股比率");
  if (symbolCol === -1 || pctCol === -1) {
    throw new Error("TWSE foreign holding response is missing expected columns");
  }
  const date = compactToIsoDate(res.date);
  return res.data.flatMap((row) => {
    const pct = parseTwNumber(String(row[pctCol]));
    return pct == null
      ? []
      : [{ symbol: String(row[symbolCol]).trim(), date, foreignHoldingPct: pct }];
  });
}

/** 僑外資及陸資持股比例排行表: 排行 代號 名稱 ... 持股比率(E=C/A) printed as "12.34%". */
const TPEX_FOREIGN = { symbol: 1, pct: 7 };

export function parseTpexForeignHolding(res: TpexResponse): TwForeignHolding[] {
  const table = res.tables?.[0];
  if (!res.date || !table?.fields || !table.data) return [];
  assertHeader("TPEx foreign holding", table.fields, {
    [TPEX_FOREIGN.symbol]: "代號",
    [TPEX_FOREIGN.pct]: "僑外資及陸資持股比率(E=C/A)",
  });
  const date = compactToIsoDate(res.date);
  return table.data.flatMap((row) => {
    const pct = parseTwNumber(String(row[TPEX_FOREIGN.pct]).replace("%", ""));
    return pct == null
      ? []
      : [{ symbol: String(row[TPEX_FOREIGN.symbol]).trim(), date, foreignHoldingPct: pct }];
  });
}

/** Both boards publish the same per-stock day-trade table (標的及成交量值). */
export function parseDayTrades(res: TwseChipsResponse | TpexResponse): TwDayTrade[] {
  const table = res.tables?.find((t) => t.fields?.includes("當日沖銷交易成交股數"));
  if (!res.date || !table?.fields || !table.data) return [];
  const symbolCol = table.fields.indexOf("證券代號");
  const volumeCol = table.fields.indexOf("當日沖銷交易成交股數");
  if (symbolCol === -1) throw new Error("day-trade table is missing 證券代號");
  const date = compactToIsoDate(res.date);
  return table.data.map((row) => ({
    symbol: String(row[symbolCol]).trim(),
    date,
    dayTradeVolume: parseTwNumber(row[volumeCol]) ?? 0,
  }));
}

function assertHeader(label: string, fields: string[], expected: Record<number, string>) {
  for (const [i, name] of Object.entries(expected)) {
    if (fields[Number(i)]?.trim() !== name) {
      throw new Error(`${label} column ${i} is "${fields[Number(i)]}", expected "${name}"`);
    }
  }
}
