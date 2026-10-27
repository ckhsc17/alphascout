import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { explainIssues } from "../datasets/define.ts";
import { compileWhere, referencedFields, usesCrosses } from "./compile.ts";
import { SCREEN_PRESETS } from "./presets.ts";
import { screenSchema } from "./schema.ts";

const dialect = new PgDialect();
const render = (input: unknown) => {
  const screen = screenSchema.parse(input);
  return dialect.sqlToQuery(compileWhere(screen.where));
};

describe("screen schema", () => {
  it("rejects fields outside the whitelist and lists the valid ones", () => {
    const result = screenSchema.safeParse({
      where: { field: "close; drop table securities", op: ">", value: 1 },
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("rsi14");
  });

  it("requires exactly one of value or ref", () => {
    expect(screenSchema.safeParse({ where: { field: "close", op: ">" } }).success).toBe(false);
    expect(
      screenSchema.safeParse({ where: { field: "close", op: ">", value: 1, ref: "sma20" } })
        .success,
    ).toBe(false);
  });

  it("caps the result size", () => {
    expect(
      screenSchema.safeParse({ where: { field: "rsi14", op: "<", value: 30 }, limit: 5000 })
        .success,
    ).toBe(false);
  });

  it("accepts every preset", () => {
    for (const preset of SCREEN_PRESETS) {
      expect(screenSchema.safeParse(preset.screen).success, preset.slug).toBe(true);
    }
  });
});

describe("compileWhere", () => {
  it("binds values as parameters", () => {
    const q = render({
      where: {
        all: [
          { field: "trust_streak", op: ">=", value: 3 },
          { field: "industry", op: "in", value: ["半導體業", "x' or '1'='1"] },
        ],
      },
    });
    expect(q.sql).toBe("(s.trust_net_buy_streak >= $1 and sec.industry in ($2, $3))");
    expect(q.params).toEqual([3, "半導體業", "x' or '1'='1"]);
  });

  it("compares against another field with an optional multiplier", () => {
    const q = render({ where: { field: "close", op: ">", ref: "sma20", multiplier: 1.05 } });
    expect(q.sql).toBe("s.close > s.sma20 * $1");
    expect(q.params).toEqual([1.05]);
  });

  it("expresses crosses with the previous session's snapshot", () => {
    const q = render({ where: { field: "close", op: "crosses_above", ref: "sma20" } });
    expect(q.sql).toBe("(s.close > s.sma20 and p.close <= p.sma20)");

    const v = render({ where: { field: "rsi14", op: "crosses_below", value: 70 } });
    expect(v.sql).toBe("(s.rsi14 < $1 and p.rsi14 >= $2)");
  });

  it("nests any / all groups", () => {
    const q = render({
      where: {
        any: [
          { field: "rsi14", op: "<", value: 30 },
          {
            all: [
              { field: "volume_ratio", op: ">", value: 2 },
              { field: "board", op: "=", value: "TPEx" },
            ],
          },
        ],
      },
    });
    expect(q.sql).toBe("(s.rsi14 < $1 or (s.volume_ratio > $2 and sec.board = $3))");
  });
});

describe("helpers", () => {
  it("collects referenced numeric fields including refs and sort", () => {
    const screen = screenSchema.parse({
      where: { all: [{ field: "close", op: "crosses_above", ref: "sma20" }] },
      sort: { field: "volume_ratio" },
    });
    expect(referencedFields(screen)).toEqual(["close", "sma20", "volume_ratio"]);
    expect(usesCrosses(screen.where)).toBe(true);
  });
});

describe("explainIssues", () => {
  it("surfaces the specific message from inside a union", () => {
    const result = screenSchema.safeParse({ where: { field: "rsi", op: "<", value: 30 } });
    const messages = explainIssues(result.error?.issues ?? []);
    expect(messages.some((m) => m.includes('Unknown numeric field "rsi"'))).toBe(true);
  });
});
