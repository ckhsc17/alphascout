import { describe, expect, it } from "vitest";
import { atr, bollinger, ema, macd, rsi, sma } from "./index.ts";

// Closing prices from Wilder's RSI worked example, as reproduced on StockCharts
// ("Relative Strength Index (RSI)" ChartSchool article).
const WILDER_CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28,
  46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
];

describe("sma", () => {
  it("averages a rolling window and pads the warm-up with null", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("returns all nulls when the series is shorter than the period", () => {
    expect(sma([1, 2], 3)).toEqual([null, null]);
  });

  it("rejects invalid periods", () => {
    expect(() => sma([1, 2, 3], 0)).toThrow(RangeError);
  });
});

describe("ema", () => {
  it("seeds with the SMA and then applies the smoothing factor", () => {
    // k = 2 / (3 + 1) = 0.5; seed = (1 + 2 + 3) / 3 = 2
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    expect(ema([2, 4, 6, 10], 3)).toEqual([null, null, 4, 7]);
  });
});

describe("rsi", () => {
  it("matches Wilder's worked example", () => {
    // StockCharts rounds its intermediate averages and shows 70.53 / 66.32 / 66.55;
    // the unrounded values are below (first averages: gain 3.34 / 14, loss 1.40 / 14).
    const out = rsi(WILDER_CLOSES, 14);
    expect(out.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(out[14]).toBeCloseTo(70.464, 2);
    expect(out[15]).toBeCloseTo(66.25, 1);
    expect(out[16]).toBeCloseTo(66.48, 1);
  });

  it("is 100 for a strictly rising series and 0 for a strictly falling one", () => {
    const up = Array.from({ length: 20 }, (_, i) => i);
    expect(rsi(up, 14).at(-1)).toBe(100);
    expect(rsi([...up].reverse(), 14).at(-1)).toBe(0);
  });

  it("is 50 for a flat series", () => {
    expect(rsi(new Array(20).fill(10), 14).at(-1)).toBe(50);
  });
});

describe("macd", () => {
  it("is zero everywhere on a flat series once warmed up", () => {
    const { macd: line, signal, histogram } = macd(new Array(40).fill(100));
    expect(line[24]).toBeNull();
    expect(line[25]).toBe(0);
    expect(signal[32]).toBeNull();
    expect(signal[33]).toBe(0);
    expect(histogram.at(-1)).toBe(0);
  });

  it("is positive in a steady uptrend", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const result = macd(closes);
    expect(result.macd.at(-1)).toBeGreaterThan(0);
  });
});

describe("bollinger", () => {
  it("uses the population standard deviation", () => {
    // mean 5, population sd 2
    const { middle, upper, lower } = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2);
    expect(middle.at(-1)).toBe(5);
    expect(upper.at(-1)).toBe(9);
    expect(lower.at(-1)).toBe(1);
  });
});

describe("atr", () => {
  it("uses true range including gaps from the previous close", () => {
    const bars = [
      { high: 10, low: 8, close: 9 }, // TR 2
      { high: 12, low: 11, close: 11.5 }, // gap up: TR = 12 - 9 = 3
      { high: 11, low: 7, close: 8 }, // gap down: TR = 11.5 - 7 = 4.5
      { high: 9, low: 8, close: 8.5 }, // TR 1
    ];
    const out = atr(bars, 3);
    const first = (2 + 3 + 4.5) / 3;
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(first);
    expect(out[3]).toBeCloseTo((first * 2 + 1) / 3); // Wilder smoothing
  });
});
