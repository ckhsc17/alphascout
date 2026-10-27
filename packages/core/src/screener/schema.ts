import { z } from "zod";

/**
 * Screenable numeric fields → SQL column on `tw_indicator_snapshots`. This whitelist is the only
 * way field names reach SQL.
 */
export const NUMERIC_FIELDS = {
  close: { column: "close", description: "Close price (TWD)" },
  change_pct: { column: "change_pct", description: "Daily change (%)" },
  sma5: { column: "sma5", description: "5-day SMA" },
  sma20: { column: "sma20", description: "20-day SMA (月線)" },
  sma60: { column: "sma60", description: "60-day SMA (季線)" },
  sma120: { column: "sma120", description: "120-day SMA (半年線)" },
  rsi14: { column: "rsi14", description: "14-day RSI" },
  macd: { column: "macd", description: "MACD line" },
  macd_signal: { column: "macd_signal", description: "MACD signal line" },
  macd_hist: { column: "macd_hist", description: "MACD histogram" },
  bb_upper: { column: "bb_upper", description: "Bollinger upper band" },
  bb_lower: { column: "bb_lower", description: "Bollinger lower band" },
  atr14: { column: "atr14", description: "14-day ATR" },
  avg_volume_20d_lots: {
    column: "avg_volume20d / 1000",
    description: "Average daily volume over the previous 20 sessions (lots)",
  },
  volume_ratio: { column: "volume_ratio", description: "Today's volume ÷ 20-day average" },
  high_52w: { column: "high52w", description: "52-week high" },
  low_52w: { column: "low52w", description: "52-week low" },
  foreign_streak: {
    column: "foreign_net_buy_streak",
    description: "Foreign net-buy streak in days (negative = selling streak)",
  },
  trust_streak: {
    column: "trust_net_buy_streak",
    description: "Investment-trust (投信) net-buy streak in days (negative = selling)",
  },
  dealer_streak: {
    column: "dealer_net_buy_streak",
    description: "Dealer net-buy streak in days (negative = selling)",
  },
  major_holder_pct: {
    column: "major_holder_pct",
    description: "Share held by 1,000+ lot holders (%)",
  },
  major_holder_change_4w: {
    column: "major_holder_pct_change4w",
    description: "4-week change in major-holder share (percentage points)",
  },
  revenue_yoy: { column: "revenue_yoy", description: "Latest published monthly revenue YoY (%)" },
} as const;

export const TEXT_FIELDS = {
  board: { column: "board", description: "TWSE (上市) or TPEx (上櫃)" },
  industry: { column: "industry", description: "Industry name, e.g. 半導體業" },
} as const;

export type NumericField = keyof typeof NUMERIC_FIELDS;
export type TextField = keyof typeof TEXT_FIELDS;

const numericFieldNames = Object.keys(NUMERIC_FIELDS) as [NumericField, ...NumericField[]];
const textFieldNames = Object.keys(TEXT_FIELDS) as [TextField, ...TextField[]];

const numericField = z.enum(numericFieldNames, {
  error: (issue) =>
    `Unknown numeric field "${String(issue.input)}". Available: ${numericFieldNames.join(", ")}`,
});
const textField = z.enum(textFieldNames, {
  error: (issue) =>
    `Unknown text field "${String(issue.input)}". Available: ${textFieldNames.join(", ")}`,
});

/** Compare a field with a constant or with another field (optionally scaled). */
const compareCondition = z
  .object({
    field: numericField,
    op: z.enum([">", ">=", "<", "<=", "="]),
    value: z.number().optional(),
    ref: numericField.optional().describe("Compare against another field instead of a value"),
    multiplier: z.number().positive().optional().describe("Scale `ref`, e.g. close > sma20 × 1.05"),
  })
  .refine((c) => (c.value == null) !== (c.ref == null), {
    message: "Provide exactly one of `value` or `ref`",
  });

const betweenCondition = z.object({
  field: numericField,
  op: z.literal("between"),
  min: z.number(),
  max: z.number(),
});

/** True on the day `field` moves from ≤ ref to > ref (or the reverse for crosses_below). */
const crossCondition = z
  .object({
    field: numericField,
    op: z.enum(["crosses_above", "crosses_below"]),
    ref: numericField.optional(),
    value: z.number().optional(),
  })
  .refine((c) => (c.value == null) !== (c.ref == null), {
    message: "Provide exactly one of `value` or `ref`",
  });

const textCondition = z.object({
  field: textField,
  op: z.enum(["=", "in"]),
  value: z.union([z.string(), z.array(z.string()).min(1).max(50)]),
});

export const conditionSchema = z.union([
  betweenCondition,
  crossCondition,
  textCondition,
  compareCondition,
]);

export type Condition = z.infer<typeof conditionSchema>;

export type ConditionGroup = { all: ConditionNode[] } | { any: ConditionNode[] };
export type ConditionNode = Condition | ConditionGroup;

export const conditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(conditionNodeSchema).min(1).max(20) }),
    z.object({ any: z.array(conditionNodeSchema).min(1).max(20) }),
    conditionSchema,
  ]),
);

export const screenSchema = z.object({
  market: z.literal("TW").default("TW"),
  /** Snapshot date; defaults to the latest available. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  where: conditionNodeSchema,
  sort: z.object({ field: numericField, dir: z.enum(["asc", "desc"]).default("desc") }).optional(),
  limit: z.number().int().min(1).max(100).default(30),
});

export type Screen = z.infer<typeof screenSchema>;
export type ScreenInput = z.input<typeof screenSchema>;
