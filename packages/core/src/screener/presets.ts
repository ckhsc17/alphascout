import type { ScreenInput } from "./schema.ts";

export interface ScreenPreset {
  slug: string;
  name: string;
  description: string;
  screen: ScreenInput;
}

/** Liquidity floor applied by every preset so results are tradable. */
const LIQUID = { field: "avg_volume_20d_lots", op: ">=", value: 500 } as const;

export const SCREEN_PRESETS: ScreenPreset[] = [
  {
    slug: "trust-buying-breakout",
    name: "投信連買＋站上月線",
    description: "投信連續買超 3 天以上，且收盤剛突破 20 日均線。",
    screen: {
      where: {
        all: [
          { field: "trust_streak", op: ">=", value: 3 },
          { field: "close", op: "crosses_above", ref: "sma20" },
          LIQUID,
        ],
      },
      sort: { field: "trust_streak", dir: "desc" },
    },
  },
  {
    slug: "volume-breakout-52w",
    name: "爆量創 52 週新高",
    description: "收盤創 52 週新高，成交量達 20 日均量 2 倍以上。",
    screen: {
      where: {
        all: [
          { field: "close", op: ">=", ref: "high_52w" },
          { field: "volume_ratio", op: ">=", value: 2 },
          LIQUID,
        ],
      },
      sort: { field: "volume_ratio", dir: "desc" },
    },
  },
  {
    slug: "revenue-momentum-uptrend",
    name: "營收高成長＋多頭排列",
    description: "最新月營收 YoY 超過 30%，且股價在月線與季線之上、月線高於季線。",
    screen: {
      where: {
        all: [
          { field: "revenue_yoy", op: ">", value: 30 },
          { field: "close", op: ">", ref: "sma20" },
          { field: "sma20", op: ">", ref: "sma60" },
          LIQUID,
        ],
      },
      sort: { field: "revenue_yoy", dir: "desc" },
    },
  },
  {
    slug: "foreign-and-trust-buying",
    name: "外資投信同步買超",
    description: "外資與投信同時連續買超 2 天以上。",
    screen: {
      where: {
        all: [
          { field: "foreign_streak", op: ">=", value: 2 },
          { field: "trust_streak", op: ">=", value: 2 },
          LIQUID,
        ],
      },
      sort: { field: "trust_streak", dir: "desc" },
    },
  },
  {
    slug: "oversold-bounce",
    name: "超跌反彈",
    description: "RSI 從 30 以下回升，且 MACD 柱狀體轉正。",
    screen: {
      where: {
        all: [
          { field: "rsi14", op: "crosses_above", value: 30 },
          { field: "macd_hist", op: ">", value: 0 },
          LIQUID,
        ],
      },
      sort: { field: "rsi14", dir: "asc" },
    },
  },
];
