import { parseArgs } from "node:util";
import { DATASETS, runDataset } from "@alphascout/core/datasets";
import { createDb } from "@alphascout/db";
import { addDays, todayInTaipei, weekdaysBetween } from "./lib/dates.ts";
import { log, withIngestRun } from "./lib/run.ts";
import { ingestTwDay } from "./tw/daily.ts";
import { ingestTwInsiderTransfers } from "./tw/insider.ts";
import { ingestTwRevenue, monthsBetween } from "./tw/revenue.ts";
import { loadTwSecurityIds, syncTwSecurities } from "./tw/securities.ts";
import { computeTwSnapshotRange } from "./tw/snapshots.ts";
import { ingestTdccLatest } from "./tw/tdcc.ts";
import { mapNewCusips } from "./us/cusips.ts";
import { ingestForm4Day } from "./us/form4.ts";
import { ingestThirteenF } from "./us/thirteen-f.ts";

const USAGE = `Usage: pnpm job <command> [options]

Commands:
  tw:securities                      Sync the TWSE / TPEx company list
  tw:daily [--date YYYY-MM-DD]       Ingest one day (default: today in Taipei) and update snapshots
  tw:backfill --from D --to D        Ingest every weekday in a range, then compute snapshots
  tw:snapshots --from D --to D       Recompute indicator snapshots only
  tw:revenue [--from YYYY-MM --to YYYY-MM]  Monthly revenue (default: last two months)
  tw:tdcc                            Latest weekly TDCC shareholding distribution
  tw:insider                         Latest daily insider transfer reports
  us:13f [--since YYYY-MM-DD]        Fetch new 13F filings for tracked investors (default: 9 quarters)
  us:cusips                          Map new 13F CUSIPs to tickers via OpenFIGI
  us:form4 [--date D | --from D --to D]  Ingest Form 4 insider trades (default: yesterday, UTC)
  datasets:check                     Run every dataset's example params against the database
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      date: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      since: { type: "string" },
    },
  });
  const [command] = positionals;
  const db = createDb();

  switch (command) {
    case "tw:securities":
      await withIngestRun(db, "tw:securities", null, () => syncTwSecurities(db));
      break;

    case "tw:daily": {
      const date = values.date ?? todayInTaipei();
      const ids = await loadTwSecurityIds(db);
      const result = await withIngestRun(db, "tw:daily", date, async () => {
        const r = await ingestTwDay(db, date, ids);
        return r.prices + r.flows;
      });
      if (result === 0) {
        log(`${date}: no trading session`);
        break;
      }
      await withIngestRun(db, "tw:snapshots", date, () =>
        computeTwSnapshotRange(db, [...ids.values()], date, date),
      );
      break;
    }

    case "tw:backfill": {
      const { from, to } = requireRange(values);
      const ids = await loadTwSecurityIds(db);
      for (const date of weekdaysBetween(from, to)) {
        await withIngestRun(db, "tw:daily", date, async () => {
          const r = await ingestTwDay(db, date, ids);
          return r.prices + r.flows;
        });
      }
      await withIngestRun(db, "tw:snapshots", `${from}..${to}`, () =>
        computeTwSnapshotRange(db, [...ids.values()], from, to),
      );
      break;
    }

    case "tw:snapshots": {
      const { from, to } = requireRange(values);
      const ids = await loadTwSecurityIds(db);
      await withIngestRun(db, "tw:snapshots", `${from}..${to}`, () =>
        computeTwSnapshotRange(db, [...ids.values()], from, to),
      );
      break;
    }

    case "tw:revenue": {
      const ids = await loadTwSecurityIds(db);
      const thisMonth = todayInTaipei().slice(0, 7);
      // Revenue for month M is published during M+1, so by default refresh the last two months.
      const months =
        values.from && values.to
          ? monthsBetween(values.from, values.to)
          : monthsBetween(
              addDays(`${thisMonth}-01`, -40).slice(0, 7),
              addDays(`${thisMonth}-01`, -1).slice(0, 7),
            );
      for (const month of months) {
        await withIngestRun(db, "tw:revenue", month, () => ingestTwRevenue(db, month, ids));
      }
      break;
    }

    case "tw:tdcc": {
      const ids = await loadTwSecurityIds(db);
      await withIngestRun(db, "tw:tdcc", null, () => ingestTdccLatest(db, ids));
      break;
    }

    case "tw:insider": {
      const ids = await loadTwSecurityIds(db);
      await withIngestRun(db, "tw:insider", null, () => ingestTwInsiderTransfers(db, ids));
      break;
    }

    case "us:13f": {
      // Nine quarters back, so the oldest of the last eight has a previous quarter to diff against.
      const since = values.since ?? quarterEndMonthsAgo(27);
      await withIngestRun(db, "us:13f", since, () => ingestThirteenF(db, since));
      await withIngestRun(db, "us:cusips", null, () => mapNewCusips(db));
      break;
    }

    case "us:form4": {
      const dates =
        values.from && values.to
          ? weekdaysBetween(values.from, values.to)
          : [values.date ?? addDays(new Date().toISOString().slice(0, 10), -1)];
      for (const date of dates) {
        await withIngestRun(db, "us:form4", date, () => ingestForm4Day(db, date));
      }
      break;
    }

    case "us:cusips":
      await withIngestRun(db, "us:cusips", null, () => mapNewCusips(db));
      break;

    case "datasets:check": {
      let failed = 0;
      for (const dataset of DATASETS) {
        const started = Date.now();
        try {
          const result = await runDataset(db, dataset, dataset.example);
          log(
            `ok   ${dataset.id.padEnd(22)} ${String(result.rows.length).padStart(3)} rows  asOf=${result.asOf}  ${Date.now() - started}ms`,
          );
          if (result.rows[0]) console.log(`     ${JSON.stringify(result.rows[0]).slice(0, 220)}`);
        } catch (err) {
          failed++;
          log(`FAIL ${dataset.id}: ${String(err)}`);
        }
      }
      if (failed) process.exitCode = 1;
      break;
    }

    default:
      console.error(USAGE);
      process.exitCode = 1;
  }
}

/** The calendar quarter end on or before the date `months` months ago. */
function quarterEndMonthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  const quarterEndMonth = Math.floor(d.getUTCMonth() / 3) * 3; // first month of the quarter
  const end = new Date(Date.UTC(d.getUTCFullYear(), quarterEndMonth, 0));
  return end.toISOString().slice(0, 10);
}

function requireRange(values: { from?: string; to?: string }) {
  if (!values.from || !values.to) throw new Error("--from and --to are required");
  return { from: values.from, to: values.to };
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
