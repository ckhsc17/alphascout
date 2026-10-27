import { compactToIsoDate, parseTwNumber, TW_INDUSTRIES } from "./parse.ts";
import type { TwDailyPrice, TwInstitutionalFlow, TwSecurity } from "./types.ts";

/** Response shape of the www.tpex.org.tw `/www/zh-tw/...` JSON endpoints. */
export interface TpexResponse {
  stat?: string;
  date?: string;
  tables?: { title?: string; fields?: string[]; data?: string[][] }[];
}

/** Row of tpex.org.tw `/openapi/v1/mopsfin_t187ap03_O` (上櫃公司基本資料). */
export interface TpexCompanyRow {
  SecuritiesCompanyCode: string;
  CompanyAbbreviation: string;
  SecuritiesIndustryCode: string;
}

export const tpexUrls = {
  dailyQuotes: (slashDate: string) =>
    `https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${encodeURIComponent(slashDate)}&id=&response=json`,
  institutional: (slashDate: string) =>
    `https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade?type=Daily&sect=EW&date=${encodeURIComponent(slashDate)}&id=&response=json`,
  companies: "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O",
};

export function parseTpexCompanies(rows: TpexCompanyRow[]): TwSecurity[] {
  return rows.map((r) => ({
    symbol: r.SecuritiesCompanyCode.trim(),
    name: r.CompanyAbbreviation.trim(),
    board: "TPEx",
    industry: TW_INDUSTRIES[r.SecuritiesIndustryCode.trim()] ?? null,
  }));
}

// TPEx headers are not unique (the institutional table repeats 買進股數/賣出股數/買賣超股數 for
// each investor group), so columns are addressed by position and the header is sanity-checked.

const QUOTE_HEADER = ["代號", "名稱", "收盤", "漲跌", "開盤", "最高", "最低", "均價", "成交股數"];

export function parseTpexDailyQuotes(res: TpexResponse): TwDailyPrice[] {
  const table = res.tables?.[0];
  if (!res.date || !table?.fields || !table.data) return [];
  assertHeader(table.fields, QUOTE_HEADER);
  const date = compactToIsoDate(res.date);

  const out: TwDailyPrice[] = [];
  for (const row of table.data) {
    const close = parseTwNumber(row[2]);
    const open = parseTwNumber(row[4]);
    const high = parseTwNumber(row[5]);
    const low = parseTwNumber(row[6]);
    if (open == null || high == null || low == null || close == null) continue;
    out.push({
      symbol: (row[0] as string).trim(),
      date,
      open,
      high,
      low,
      close,
      volume: parseTwNumber(row[8]) ?? 0,
      turnover: parseTwNumber(row[9]) ?? 0,
      transactions: parseTwNumber(row[10]) ?? 0,
    });
  }
  return out;
}

/**
 * Column groups (buy / sell / net each): 外資及陸資(不含外資自營商), 外資自營商, 外資及陸資合計,
 * 投信, 自營商(自行買賣), 自營商(避險), 自營商合計, then the 三大法人 total.
 */
const INSTITUTIONAL_COLUMNS = { foreignTotalNet: 10, trustNet: 13, dealerTotalNet: 22, total: 23 };

export function parseTpexInstitutional(res: TpexResponse): TwInstitutionalFlow[] {
  const table = res.tables?.[0];
  if (!res.date || !table?.fields || !table.data) return [];
  assertHeader(table.fields, ["代號", "名稱", "買進股數", "賣出股數", "買賣超股數"]);
  if (table.fields.length !== INSTITUTIONAL_COLUMNS.total + 1) {
    throw new Error(`TPEx institutional table has ${table.fields.length} columns, expected 24`);
  }
  const date = compactToIsoDate(res.date);

  return table.data.map((row) => ({
    symbol: (row[0] as string).trim(),
    date,
    foreignNet: parseTwNumber(row[INSTITUTIONAL_COLUMNS.foreignTotalNet]) ?? 0,
    trustNet: parseTwNumber(row[INSTITUTIONAL_COLUMNS.trustNet]) ?? 0,
    dealerNet: parseTwNumber(row[INSTITUTIONAL_COLUMNS.dealerTotalNet]) ?? 0,
  }));
}

function assertHeader(fields: string[], expected: string[]) {
  expected.forEach((name, i) => {
    if (fields[i]?.trim() !== name) {
      throw new Error(`TPEx column ${i} is "${fields[i]}", expected "${name}"`);
    }
  });
}
