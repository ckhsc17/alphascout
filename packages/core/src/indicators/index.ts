/**
 * Technical indicators.
 *
 * Every function returns a series aligned with its input: `out[i]` belongs to `input[i]`,
 * and positions inside the warm-up window are `null`.
 */

export type Series = (number | null)[];

export interface Bar {
  high: number;
  low: number;
  close: number;
}

export function sma(values: number[], period: number): Series {
  assertPeriod(period);
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] as number;
    if (i >= period) sum -= values[i - period] as number;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(values: number[], period: number): Series {
  assertPeriod(period);
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = mean(values.slice(0, period));
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (values[i] as number) * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Relative Strength Index using Wilder's smoothing. */
export function rsi(closes: number[], period = 14): Series {
  assertPeriod(period);
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = (closes[i] as number) - (closes[i - 1] as number);
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = toRsi(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = (closes[i] as number) - (closes[i - 1] as number);
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  histogram: Series;
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  if (fast >= slow) throw new RangeError("fast period must be shorter than slow period");
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine: Series = closes.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f == null || s == null ? null : f - s;
  });

  // The signal line is an EMA over the defined part of the MACD line.
  const start = slow - 1;
  const defined = macdLine.slice(start) as number[];
  const signal: Series = [...new Array(start).fill(null), ...ema(defined, signalPeriod)];
  const histogram: Series = macdLine.map((m, i) => {
    const s = signal[i];
    return m == null || s == null ? null : m - s;
  });
  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  middle: Series;
  upper: Series;
  lower: Series;
}

/** Bollinger Bands using the population standard deviation. */
export function bollinger(closes: number[], period = 20, multiplier = 2): BollingerResult {
  const middle = sma(closes, period);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const m = middle[i] as number;
    const window = closes.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(mean(window.map((v) => (v - m) ** 2)));
    upper[i] = m + multiplier * sd;
    lower[i] = m - multiplier * sd;
  }
  return { middle, upper, lower };
}

/** Average True Range using Wilder's smoothing. */
export function atr(bars: Bar[], period = 14): Series {
  assertPeriod(period);
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length < period) return out;

  const tr = bars.map((bar, i) => {
    if (i === 0) return bar.high - bar.low;
    const prevClose = (bars[i - 1] as Bar).close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose),
    );
  });

  let prev = mean(tr.slice(0, period));
  out[period - 1] = prev;
  for (let i = period; i < bars.length; i++) {
    prev = (prev * (period - 1) + (tr[i] as number)) / period;
    out[i] = prev;
  }
  return out;
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function assertPeriod(period: number) {
  if (!Number.isInteger(period) || period < 1) {
    throw new RangeError(`period must be a positive integer, got ${period}`);
  }
}
