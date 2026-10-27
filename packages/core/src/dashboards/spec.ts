import { z } from "zod";

const column = z.string().min(1).max(64);

/** OHLC candlesticks with moving-average overlays. Requires the tw.prices dataset. */
const candlestickViz = z.object({
  type: z.literal("candlestick"),
  overlays: z
    .array(z.enum(["sma20", "sma60"]))
    .max(2)
    .default(["sma20", "sma60"]),
});

/** One or more numeric series over `x` (usually a date column). */
const lineViz = z.object({
  type: z.enum(["line", "area"]),
  x: column,
  y: z.array(column).min(1).max(4),
});

/** Bars over a category or date. `stacked` stacks the y series. */
const barViz = z.object({
  type: z.literal("bar"),
  x: column,
  y: z.array(column).min(1).max(4),
  stacked: z.boolean().default(false),
});

const tableViz = z.object({
  type: z.literal("table"),
  /** Columns to show, in order. Defaults to all dataset columns. */
  columns: z.array(column).min(1).max(12).optional(),
  sort: z.object({ field: column, dir: z.enum(["asc", "desc"]).default("desc") }).optional(),
  /** Max rows shown. */
  limit: z.number().int().min(1).max(200).default(20),
});

/** A single number (KPI) from the first or last row. */
const statViz = z.object({
  type: z.literal("stat"),
  value: column,
  row: z.enum(["first", "last"]).default("last"),
  /** Optional second column shown as a delta / sub-value. */
  compare: column.optional(),
});

/** Free text (shown as plain text, never HTML) — e.g. the AI's notes on the dashboard. */
const textViz = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(4000),
});

export const vizSchema = z.discriminatedUnion("type", [
  candlestickViz,
  lineViz,
  barViz,
  tableViz,
  statViz,
  textViz,
]);

export type Viz = z.infer<typeof vizSchema>;
export type VizType = Viz["type"];

export const widgetSpecSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    /** Dataset id (see list_datasets). Not used by text widgets. */
    dataset: z.string().optional(),
    /** Dataset params. Use relative values ("latest", days: 30) so the widget stays current. */
    params: z.record(z.string(), z.unknown()).default({}),
    viz: vizSchema,
  })
  .refine((w) => w.viz.type === "text" || !!w.dataset, {
    message: '`dataset` is required unless viz.type is "text"',
    path: ["dataset"],
  });

export type WidgetSpec = z.infer<typeof widgetSpecSchema>;
export type WidgetSpecInput = z.input<typeof widgetSpecSchema>;

export const VIZ_DOCS: Record<VizType, { description: string; example: WidgetSpecInput }> = {
  candlestick: {
    description:
      "Daily candlesticks with 20/60-day moving averages and volume. Dataset must be tw.prices.",
    example: {
      title: "台積電日 K",
      dataset: "tw.prices",
      params: { symbol: "2330", days: 120 },
      viz: { type: "candlestick" },
    },
  },
  line: {
    description: "Numeric series (y, up to 4) over x — usually a date column.",
    example: {
      title: "2330 RSI",
      dataset: "tw.technicals",
      params: { symbol: "2330", days: 120 },
      viz: { type: "line", x: "date", y: ["rsi14"] },
    },
  },
  area: {
    description: "Same as line, filled.",
    example: {
      title: "2330 月營收",
      dataset: "tw.monthly_revenue",
      params: { symbol: "2330", months: 24 },
      viz: { type: "area", x: "month", y: ["revenue"] },
    },
  },
  bar: {
    description: "Bars per x value (date or category); set stacked for stacked series.",
    example: {
      title: "2330 三大法人",
      dataset: "tw.institutional_flows",
      params: { symbol: "2330", days: 20 },
      viz: {
        type: "bar",
        x: "date",
        y: ["foreign_net_lots", "trust_net_lots", "dealer_net_lots"],
        stacked: true,
      },
    },
  },
  table: {
    description: "Rows with chosen columns, optional sort and row limit.",
    example: {
      title: "巴菲特本季動作",
      dataset: "us.13f_changes",
      params: { investor: "berkshire-hathaway", actions: ["new", "add", "trim", "exit"] },
      viz: { type: "table", columns: ["ticker", "action", "shares_change_pct", "weight_pct"] },
    },
  },
  stat: {
    description: "One number from the first or last row, with an optional comparison column.",
    example: {
      title: "2330 收盤",
      dataset: "tw.technicals",
      params: { symbol: "2330", days: 1 },
      viz: { type: "stat", value: "close", compare: "change_pct" },
    },
  },
  text: {
    description: "Plain-text note (no dataset). Use it to explain what the dashboard tracks.",
    example: { title: "說明", viz: { type: "text", text: "追蹤投信連買且站上月線的標的。" } },
  },
};

/** Default size on the 12-column grid per viz type. */
export const DEFAULT_SIZE: Record<VizType, { w: number; h: number }> = {
  candlestick: { w: 8, h: 8 },
  line: { w: 6, h: 6 },
  area: { w: 6, h: 6 },
  bar: { w: 6, h: 6 },
  table: { w: 6, h: 8 },
  stat: { w: 3, h: 3 },
  text: { w: 4, h: 3 },
};
