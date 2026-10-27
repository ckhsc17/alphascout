import { getTableColumns, type SQL, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db } from "./index.ts";

/** Same conversion drizzle applies for `casing: "snake_case"` (drizzle-orm/casing). */
function toSnakeCase(input: string): string {
  const words = input.match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((w) => w.toLowerCase()).join("_");
}

function columnName(column: PgColumn): string {
  return column.keyAsName ? toSnakeCase(column.name) : column.name;
}

/**
 * The `on conflict do update set …` assignments: every supplied column except the conflict
 * target, taking the incoming (`excluded`) value.
 */
export function conflictUpdateSet<T extends PgTable>(
  table: T,
  rows: T["$inferInsert"][],
  conflictTarget: PgColumn[],
): Record<string, SQL> {
  const keyNames = new Set(conflictTarget.map(columnName));
  const supplied = new Set(rows.flatMap((r) => Object.keys(r as object)));
  const set: Record<string, SQL> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    const name = columnName(column as PgColumn);
    if (supplied.has(key) && !keyNames.has(name)) set[key] = sql.raw(`excluded."${name}"`);
  }
  return set;
}

/**
 * Inserts rows in chunks; on primary-key / unique conflict, overwrites the columns present in the
 * incoming rows (other than the conflict target) with the incoming values. Columns the caller did
 * not supply — serial ids, created_at — are left untouched. Returns the number of rows written.
 */
export async function upsertRows<T extends PgTable>(
  db: Db,
  table: T,
  rows: T["$inferInsert"][],
  conflictTarget: PgColumn[],
  chunkSize = 1000,
): Promise<number> {
  if (rows.length === 0) return 0;
  const set = conflictUpdateSet(table, rows, conflictTarget);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const insert = db.insert(table).values(chunk);
    await (Object.keys(set).length > 0
      ? insert.onConflictDoUpdate({ target: conflictTarget, set })
      : insert.onConflictDoNothing({ target: conflictTarget }));
  }
  return rows.length;
}
