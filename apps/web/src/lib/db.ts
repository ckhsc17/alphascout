import { createDb, type Db } from "@alphascout/db";

let readDb: Db | undefined;
let writeDb: Db | undefined;

/**
 * Pool for public market data. Connects as `alphascout_web`, a SELECT-only role whose
 * statement_timeout (5s) is set on the role itself, because the Neon pooler drops
 * per-connection settings.
 */
export function getDb(): Db {
  readDb ??= createDb(process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL, { max: 3 });
  return readDb;
}

/**
 * Pool for auth and dashboards. Connects as `alphascout_app`, which can read everything but
 * only write the account and dashboard tables.
 */
export function getWriteDb(): Db {
  writeDb ??= createDb(process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL, { max: 3 });
  return writeDb;
}
