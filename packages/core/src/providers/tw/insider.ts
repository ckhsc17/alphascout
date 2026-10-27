import { parseTwNumber } from "./parse.ts";

export interface TwInsiderTransfer {
  symbol: string;
  reportedOn: string;
  insiderName: string;
  /** e.g. 董事本人, 經理人本人, 大股東本人. */
  role: string | null;
  /** e.g. 一般交易, 鉅額逐筆交易, 贈與. */
  method: string | null;
  shares: number;
  /** Stable key so re-ingesting the same daily report is idempotent. */
  sourceKey: string;
}

/** 每日內部人持股轉讓事前申報表 (latest business day only). */
export const twInsiderTransferUrls = {
  TWSE: "https://openapi.twse.com.tw/v1/opendata/t187ap12_L",
  TPEx: "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap12_O",
};

/** Rows from either board; TWSE and TPEx name a few columns differently. */
export type TwInsiderTransferRow = Record<string, string>;

export function parseTwInsiderTransfers(rows: TwInsiderTransferRow[]): TwInsiderTransfer[] {
  return rows.flatMap((r) => {
    const symbol = (r.公司代號 ?? r.SecuritiesCompanyCode ?? "").trim();
    const date = (r.出表日期 ?? r.Date ?? "").trim();
    const name = (r.姓名 ?? "").trim();
    const shares = parseTwNumber(r["預定轉讓總股數-自有持股"] ?? r["預定轉讓方式及股數-轉讓股數"]);
    if (!symbol || !date || !name || shares == null) return [];

    const reportedOn = rocToIsoDate(date);
    const method = r["預定轉讓方式及股數-轉讓方式"]?.trim() || null;
    return [
      {
        symbol,
        reportedOn,
        insiderName: name,
        role: (r.申報人身分 ?? r.申請人身分)?.trim() || null,
        method,
        shares,
        sourceKey: [reportedOn, symbol, name, method ?? "", shares].join("|"),
      },
    ];
  });
}

/** "1151022" (ROC year 115) → "2026-10-22" */
export function rocToIsoDate(roc: string): string {
  const m = /^(\d{2,3})(\d{2})(\d{2})$/.exec(roc.trim());
  if (!m) throw new Error(`invalid ROC date: ${roc}`);
  return `${Number(m[1]) + 1911}-${m[2]}-${m[3]}`;
}
