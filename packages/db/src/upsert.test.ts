import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import * as schema from "./schema/index.ts";

describe("upsertRows conflict clause", () => {
  it("never overwrites columns the caller did not supply (serial id, created_at)", async () => {
    // Capture the SQL instead of executing it.
    const statements: string[] = [];
    const db = drizzle.mock({ schema, casing: "snake_case" });
    const original = db.insert.bind(db);
    // biome-ignore lint/suspicious/noExplicitAny: test shim
    (db as any).insert = (table: any) => {
      const builder = original(table);
      const values = builder.values.bind(builder);
      // biome-ignore lint/suspicious/noExplicitAny: test shim
      builder.values = (v: any) => {
        const b = values(v);
        const onConflict = b.onConflictDoUpdate.bind(b);
        // biome-ignore lint/suspicious/noExplicitAny: test shim
        b.onConflictDoUpdate = (cfg: any) => {
          const q = onConflict(cfg);
          statements.push(new PgDialect({ casing: "snake_case" }).sqlToQuery(q.getSQL()).sql);
          return Promise.resolve();
        };
        return b;
      };
      return builder;
    };
    const { upsertRows } = await import("./upsert.ts");
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await upsertRows(
      db as any,
      schema.securities,
      [{ market: "TW", symbol: "2330", name: "台積電", isActive: true, updatedAt: new Date() }],
      [schema.securities.market, schema.securities.symbol],
    );

    const sql = statements[0] ?? "";
    const setClause = sql.slice(sql.indexOf("do update set"));
    expect(setClause).toContain('"name" = excluded."name"');
    expect(setClause).not.toContain('"id"');
    expect(setClause).not.toContain('"created_at"');
  });
});
