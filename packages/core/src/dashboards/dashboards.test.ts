import { describe, expect, it } from "vitest";
import { normalizePosition, placeWidget, shortId, VIZ_DOCS, validateWidgetSpec } from "./index.ts";

describe("validateWidgetSpec", () => {
  it("accepts every documented example", () => {
    for (const [type, doc] of Object.entries(VIZ_DOCS)) {
      const result = validateWidgetSpec(doc.example);
      expect(result.ok, `${type}: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it("explains unknown datasets and columns", () => {
    const badDataset = validateWidgetSpec({
      title: "x",
      dataset: "tw.nope",
      viz: { type: "table" },
    });
    expect(badDataset).toMatchObject({ ok: false });
    expect(JSON.stringify(badDataset)).toContain("tw.prices");

    const badColumn = validateWidgetSpec({
      title: "x",
      dataset: "tw.technicals",
      params: { symbol: "2330" },
      viz: { type: "line", x: "date", y: ["rsi"] },
    });
    expect(JSON.stringify(badColumn)).toContain('column \\"rsi\\" is not in tw.technicals');
  });

  it("rejects non-numeric y series", () => {
    const result = validateWidgetSpec({
      title: "x",
      dataset: "tw.institutional_flows",
      params: { symbol: "2330" },
      viz: { type: "bar", x: "date", y: ["date"] },
    });
    expect(JSON.stringify(result)).toContain("expected a number");
  });

  it("validates dataset params", () => {
    const result = validateWidgetSpec({
      title: "x",
      dataset: "tw.prices",
      params: { symbol: "not a code" },
      viz: { type: "candlestick" },
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain("params.symbol");
  });

  it("allows screen columns that depend on the conditions", () => {
    const result = validateWidgetSpec({
      title: "x",
      dataset: "tw.screen",
      params: { preset: "trust-buying-breakout" },
      viz: { type: "table", columns: ["symbol", "name", "trust_streak"] },
    });
    expect(result.ok).toBe(true);
  });

  it("requires a dataset except for text widgets", () => {
    expect(validateWidgetSpec({ title: "x", viz: { type: "stat", value: "close" } }).ok).toBe(
      false,
    );
    expect(validateWidgetSpec({ title: "x", viz: { type: "text", text: "hi" } }).ok).toBe(true);
  });
});

describe("placeWidget", () => {
  it("fills the first free slot left to right, top to bottom", () => {
    expect(placeWidget([], { w: 6, h: 4 })).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    expect(placeWidget([{ x: 0, y: 0, w: 6, h: 4 }], { w: 6, h: 4 })).toEqual({
      x: 6,
      y: 0,
      w: 6,
      h: 4,
    });
    expect(
      placeWidget(
        [
          { x: 0, y: 0, w: 6, h: 4 },
          { x: 6, y: 0, w: 6, h: 2 },
        ],
        { w: 6, h: 2 },
      ),
    ).toEqual({ x: 6, y: 2, w: 6, h: 2 });
  });

  it("clamps oversized widgets to the grid", () => {
    expect(placeWidget([], { w: 40, h: 3 })).toEqual({ x: 0, y: 0, w: 12, h: 3 });
  });
});

describe("normalizePosition", () => {
  it("keeps widgets inside the grid", () => {
    expect(normalizePosition({ x: 10, y: -2, w: 6, h: 100 })).toEqual({ x: 6, y: 0, w: 6, h: 24 });
  });
});

describe("shortId", () => {
  it("produces URL-safe ids of the requested length", () => {
    expect(shortId()).toMatch(/^[0-9a-zA-Z]{10}$/);
    expect(new Set(Array.from({ length: 200 }, () => shortId())).size).toBe(200);
  });
});
