import {
  DATASETS,
  DatasetError,
  type DatasetResult,
  getDataset,
  runDataset,
} from "@alphascout/core/datasets";
import { TRACKED_INVESTORS } from "@alphascout/core/providers/sec";
import {
  NUMERIC_FIELDS,
  SCREEN_PRESETS,
  screenSchema,
  TEXT_FIELDS,
} from "@alphascout/core/screener";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

const DISCLAIMER =
  "AlphaScout data is for research and education only and is not investment advice.";

export const SERVER_INSTRUCTIONS = `AlphaScout is an open investment-research data hub.
Markets: Taiwan stocks (TWSE/TPEx prices, 三大法人 institutional flows, 千張大戶 major holders, monthly revenue, insider transfer filings, technical indicators) and US "smart money" (13F holdings of famous investors, Form 4 insider trades).
Start with list_datasets / describe_dataset, or use the shortcut tools. Every result includes as_of (data date) and source — cite them. Numbers are computed by AlphaScout; do not recompute indicators yourself.
${DISCLAIMER}`;

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(result: DatasetResult | Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}

function fail(err: unknown): ToolResult {
  const message = err instanceof DatasetError ? err.message : "Internal error while querying data.";
  if (!(err instanceof DatasetError)) console.error(err);
  return { content: [{ type: "text", text: message }], isError: true };
}

async function query(id: string, params: unknown): Promise<ToolResult> {
  try {
    return ok(await runDataset(getDb(), getDataset(id), params));
  } catch (err) {
    return fail(err);
  }
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerAlphaScout(server: McpServer) {
  // ── Discovery ────────────────────────────────────────────────────────────

  server.registerTool(
    "list_datasets",
    {
      title: "List datasets",
      description: "List every dataset AlphaScout serves, with a one-line description.",
      annotations: READ_ONLY,
    },
    async () =>
      ok({
        datasets: DATASETS.map((d) => ({ id: d.id, title: d.title, description: d.description })),
      }),
  );

  server.registerTool(
    "describe_dataset",
    {
      title: "Describe dataset",
      description:
        "Parameters (JSON Schema), output columns with units, caveats and an example call.",
      inputSchema: z.object({ id: z.string().describe("Dataset id, e.g. tw.technicals") }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      try {
        const d = getDataset(id);
        return ok({
          id: d.id,
          title: d.title,
          description: d.description,
          params: z.toJSONSchema(d.params, { io: "input" }),
          columns: d.columns,
          notes: d.notes ?? [],
          example: d.example,
          source: d.source,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "query_dataset",
    {
      title: "Query dataset",
      description:
        "Run any dataset with its params and get tabular rows plus as_of, source and column units. Call describe_dataset first if unsure about params.",
      inputSchema: z.object({
        id: z.string().describe("Dataset id"),
        params: z.record(z.string(), z.unknown()).default({}).describe("Dataset params"),
      }),
      annotations: READ_ONLY,
    },
    async ({ id, params }) => query(id, params),
  );

  server.registerTool(
    "search_securities",
    {
      title: "Search Taiwan stocks",
      description: "Find Taiwan stock codes by code or name (e.g. 台積, 2330, 聯發科).",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().max(50).optional(),
      }),
      annotations: READ_ONLY,
    },
    async (args) => query("tw.search", args),
  );

  // ── Taiwan shortcuts ─────────────────────────────────────────────────────

  server.registerTool(
    "get_stock_overview",
    {
      title: "Taiwan stock overview",
      description:
        "One-call overview of a Taiwan stock: latest indicator snapshot, last 10 days of institutional flows, recent major-holder weeks and the last 6 months of revenue.",
      inputSchema: z.object({ symbol: z.string().describe("Taiwan stock code, e.g. 2330") }),
      annotations: READ_ONLY,
    },
    async ({ symbol }) => {
      try {
        const db = getDb();
        const [technicals, flows, holders, revenue] = await Promise.all([
          runDataset(db, getDataset("tw.technicals"), { symbol, days: 1 }),
          runDataset(db, getDataset("tw.institutional_flows"), { symbol, days: 10 }),
          runDataset(db, getDataset("tw.major_holders"), { symbol, weeks: 5 }),
          runDataset(db, getDataset("tw.monthly_revenue"), { symbol, months: 6 }),
        ]);
        return ok({
          symbol,
          snapshot: { as_of: technicals.asOf, ...technicals.rows[0] },
          institutional_flows: { as_of: flows.asOf, unit: "lots", rows: flows.rows },
          major_holders: { as_of: holders.asOf, rows: holders.rows },
          monthly_revenue: { as_of: revenue.asOf, unit: "thousand TWD", rows: revenue.rows },
          column_docs: technicals.columns,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "screen_tw_stocks",
    {
      title: "Screen Taiwan stocks",
      description: `Filter Taiwan stocks on the latest indicator snapshot. Pass a preset slug (${SCREEN_PRESETS.map((p) => p.slug).join(", ")}) or a condition tree.
Condition: {field, op, value | ref, multiplier?}; ops: > >= < <= =, between {min,max}, crosses_above / crosses_below (vs. previous session), text fields support = / in.
Combine with {"all": [...]} or {"any": [...]}. Add {"field":"avg_volume_20d_lots","op":">=","value":500} to keep results liquid.
Numeric fields: ${Object.keys(NUMERIC_FIELDS).join(", ")}. Text fields: ${Object.keys(TEXT_FIELDS).join(", ")}.`,
      inputSchema: z.object({
        preset: z.string().optional(),
        // Validated by the dataset so errors explain which field / operator is wrong.
        screen: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            `Condition tree; JSON Schema: ${JSON.stringify(z.toJSONSchema(screenSchema, { io: "input" }))}`,
          ),
      }),
      annotations: READ_ONLY,
    },
    async (args) => query("tw.screen", args),
  );

  // ── US smart money shortcuts ─────────────────────────────────────────────

  server.registerTool(
    "get_investor_moves",
    {
      title: "Investor 13F moves",
      description: `What a famous investor bought, added, trimmed or exited last quarter (13F). Investors: ${TRACKED_INVESTORS.map((i) => `${i.slug} (${i.manager})`).join("; ")}.`,
      inputSchema: z.object({
        investor: z.string(),
        period: z.string().optional().describe('Quarter end YYYY-MM-DD or "latest"'),
        actions: z.array(z.enum(["new", "add", "trim", "exit", "hold"])).optional(),
        limit: z.number().int().max(500).optional(),
      }),
      annotations: READ_ONLY,
    },
    async (args) => query("us.13f_changes", args),
  );

  server.registerTool(
    "get_consensus_picks",
    {
      title: "Smart-money consensus",
      description:
        "Stocks that several tracked investors bought (mode=buying) or hold (mode=holding) in the same quarter.",
      inputSchema: z.object({
        mode: z.enum(["buying", "holding"]).optional(),
        min_investors: z.number().int().optional(),
        period: z.string().optional(),
        limit: z.number().int().max(100).optional(),
      }),
      annotations: READ_ONLY,
    },
    async (args) => query("us.13f_consensus", args),
  );

  server.registerTool(
    "get_insider_activity",
    {
      title: "US insider activity",
      description:
        "Form 4 insider trades. mode=trades lists transactions (default: open-market purchases); mode=clusters finds companies where several insiders bought meaningfully in the window.",
      inputSchema: z.object({
        mode: z.enum(["trades", "clusters"]).default("trades"),
        ticker: z.string().optional(),
        days: z.number().int().max(365).optional(),
        min_value_usd: z.number().optional().describe("trades mode: minimum trade value"),
        min_insiders: z.number().int().optional().describe("clusters mode"),
        exclude_10b5_1: z.boolean().optional(),
        limit: z.number().int().max(200).optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ mode, min_insiders, ...rest }) => {
      if (mode === "clusters") {
        const { ticker: _t, min_value_usd: _v, ...clusterArgs } = rest;
        return query("us.insider_clusters", { ...clusterArgs, min_insiders });
      }
      return query("us.insider_trades", rest);
    },
  );

  // ── Resources ────────────────────────────────────────────────────────────

  server.registerResource(
    "datasets",
    "alphascout://datasets",
    { title: "Dataset catalog", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            DATASETS.map((d) => ({
              id: d.id,
              title: d.title,
              description: d.description,
              columns: d.columns,
              notes: d.notes ?? [],
              example: d.example,
            })),
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "screener-fields",
    "alphascout://screener/fields",
    { title: "Screener fields and presets", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            numeric: Object.fromEntries(
              Object.entries(NUMERIC_FIELDS).map(([k, v]) => [k, v.description]),
            ),
            text: Object.fromEntries(
              Object.entries(TEXT_FIELDS).map(([k, v]) => [k, v.description]),
            ),
            presets: SCREEN_PRESETS,
          }),
        },
      ],
    }),
  );

  server.registerResource(
    "investors",
    "alphascout://investors",
    { title: "Tracked 13F investors", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "application/json", text: JSON.stringify(TRACKED_INVESTORS) },
      ],
    }),
  );

  // ── Prompts ──────────────────────────────────────────────────────────────

  server.registerPrompt(
    "analyze_stock",
    {
      title: "Analyze a Taiwan stock",
      description:
        "Technicals, institutional flows, major holders and revenue → bull/bear case and risks.",
      argsSchema: z.object({ symbol: z.string().describe("Taiwan stock code, e.g. 2330") }),
    },
    async ({ symbol }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use AlphaScout's get_stock_overview for ${symbol} (and tw.prices if you need the chart context). Then write:
1. Trend & momentum (moving averages, RSI, MACD) — cite the numbers.
2. Chip flows: foreign / investment trust / dealer streaks and 千張大戶 changes.
3. Fundamentals momentum: monthly revenue YoY / MoM.
4. Three bullish points, three bearish points, key risks and the price levels that would invalidate the view.
State the data date (as_of). End with: "${DISCLAIMER}"`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "investor_quarterly_review",
    {
      title: "Review an investor's quarter",
      description: "Summarize a famous investor's latest 13F moves and portfolio concentration.",
      argsSchema: z.object({ investor: z.string().describe("Slug, e.g. berkshire-hathaway") }),
    },
    async ({ investor }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use AlphaScout's get_investor_moves for ${investor} (latest quarter, limit 100). Summarize new positions, full exits, the biggest adds and trims, top-10 concentration and sector tilts. Remind the reader that 13F data is delayed up to 45 days and excludes shorts. End with: "${DISCLAIMER}"`,
          },
        },
      ],
    }),
  );
}
