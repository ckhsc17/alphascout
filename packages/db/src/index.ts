import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export interface DbOptions {
  /** Pool size. */
  max?: number;
}

export function createDb(url = process.env.DATABASE_URL, options: DbOptions = {}) {
  if (!url) throw new Error("DATABASE_URL is not set");
  // `prepare: false` keeps us compatible with transaction-mode poolers (Neon / PgBouncer).
  const client = postgres(url, { prepare: false, max: options.max });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

// Re-exported so apps share this package's drizzle-orm instance (a second copy, resolved with
// different optional peers, makes column types incompatible).
export { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
export { upsertRows } from "./upsert.ts";
export { schema };
