import { atr, bollinger, macd, rsi, type Series, sma } from "../indicators/index.ts";

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FlowPoint {
  date: string;
  foreignNet: number;
  trustNet: number;
  dealerNet: number;
}

export interface MajorHolderPoint {
  weekDate: string;
  /** Percent of depository shares held by 1,000+ lot holders. */
  pct: number;
}

export interface RevenuePoint {
  /** First day of the reported month. */
  month: string;
  yoy: number | null;
}

export interface ChipPoint {
  date: string;
  /** 融資餘額, lots. */
  marginBalance: number | null;
  /** 融券餘額, lots. */
  shortBalance: number | null;
  /** %. */
  foreignHoldingPct: number | null;
  /** Shares. */
  dayTradeVolume: number | null;
}

export interface SnapshotExtras {
  majorHolders?: MajorHolderPoint[];
  revenue?: RevenuePoint[];
  chips?: ChipPoint[];
}

export interface TwSnapshot {
  date: string;
  close: number;
  changePct: number | null;
  sma5: number | null;
  sma20: number | null;
  sma60: number | null;
  sma120: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  atr14: number | null;
  /** Average daily volume in shares over the previous 20 sessions (excluding today). */
  avgVolume20d: number | null;
  /** Today's volume divided by `avgVolume20d`. */
  volumeRatio: number | null;
  high52w: number | null;
  low52w: number | null;
  /** Consecutive sessions of net buying (> 0) or net selling (< 0), ending today. */
  foreignNetBuyStreak: number | null;
  trustNetBuyStreak: number | null;
  dealerNetBuyStreak: number | null;
  majorHolderPct: number | null;
  /** Change in percentage points vs. the latest week at least 28 days earlier. */
  majorHolderPctChange4w: number | null;
  /** YoY of the latest monthly revenue that had been published by this date. */
  revenueYoy: number | null;
  /** 融資餘額, lots. */
  marginBalance: number | null;
  /** % change in 融資餘額 vs. 5 sessions earlier. */
  marginChange5d: number | null;
  /** 券資比 (short ÷ margin balance), %. */
  shortMarginRatio: number | null;
  foreignHoldingPct: number | null;
  /** Change in foreign holding ratio vs. 20 sessions earlier, percentage points. */
  foreignHoldingChange20d: number | null;
  /** Day-trade volume ÷ total volume, %. */
  dayTradePct: number | null;
}

const SESSIONS_PER_YEAR = 250;

/**
 * Computes one snapshot per price bar. `prices` must be sorted ascending by date and should
 * include enough history before the first date you intend to keep (~250 sessions) for the
 * long-window fields to be filled.
 */
export function computeTwSnapshots(
  prices: PricePoint[],
  flows: FlowPoint[],
  extras: SnapshotExtras = {},
): TwSnapshot[] {
  const closes = prices.map((p) => p.close);
  const volumes = prices.map((p) => p.volume);

  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);
  const sma60 = sma(closes, 60);
  const sma120 = sma(closes, 120);
  const rsi14 = rsi(closes, 14);
  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const atr14 = atr(prices, 14);
  const volSma20 = sma(volumes, 20);

  const flowByDate = new Map(flows.map((f) => [f.date, f]));
  const chipByDate = new Map((extras.chips ?? []).map((c) => [c.date, c]));
  const streaks = {
    foreign: streakSeries(prices, flowByDate, (f) => f.foreignNet),
    trust: streakSeries(prices, flowByDate, (f) => f.trustNet),
    dealer: streakSeries(prices, flowByDate, (f) => f.dealerNet),
  };

  const holders = [...(extras.majorHolders ?? [])].sort((a, b) =>
    a.weekDate.localeCompare(b.weekDate),
  );
  const revenue = [...(extras.revenue ?? [])]
    .map((r) => ({ ...r, availableOn: revenuePublishDeadline(r.month) }))
    .sort((a, b) => a.availableOn.localeCompare(b.availableOn));

  return prices.map((p, i) => {
    const prevClose = i > 0 ? (closes[i - 1] as number) : null;
    const avgVolume20d = i > 0 ? (volSma20[i - 1] ?? null) : null;
    const yearStart = Math.max(0, i - SESSIONS_PER_YEAR + 1);
    const hasYear = i + 1 >= SESSIONS_PER_YEAR;
    const yearWindow = prices.slice(yearStart, i + 1);

    return {
      date: p.date,
      close: p.close,
      changePct: prevClose ? ((p.close - prevClose) / prevClose) * 100 : null,
      sma5: at(sma5, i),
      sma20: at(sma20, i),
      sma60: at(sma60, i),
      sma120: at(sma120, i),
      rsi14: at(rsi14, i),
      macd: at(m.macd, i),
      macdSignal: at(m.signal, i),
      macdHist: at(m.histogram, i),
      bbUpper: at(bb.upper, i),
      bbLower: at(bb.lower, i),
      atr14: at(atr14, i),
      avgVolume20d,
      volumeRatio: avgVolume20d ? p.volume / avgVolume20d : null,
      high52w: hasYear ? Math.max(...yearWindow.map((b) => b.high)) : null,
      low52w: hasYear ? Math.min(...yearWindow.map((b) => b.low)) : null,
      foreignNetBuyStreak: streaks.foreign[i] ?? null,
      trustNetBuyStreak: streaks.trust[i] ?? null,
      dealerNetBuyStreak: streaks.dealer[i] ?? null,
      ...majorHolderFields(holders, p.date),
      revenueYoy: lastOnOrBefore(revenue, p.date, (r) => r.availableOn)?.yoy ?? null,
      ...chipFields(
        p,
        chipByDate.get(p.date),
        chipByDate.get(prices[i - 5]?.date ?? ""),
        chipByDate.get(prices[i - 20]?.date ?? ""),
      ),
    };
  });
}

/**
 * Signed run length of same-direction net flow. A session with zero net flow resets to 0;
 * a session with no flow data at all yields null and breaks the run.
 */
function streakSeries(
  prices: PricePoint[],
  flowByDate: Map<string, FlowPoint>,
  pick: (f: FlowPoint) => number,
): (number | null)[] {
  let run: number | null = null;
  return prices.map((p) => {
    const flow = flowByDate.get(p.date);
    if (!flow) {
      run = null;
      return null;
    }
    const sign = Math.sign(pick(flow));
    if (sign === 0) run = 0;
    else if (run != null && Math.sign(run) === sign) run += sign;
    else run = sign;
    return run;
  });
}

function chipFields(
  bar: PricePoint,
  today: ChipPoint | undefined,
  fiveAgo: ChipPoint | undefined,
  twentyAgo: ChipPoint | undefined,
) {
  const margin = today?.marginBalance ?? null;
  const margin5 = fiveAgo?.marginBalance ?? null;
  const foreign = today?.foreignHoldingPct ?? null;
  const foreign20 = twentyAgo?.foreignHoldingPct ?? null;
  const dayTrade = today?.dayTradeVolume ?? null;
  return {
    marginBalance: margin,
    marginChange5d: margin != null && margin5 ? ((margin - margin5) / margin5) * 100 : null,
    shortMarginRatio:
      margin && today?.shortBalance != null ? (today.shortBalance / margin) * 100 : null,
    foreignHoldingPct: foreign,
    foreignHoldingChange20d: foreign != null && foreign20 != null ? foreign - foreign20 : null,
    dayTradePct: dayTrade != null && bar.volume > 0 ? (dayTrade / bar.volume) * 100 : null,
  };
}

function majorHolderFields(holders: MajorHolderPoint[], date: string) {
  const latest = lastOnOrBefore(holders, date, (h) => h.weekDate);
  if (!latest) return { majorHolderPct: null, majorHolderPctChange4w: null };
  const earlier = lastOnOrBefore(holders, addDays(latest.weekDate, -28), (h) => h.weekDate);
  return {
    majorHolderPct: latest.pct,
    majorHolderPctChange4w: earlier ? latest.pct - earlier.pct : null,
  };
}

/** Companies must publish monthly revenue by the 10th of the following month. */
export function revenuePublishDeadline(month: string): string {
  const d = new Date(`${month}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10)).toISOString().slice(0, 10);
}

/** Last item (by ascending `key`) whose key is on or before `date`. */
function lastOnOrBefore<T>(sorted: T[], date: string, key: (item: T) => string): T | undefined {
  let found: T | undefined;
  for (const item of sorted) {
    if (key(item) > date) break;
    found = item;
  }
  return found;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function at(series: Series, i: number): number | null {
  return series[i] ?? null;
}
