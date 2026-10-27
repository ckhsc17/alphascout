import { type Db, schema } from "@alphascout/db";
import { eq } from "drizzle-orm";

/** Records the job in `ingest_runs` so the site can show data freshness and failures. */
export async function withIngestRun(
  db: Db,
  job: string,
  target: string | null,
  fn: () => Promise<number>,
): Promise<number> {
  const [run] = await db
    .insert(schema.ingestRuns)
    .values({ job, target })
    .returning({ id: schema.ingestRuns.id });
  if (!run) throw new Error("failed to create ingest run");

  const started = Date.now();
  try {
    const rows = await fn();
    await db
      .update(schema.ingestRuns)
      .set({ status: "succeeded", rows, finishedAt: new Date() })
      .where(eq(schema.ingestRuns.id, run.id));
    log(`${job}${target ? ` ${target}` : ""}: ${rows} rows in ${Date.now() - started}ms`);
    return rows;
  } catch (err) {
    await db
      .update(schema.ingestRuns)
      .set({ status: "failed", error: String(err), finishedAt: new Date() })
      .where(eq(schema.ingestRuns.id, run.id));
    throw err;
  }
}

export function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
