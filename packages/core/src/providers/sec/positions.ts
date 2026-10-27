import type { PutCall } from "./thirteen-f.ts";

export interface Position {
  cusip: string;
  putCall: PutCall;
  value: number;
  shares: number;
}

export interface FilingForPeriod<P extends Position = Position> {
  filedAt: Date;
  isAmendment: boolean;
  amendmentType: "RESTATEMENT" | "NEW HOLDINGS" | null;
  holdings: P[];
}

export type PositionAction = "new" | "exit" | "add" | "trim" | "hold";

export interface PositionChange {
  cusip: string;
  putCall: PutCall;
  action: PositionAction;
  shares: number;
  prevShares: number;
  /** Percent change in shares; null for new positions. */
  sharesChangePct: number | null;
  value: number;
  /** Share of the current portfolio's total value, 0–1. Exits are 0. */
  weight: number;
}

const key = (p: Position) => `${p.cusip}|${p.putCall}`;

/**
 * Resolves the holdings an investor reported for one period, applying amendments in filing order:
 * an original or RESTATEMENT replaces everything, NEW HOLDINGS adds positions on top.
 */
export function effectiveHoldings<P extends Position>(filings: FilingForPeriod<P>[]): P[] {
  const ordered = [...filings].sort((a, b) => a.filedAt.getTime() - b.filedAt.getTime());
  let current = new Map<string, P>();
  for (const filing of ordered) {
    if (filing.amendmentType === "NEW HOLDINGS") {
      for (const h of filing.holdings) current.set(key(h), h);
    } else if (!filing.isAmendment || filing.amendmentType === "RESTATEMENT") {
      current = new Map(filing.holdings.map((h) => [key(h), h]));
    }
  }
  return [...current.values()];
}

/** Compares two consecutive quarters of one investor's holdings. */
export function diffPositions(previous: Position[], current: Position[]): PositionChange[] {
  const total = current.reduce((sum, p) => sum + p.value, 0);
  const prevByKey = new Map(previous.map((p) => [key(p), p]));
  const changes: PositionChange[] = [];

  for (const cur of current) {
    const prev = prevByKey.get(key(cur));
    prevByKey.delete(key(cur));
    const prevShares = prev?.shares ?? 0;
    changes.push({
      cusip: cur.cusip,
      putCall: cur.putCall,
      action: !prev
        ? "new"
        : cur.shares > prevShares
          ? "add"
          : cur.shares < prevShares
            ? "trim"
            : "hold",
      shares: cur.shares,
      prevShares,
      sharesChangePct:
        prev && prevShares > 0 ? ((cur.shares - prevShares) / prevShares) * 100 : null,
      value: cur.value,
      weight: total > 0 ? cur.value / total : 0,
    });
  }

  for (const prev of prevByKey.values()) {
    changes.push({
      cusip: prev.cusip,
      putCall: prev.putCall,
      action: "exit",
      shares: 0,
      prevShares: prev.shares,
      sharesChangePct: -100,
      value: 0,
      weight: 0,
    });
  }
  return changes;
}

/** "2026-06-30" → "2026-03-31" */
export function previousQuarterEnd(periodIso: string): string {
  const [y, m] = periodIso.split("-").map(Number) as [number, number];
  const prevMonth = m - 3;
  const year = prevMonth <= 0 ? y - 1 : y;
  const month = prevMonth <= 0 ? prevMonth + 12 : prevMonth;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
