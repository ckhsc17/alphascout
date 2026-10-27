import { describe, expect, it } from "vitest";
import * as schema from "./schema/index.ts";
import { conflictUpdateSet } from "./upsert.ts";

describe("conflictUpdateSet", () => {
  it("never overwrites columns the caller did not supply (serial id, created_at)", () => {
    const set = conflictUpdateSet(
      schema.securities,
      [{ market: "TW", symbol: "2330", name: "台積電", isActive: true, updatedAt: new Date() }],
      [schema.securities.market, schema.securities.symbol],
    );
    expect(Object.keys(set).sort()).toEqual(["isActive", "name", "updatedAt"]);
  });

  it("uses the snake_case column names drizzle generates", () => {
    const set = conflictUpdateSet(
      schema.twIndicatorSnapshots,
      [{ securityId: 1, date: "2026-10-27", avgVolume20d: 1, high52w: 2 }],
      [schema.twIndicatorSnapshots.securityId, schema.twIndicatorSnapshots.date],
    );
    expect(Object.keys(set).sort()).toEqual(["avgVolume20d", "high52w"]);
    expect(JSON.stringify(set.avgVolume20d)).toContain('excluded.\\"avg_volume20d\\"');
  });
});
