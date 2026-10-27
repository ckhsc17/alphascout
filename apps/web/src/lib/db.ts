import { createDb, type Db } from "@alphascout/db";

let db: Db | undefined;

/** One small pool per function instance; Neon's pooler sits in front of Postgres. */
export function getDb(): Db {
  db ??= createDb(process.env.DATABASE_URL, { max: 3 });
  return db;
}
