"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Categorical palette tuned to read in both light and dark themes. */
const COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444"];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function SeriesChart({
  type,
  rows,
  x,
  y,
  labels,
  stacked = false,
}: {
  type: "line" | "area" | "bar";
  rows: Record<string, unknown>[];
  x: string;
  y: string[];
  labels: Record<string, string>;
  stacked?: boolean;
}) {
  const common = {
    data: rows,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  const axes = [
    <CartesianGrid key="grid" stroke="var(--border)" vertical={false} />,
    <XAxis
      key="x"
      dataKey={x}
      tick={{ fontSize: 11, fill: "var(--muted)" }}
      tickLine={false}
      axisLine={{ stroke: "var(--border)" }}
      minTickGap={24}
    />,
    <YAxis
      key="y"
      width={48}
      tick={{ fontSize: 11, fill: "var(--muted)" }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v: number) => compact.format(v)}
    />,
    <Tooltip
      key="tooltip"
      contentStyle={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 12,
      }}
      formatter={(v) => (typeof v === "number" ? v.toLocaleString("en-US") : String(v))}
    />,
    ...(y.length > 1
      ? [<Legend key="legend" wrapperStyle={{ fontSize: 11 }} iconType="plainline" />]
      : []),
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === "bar" ? (
        <BarChart {...common}>
          {axes}
          {y.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={labels[key] ?? key}
              fill={COLORS[i % COLORS.length]}
              stackId={stacked ? "s" : undefined}
              radius={stacked ? 0 : [3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      ) : type === "area" ? (
        <AreaChart {...common}>
          {axes}
          {y.map((key, i) => (
            <Area
              key={key}
              dataKey={key}
              name={labels[key] ?? key}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart {...common}>
          {axes}
          {y.map((key, i) => (
            <Line
              key={key}
              dataKey={key}
              name={labels[key] ?? key}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              type="monotone"
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
