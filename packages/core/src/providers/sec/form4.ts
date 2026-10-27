import { XMLParser } from "fast-xml-parser";

export interface InsiderTrade {
  /** Position of the transaction within the filing's non-derivative table. */
  line: number;
  issuerCik: string;
  ticker: string | null;
  insiderCik: string;
  insiderName: string;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  officerTitle: string | null;
  /** The filing declares the trades were made under a Rule 10b5-1 trading plan. */
  is10b51Plan: boolean | null;
  transactionDate: string;
  /** P = open-market purchase, S = open-market sale, A = grant, M = option exercise, F = tax withholding, … */
  code: string;
  acquired: boolean;
  shares: number;
  price: number | null;
  sharesOwnedAfter: number | null;
}

const parser = new XMLParser({
  parseTagValue: false,
  isArray: (name) => name === "nonDerivativeTransaction" || name === "reportingOwner",
});

/** Pulls the ownership XML out of a full EDGAR submission (.txt). */
export function extractOwnershipXml(submission: string): string | null {
  for (const match of submission.matchAll(/<XML>([\s\S]*?)<\/XML>/g)) {
    const body = match[1]?.trim();
    if (body?.includes("<ownershipDocument")) return body;
  }
  return null;
}

/**
 * Reads `<ACCEPTANCE-DATETIME>` from a submission header. EDGAR stamps it in US Eastern time.
 */
export function parseAcceptanceDateTime(submission: string): Date | null {
  const m = /<ACCEPTANCE-DATETIME>(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(submission);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const local = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  // Resolve the Eastern offset (EST/EDT) for that instant.
  const guess = new Date(`${local}Z`);
  const eastern = new Date(guess.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (utc.getTime() - eastern.getTime()));
}

/**
 * Parses the non-derivative transactions of a Form 4. For joint filings with several reporting
 * owners, the first owner is recorded.
 */
export function parseForm4(xml: string): InsiderTrade[] {
  const doc = parser.parse(xml)?.ownershipDocument;
  if (!doc) throw new Error("not a Form 4 ownership document");

  const issuer = doc.issuer ?? {};
  const owner = doc.reportingOwner?.[0] ?? {};
  const rel = owner.reportingOwnerRelationship ?? {};
  const transactions: Record<string, any>[] =
    doc.nonDerivativeTable?.nonDerivativeTransaction ?? [];
  const plan = text(doc.aff10b5One);

  const common = {
    issuerCik: text(issuer.issuerCik) ?? "",
    ticker: normalizeTicker(text(issuer.issuerTradingSymbol)),
    insiderCik: text(owner.reportingOwnerId?.rptOwnerCik) ?? "",
    insiderName: text(owner.reportingOwnerId?.rptOwnerName) ?? "",
    isDirector: flag(rel.isDirector),
    isOfficer: flag(rel.isOfficer),
    isTenPercentOwner: flag(rel.isTenPercentOwner),
    officerTitle: text(rel.officerTitle) ?? null,
    is10b51Plan: plan == null ? null : flag(plan),
  };

  return transactions.flatMap((t, line) => {
    const date = text(t.transactionDate?.value);
    const code = text(t.transactionCoding?.transactionCode);
    const shares = num(t.transactionAmounts?.transactionShares?.value);
    if (!date || !code || shares == null) return [];
    return [
      {
        line,
        ...common,
        transactionDate: date.slice(0, 10),
        code,
        acquired: text(t.transactionAmounts?.transactionAcquiredDisposedCode?.value) === "A",
        shares,
        price: num(t.transactionAmounts?.transactionPricePerShare?.value),
        sharesOwnedAfter: num(t.postTransactionAmounts?.sharesOwnedFollowingTransaction?.value),
      },
    ];
  });
}

/** Lines of an EDGAR daily form index (`form.YYYYMMDD.idx`) for the given form types. */
export function parseDailyFormIndex(
  idx: string,
  forms: string[],
): { form: string; cik: string; path: string }[] {
  const wanted = new Set(forms);
  const out: { form: string; cik: string; path: string }[] = [];
  const seen = new Set<string>();
  for (const line of idx.split("\n")) {
    const m = /^(\S+)\s+.+?\s+(\d+)\s+(\d{8})\s+(edgar\/data\/\S+\.txt)\s*$/.exec(line);
    if (!m || !wanted.has(m[1] as string)) continue;
    const path = m[4] as string;
    // Each filing is listed once per filer (issuer and reporting owner); keep one.
    const accession = path.split("/").pop() as string;
    if (seen.has(accession)) continue;
    seen.add(accession);
    out.push({ form: m[1] as string, cik: m[2] as string, path });
  }
  return out;
}

/** Unlisted issuers file placeholders such as "NONE" or "N/A". */
function normalizeTicker(raw: string | undefined): string | null {
  const t = raw?.toUpperCase();
  return !t || /^(NONE|N\/?A|NULL|-+)$/.test(t) ? null : t;
}

function text(v: unknown): string | undefined {
  if (v == null || typeof v === "object") return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function num(v: unknown): number | null {
  const s = text(v)?.replace(/,/g, "");
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function flag(v: unknown): boolean {
  const s = text(v)?.toLowerCase();
  return s === "1" || s === "true";
}
