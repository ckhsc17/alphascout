import {
  diffPositions,
  type EdgarFilingIndex,
  type EdgarSubmissions,
  edgarUrls,
  effectiveHoldings,
  findInfoTableFile,
  listFilings,
  parseThirteenFCover,
  parseThirteenFHoldings,
  previousQuarterEnd,
  TRACKED_INVESTORS,
  type TrackedInvestor,
} from "@alphascout/core/providers/sec";
import { type Db, schema, upsertRows } from "@alphascout/db";
import { eq, inArray } from "drizzle-orm";
import { fetchJson, fetchText } from "../lib/http.ts";
import { log } from "../lib/run.ts";
import { secHeaders } from "./sec.ts";

const FORMS = ["13F-HR", "13F-HR/A"];

export async function seedInvestors(db: Db): Promise<number> {
  return upsertRows(
    db,
    schema.usInvestors,
    TRACKED_INVESTORS.map(({ cik, slug, name, manager, isFeatured }) => ({
      cik,
      slug,
      name,
      manager,
      isFeatured,
    })),
    [schema.usInvestors.cik],
  );
}

/**
 * Downloads 13F filings for every tracked investor with a period on or after `since`, skipping
 * filings already stored, then recomputes quarter-over-quarter changes. Returns new filings stored.
 */
export async function ingestThirteenF(db: Db, since: string): Promise<number> {
  await seedInvestors(db);
  let stored = 0;
  for (const investor of TRACKED_INVESTORS) {
    const added = await ingestInvestor(db, investor, since);
    if (added > 0) await recomputeChanges(db, investor.cik);
    stored += added;
  }
  return stored;
}

async function ingestInvestor(db: Db, investor: TrackedInvestor, since: string): Promise<number> {
  const subs = await fetchJson<EdgarSubmissions>(edgarUrls.submissions(investor.cik), secHeaders());
  const filings = listFilings(subs, FORMS).filter((f) => f.reportDate >= since);
  if (filings.length === 0) return 0;

  const existing = await db
    .select({ accessionNo: schema.us13fFilings.accessionNo })
    .from(schema.us13fFilings)
    .where(
      inArray(
        schema.us13fFilings.accessionNo,
        filings.map((f) => f.accessionNumber),
      ),
    );
  const seen = new Set(existing.map((e) => e.accessionNo));

  let added = 0;
  for (const filing of filings) {
    if (seen.has(filing.accessionNumber)) continue;

    const index = await fetchJson<EdgarFilingIndex>(
      edgarUrls.filingIndex(investor.cik, filing.accessionNumber),
      secHeaders(),
    );
    const coverXml = await fetchText(
      edgarUrls.filingFile(investor.cik, filing.accessionNumber, "primary_doc.xml"),
      secHeaders(),
    );
    const cover = parseThirteenFCover(coverXml, filing.acceptedAt);

    const infoFile = findInfoTableFile(index);
    const holdings = infoFile
      ? parseThirteenFHoldings(
          await fetchText(
            edgarUrls.filingFile(investor.cik, filing.accessionNumber, infoFile),
            secHeaders(),
          ),
          filing.acceptedAt,
        )
      : [];

    await db.transaction(async (tx) => {
      await tx.insert(schema.us13fFilings).values({
        accessionNo: filing.accessionNumber,
        cik: investor.cik,
        periodOfReport: cover.periodOfReport,
        filedAt: filing.acceptedAt,
        formType: filing.form,
        isAmendment: cover.isAmendment,
        amendmentType: cover.amendmentType,
        totalValue: cover.totalValue,
      });
      if (holdings.length > 0) {
        await tx
          .insert(schema.us13fHoldings)
          .values(holdings.map((h) => ({ accessionNo: filing.accessionNumber, ...h })));
      }
    });
    log(
      `13F ${investor.slug} ${cover.periodOfReport} ${filing.form}: ${holdings.length} positions`,
    );
    added++;
  }
  return added;
}

/** Rebuilds `us_13f_changes` for one investor from all stored filings. */
export async function recomputeChanges(db: Db, cik: string): Promise<number> {
  const filings = await db
    .select()
    .from(schema.us13fFilings)
    .where(eq(schema.us13fFilings.cik, cik));
  if (filings.length === 0) return 0;

  const holdings = await db
    .select()
    .from(schema.us13fHoldings)
    .where(
      inArray(
        schema.us13fHoldings.accessionNo,
        filings.map((f) => f.accessionNo),
      ),
    );
  const holdingsByFiling = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const list = holdingsByFiling.get(h.accessionNo) ?? [];
    list.push(h);
    holdingsByFiling.set(h.accessionNo, list);
  }

  const periods = new Map<
    string,
    ReturnType<typeof effectiveHoldings<(typeof holdings)[number]>>
  >();
  for (const period of new Set(filings.map((f) => f.periodOfReport))) {
    periods.set(
      period,
      effectiveHoldings(
        filings
          .filter((f) => f.periodOfReport === period)
          .map((f) => ({
            filedAt: f.filedAt,
            isAmendment: f.isAmendment,
            amendmentType: f.amendmentType as "RESTATEMENT" | "NEW HOLDINGS" | null,
            holdings: holdingsByFiling.get(f.accessionNo) ?? [],
          })),
      ),
    );
  }

  const rows: (typeof schema.us13fChanges.$inferInsert)[] = [];
  for (const [period, current] of periods) {
    // Only diff against the immediately preceding quarter; otherwise every position looks "new".
    const previous = periods.get(previousQuarterEnd(period));
    if (!previous) continue;
    for (const change of diffPositions(previous, current)) {
      rows.push({ cik, period, ...change });
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.us13fChanges).where(eq(schema.us13fChanges.cik, cik));
    for (let i = 0; i < rows.length; i += 1000) {
      await tx.insert(schema.us13fChanges).values(rows.slice(i, i + 1000));
    }
  });
  return rows.length;
}
