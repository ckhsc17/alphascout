import { XMLParser } from "fast-xml-parser";

export type PutCall = "none" | "put" | "call";

export interface ThirteenFCover {
  /** ISO date, e.g. "2026-06-30". */
  periodOfReport: string;
  isAmendment: boolean;
  /** "RESTATEMENT" replaces the original filing; "NEW HOLDINGS" adds positions to it. */
  amendmentType: "RESTATEMENT" | "NEW HOLDINGS" | null;
  /** Total reported value in USD. */
  totalValue: number | null;
}

export interface ThirteenFHolding {
  cusip: string;
  putCall: PutCall;
  issuer: string;
  titleOfClass: string | null;
  /** Market value in USD. */
  value: number;
  shares: number;
}

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: (name) => name === "infoTable",
});

/**
 * Filings made before 2023-01-03 report values in thousands of dollars; later ones in dollars.
 * https://www.sec.gov/divisions/investment/13ffaq
 */
export function thirteenFValueMultiplier(filedAt: Date): number {
  return filedAt < new Date("2023-01-03T00:00:00Z") ? 1000 : 1;
}

export function parseThirteenFCover(xml: string, filedAt: Date): ThirteenFCover {
  const doc = parser.parse(xml);
  const formData = doc?.edgarSubmission?.formData;
  const coverPage = formData?.coverPage;
  const period = text(doc?.edgarSubmission?.headerData?.filerInfo?.periodOfReport);
  if (!coverPage || !period) throw new Error("not a 13F primary document");

  const isAmendment = text(coverPage.isAmendment)?.toLowerCase() === "true";
  const amendmentType = text(coverPage.amendmentInfo?.amendmentType)?.toUpperCase();
  const total = num(formData?.summaryPage?.tableValueTotal);

  return {
    periodOfReport: usDateToIso(period),
    isAmendment,
    amendmentType:
      isAmendment && (amendmentType === "RESTATEMENT" || amendmentType === "NEW HOLDINGS")
        ? amendmentType
        : null,
    totalValue: total == null ? null : total * thirteenFValueMultiplier(filedAt),
  };
}

/**
 * Parses the information table and merges rows for the same security. Large filers split one
 * position into several rows (one per sub-manager / discretion type), so we sum them by
 * (CUSIP, put/call).
 */
export function parseThirteenFHoldings(xml: string, filedAt: Date): ThirteenFHolding[] {
  const doc = parser.parse(xml);
  const rows: unknown[] = doc?.informationTable?.infoTable ?? [];
  const multiplier = thirteenFValueMultiplier(filedAt);
  const merged = new Map<string, ThirteenFHolding>();

  for (const row of rows as Record<string, any>[]) {
    const cusip = text(row.cusip)?.toUpperCase();
    if (!cusip) continue;
    const putCall = (text(row.putCall)?.toLowerCase() ?? "none") as PutCall;
    const value = (num(row.value) ?? 0) * multiplier;
    const shares = num(row.shrsOrPrnAmt?.sshPrnamt) ?? 0;

    const key = `${cusip}|${putCall}`;
    const existing = merged.get(key);
    if (existing) {
      existing.value += value;
      existing.shares += shares;
    } else {
      merged.set(key, {
        cusip,
        putCall,
        issuer: text(row.nameOfIssuer) ?? "",
        titleOfClass: text(row.titleOfClass) ?? null,
        value,
        shares,
      });
    }
  }
  return [...merged.values()];
}

/** "06-30-2026" → "2026-06-30" */
function usDateToIso(s: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  if (!m) throw new Error(`unexpected periodOfReport: ${s}`);
  return `${m[3]}-${m[1]}-${m[2]}`;
}

function text(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function num(v: unknown): number | null {
  const s = text(v)?.replace(/,/g, "");
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
