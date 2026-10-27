import {
  extractOwnershipXml,
  parseAcceptanceDateTime,
  parseDailyFormIndex,
  parseForm4,
} from "@alphascout/core/providers/sec";
import { type Db, schema } from "@alphascout/db";
import { inArray } from "drizzle-orm";
import { fetchText, HttpError } from "../lib/http.ts";
import { log } from "../lib/run.ts";
import { secHeaders } from "./sec.ts";

const CONCURRENCY = 4;

/**
 * Ingests every Form 4 disseminated on `date` (from EDGAR's daily form index). Filings already
 * stored are skipped, so re-running a day is cheap. Returns the number of transactions stored.
 */
export async function ingestForm4Day(db: Db, date: string): Promise<number> {
  const [year, month, day] = date.split("-") as [string, string, string];
  const quarter = Math.ceil(Number(month) / 3);
  const indexUrl = `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${quarter}/form.${year}${month}${day}.idx`;

  let idx: string;
  try {
    idx = await fetchText(indexUrl, secHeaders());
  } catch (err) {
    // No index is published for weekends and federal holidays.
    if (err instanceof HttpError && (err.status === 404 || err.status === 403)) return 0;
    throw err;
  }

  const entries = parseDailyFormIndex(idx, ["4"]).map((e) => ({
    ...e,
    accession: (e.path.split("/").pop() as string).replace(/\.txt$/, ""),
  }));
  const existing = await existingAccessions(
    db,
    entries.map((e) => e.accession),
  );
  const pending = entries.filter((e) => !existing.has(e.accession));

  let stored = 0;
  let failed = 0;
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const entry = pending[next++];
      if (!entry) break;
      try {
        const submission = await fetchText(
          `https://www.sec.gov/Archives/${entry.path}`,
          secHeaders(),
        );
        const filedAt = parseAcceptanceDateTime(submission) ?? new Date(`${date}T12:00:00Z`);
        const xml = extractOwnershipXml(submission);
        if (!xml) continue;
        const trades = parseForm4(xml);
        if (trades.length === 0) continue;
        await db
          .insert(schema.usInsiderTrades)
          .values(trades.map((t) => ({ accessionNo: entry.accession, filedAt, ...t })))
          .onConflictDoNothing();
        stored += trades.length;
      } catch (err) {
        // One malformed filing should not sink the whole day.
        failed++;
        log(`form4 ${entry.accession}: ${String(err)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (failed > pending.length * 0.05) {
    throw new Error(`${failed} of ${pending.length} Form 4 filings failed for ${date}`);
  }
  log(`form4 ${date}: ${pending.length} filings, ${stored} transactions, ${failed} failed`);
  return stored;
}

async function existingAccessions(db: Db, accessions: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < accessions.length; i += 1000) {
    const rows = await db
      .selectDistinct({ accessionNo: schema.usInsiderTrades.accessionNo })
      .from(schema.usInsiderTrades)
      .where(inArray(schema.usInsiderTrades.accessionNo, accessions.slice(i, i + 1000)));
    for (const r of rows) found.add(r.accessionNo);
  }
  return found;
}
