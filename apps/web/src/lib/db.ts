import { createDb, type Db } from "@alphascout/db";

let db: Db | undefined;

/**
 * One small pool per function instance; Neon's pooler sits in front of Postgres.
 * Public traffic connects as `alphascout_web`, a SELECT-only role whose statement_timeout (5s)
 * is set on the role itself, because the pooler drops per-connection settings.
 */
export function getDb(): Db {
  db ??= createDb(process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL, { max: 3 });
  return db;
}
