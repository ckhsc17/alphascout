import { sql } from "drizzle-orm";
import { z } from "zod";
import { SCREEN_PRESETS } from "../screener/presets.ts";
import { runScreen } from "../screener/run.ts";
import { screenSchema } from "../screener/schema.ts";
import { type Dataset, DatasetError, defineDataset } from "./define.ts";
import {
  twInsiderTransfers,
  twInstitutionalFlows,
  twMajorHolders,
  twMonthlyRevenue,
  twPrices,
  twSearch,
  twTechnicals,
} from "./tw.ts";
import {
  us13fChanges,
  us13fConsensus,
  usInsiderClusters,
  usInsiderTrades,
  usInvestors,
} from "./us.ts";

export * from "./define.ts";
export { resolveTwSecurity } from "./tw.ts";

export const twScreen = defineDataset({
  id: "tw.screen",
  title: "Screen Taiwan stocks",
  description:
    "Filter Taiwan stocks on the latest indicator snapshot with a JSON condition tree. Either pass `preset` (see tw.screen_presets) or `screen`.",
  params: z
    .object({
      preset: z.string().optional(),
      screen: screenSchema.optional(),
    })
    .refine((p) => (p.preset == null) !== (p.screen == null), {
      message: "Provide exactly one of `preset` or `screen`",
    }),
  example: {
    screen: {
      where: {
        all: [
          { field: "trust_streak", op: ">=", value: 3 },
          { field: "close", op: "crosses_above", ref: "sma20" },
          { field: "avg_volume_20d_lots", op: ">=", value: 500 },
        ],
      },
      sort: { field: "trust_streak", dir: "desc" },
      limit: 20,
    },
  },
  source: "AlphaScout indicator snapshots",
  openColumns: true,
  columns: {
    symbol: { type: "string", description: "Stock code" },
    name: { type: "string", description: "Short name" },
    board: { type: "string", description: "TWSE / TPEx" },
    industry: { type: "string", description: "Industry" },
    close: { type: "number", description: "Close", unit: "TWD" },
    change_pct: { type: "number", description: "Daily change", unit: "%" },
  },
  notes: ["Fields used in conditions and sort are added as extra columns."],
  async run(db, { preset, screen }) {
    let resolved = screen;
    if (preset) {
      const found = SCREEN_PRESETS.find((p) => p.slug === preset);
      if (!found) {
        throw new DatasetError(
          `Unknown preset "${preset}". Available: ${SCREEN_PRESETS.map((p) => p.slug).join(", ")}`,
        );
      }
      resolved = screenSchema.parse(found.screen);
    }
    const result = await runScreen(db, resolved as z.output<typeof screenSchema>);
    return { asOf: result.date, rows: result.rows };
  },
});

export const twScreenPresets = defineDataset({
  id: "tw.screen_presets",
  title: "Preset screens",
  description: "Built-in screening strategies and their condition trees.",
  params: z.object({}),
  example: {},
  source: "AlphaScout",
  columns: {
    slug: { type: "string", description: "Pass as `preset` to tw.screen" },
    name: { type: "string", description: "Name" },
    description: { type: "string", description: "What it looks for" },
    screen: { type: "string", description: "Condition tree (JSON)" },
  },
  async run() {
    return {
      asOf: null,
      rows: SCREEN_PRESETS.map((p) => ({
        slug: p.slug,
        name: p.name,
        description: p.description,
        screen: JSON.stringify(p.screen),
      })),
    };
  },
});

export const dataFreshness = defineDataset({
  id: "meta.freshness",
  title: "Data freshness",
  description: "When each ingestion job last succeeded and which date / period it covered.",
  params: z.object({}),
  example: {},
  source: "AlphaScout ingest_runs",
  columns: {
    job: { type: "string", description: "Ingestion job" },
    target: { type: "string", description: "Date / period covered by the last successful run" },
    finished_at: { type: "string", description: "When it finished (UTC)" },
  },
  async run(db) {
    const rows = await db.execute<Record<string, unknown>>(sql`
      select distinct on (job) job, target, finished_at from ingest_runs
      where status = 'succeeded' order by job, finished_at desc`);
    return {
      asOf: null,
      rows: rows.map((r) => ({
        job: r.job as string,
        target: (r.target as string | null) ?? null,
        finished_at: r.finished_at == null ? null : new Date(r.finished_at as string).toISOString(),
      })),
    };
  },
});

export const DATASETS: Dataset[] = [
  twSearch,
  twPrices,
  twTechnicals,
  twInstitutionalFlows,
  twMajorHolders,
  twMonthlyRevenue,
  twInsiderTransfers,
  twScreen,
  twScreenPresets,
  usInvestors,
  us13fChanges,
  us13fConsensus,
  usInsiderTrades,
  usInsiderClusters,
  dataFreshness,
] as Dataset[];

export function getDataset(id: string): Dataset {
  const dataset = DATASETS.find((d) => d.id === id);
  if (!dataset) {
    throw new DatasetError(
      `Unknown dataset "${id}". Available: ${DATASETS.map((d) => d.id).join(", ")}`,
    );
  }
  return dataset;
}
