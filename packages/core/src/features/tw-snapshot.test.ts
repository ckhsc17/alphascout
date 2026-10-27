import { describe, expect, it } from "vitest";
import { computeTwSnapshots, type FlowPoint, type PricePoint } from "./tw-snapshot.ts";

function bars(closes: number[], volume = 1000): PricePoint[] {
  return closes.map((close, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
  }));
}

describe("computeTwSnapshots", () => {
  it("computes change and moving averages aligned with each bar", () => {
    const snaps = computeTwSnapshots(bars([10, 11, 12, 13, 14, 15]), []);
    expect(snaps[0]?.changePct).toBeNull();
    expect(snaps[1]?.changePct).toBeCloseTo(10);
    expect(snaps[3]?.sma5).toBeNull();
    expect(snaps[4]?.sma5).toBe(12);
    expect(snaps[5]?.sma5).toBe(13);
  });

  it("compares today's volume with the previous 20 sessions", () => {
    const prices = bars(new Array(21).fill(10), 1000);
    (prices[20] as PricePoint).volume = 3000;
    const last = computeTwSnapshots(prices, []).at(-1);
    expect(last?.avgVolume20d).toBe(1000);
    expect(last?.volumeRatio).toBe(3);
  });

  it("only fills 52-week range once a full year of sessions exists", () => {
    const short = computeTwSnapshots(bars(new Array(249).fill(10)), []);
    expect(short.at(-1)?.high52w).toBeNull();

    const closes = Array.from({ length: 250 }, (_, i) => 100 + (i % 7));
    const full = computeTwSnapshots(bars(closes), []);
    expect(full.at(-1)?.high52w).toBe(107);
    expect(full.at(-1)?.low52w).toBe(99);
  });

  it("tracks signed buy / sell streaks per investor type", () => {
    const prices = bars([10, 10, 10, 10, 10, 10]);
    const nets = [5, 3, -1, -2, -4, 0];
    const flows: FlowPoint[] = prices.map((p, i) => ({
      date: p.date,
      foreignNet: nets[i] as number,
      trustNet: 1,
      dealerNet: 0,
    }));
    const snaps = computeTwSnapshots(prices, flows);
    expect(snaps.map((s) => s.foreignNetBuyStreak)).toEqual([1, 2, -1, -2, -3, 0]);
    expect(snaps.map((s) => s.trustNetBuyStreak)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(snaps.at(-1)?.dealerNetBuyStreak).toBe(0);
  });

  it("breaks a streak when a session has no flow data", () => {
    const prices = bars([10, 10, 10]);
    const flows: FlowPoint[] = [
      { date: prices[0]!.date, foreignNet: 1, trustNet: 0, dealerNet: 0 },
      { date: prices[2]!.date, foreignNet: 1, trustNet: 0, dealerNet: 0 },
    ];
    expect(computeTwSnapshots(prices, flows).map((s) => s.foreignNetBuyStreak)).toEqual([
      1,
      null,
      1,
    ]);
  });

  it("uses the latest major-holder week and its 4-week change", () => {
    const prices = bars(new Array(31).fill(10)); // 2026-01-01 … 2026-01-31
    const snaps = computeTwSnapshots(prices, [], {
      majorHolders: [
        { weekDate: "2026-01-02", pct: 50 },
        { weekDate: "2026-01-09", pct: 51 },
        { weekDate: "2026-01-30", pct: 53.5 },
      ],
    });
    expect(snaps[0]).toMatchObject({ majorHolderPct: null, majorHolderPctChange4w: null });
    expect(snaps[9]).toMatchObject({ majorHolderPct: 51, majorHolderPctChange4w: null });
    // 01-30 vs the latest week on or before 01-02.
    expect(snaps[29]?.majorHolderPct).toBe(53.5);
    expect(snaps[29]?.majorHolderPctChange4w).toBeCloseTo(3.5);
  });

  it("only uses monthly revenue once its publication deadline has passed", () => {
    const prices = bars(new Array(20).fill(10)); // 2026-01-01 … 2026-01-20
    const snaps = computeTwSnapshots(prices, [], {
      revenue: [
        { month: "2025-11-01", yoy: 5 }, // due 2025-12-10
        { month: "2025-12-01", yoy: 12 }, // due 2026-01-10
      ],
    });
    expect(snaps[8]?.revenueYoy).toBe(5); // 01-09
    expect(snaps[9]?.revenueYoy).toBe(12); // 01-10
  });
});
