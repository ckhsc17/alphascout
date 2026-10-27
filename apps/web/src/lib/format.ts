const nf = (digits: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function fmtNum(v: unknown, digits = 2): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? nf(digits).format(n) : "—";
}

export function fmtPct(v: unknown, digits = 2): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${nf(digits).format(n)}%`;
}

/** 12.3B / 456.7M / 89.1K */
export function fmtCompact(v: unknown, prefix = ""): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${prefix}${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
}

export function fmtSigned(v: unknown, digits = 0): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${nf(digits).format(n)}`;
}

/**
 * Taiwan convention: red = up, green = down. US pages pass `western` for green-up.
 */
export function trendClass(v: unknown, convention: "tw" | "western" = "tw"): string {
  const n = Number(v);
  if (v == null || !Number.isFinite(n) || n === 0) return "text-muted";
  const up = convention === "tw" ? "text-up-tw" : "text-up-western";
  const down = convention === "tw" ? "text-down-tw" : "text-down-western";
  return n > 0 ? up : down;
}

export const ACTION_LABELS: Record<string, string> = {
  new: "新建倉",
  add: "加碼",
  trim: "減碼",
  exit: "清倉",
  hold: "不變",
};
