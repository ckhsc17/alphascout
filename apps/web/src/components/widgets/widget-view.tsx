import type { WidgetSpec } from "@alphascout/core/dashboards";
import type { ColumnSpec, DatasetResult } from "@alphascout/core/datasets";
import { connection } from "next/server";
import { type Bar, PriceChart } from "@/components/price-chart";
import { type Column, Table } from "@/components/ui";
import { SeriesChart } from "@/components/widgets/series-chart";
import { loadDataset } from "@/lib/data";
import { fmtCompact, fmtNum, fmtPct, trendClass } from "@/lib/format";

/** Formats a value according to its dataset column spec (unit-aware). */
function formatValue(value: unknown, spec?: ColumnSpec): string {
  if (value == null) return "—";
  if (!spec || spec.type !== "number") return String(value);
  const unit = spec.unit ?? "";
  if (unit === "%") return fmtPct(value);
  if (unit === "USD") return fmtCompact(value, "$");
  if (unit.startsWith("lots")) return fmtNum(value, 0);
  if (unit === "thousand TWD") return fmtCompact(Number(value) * 1000);
  return fmtNum(value);
}

function isSigned(spec?: ColumnSpec) {
  return spec?.unit === "%" || /net|change|streak/i.test(spec?.description ?? "");
}

export async function WidgetView({ spec }: { spec: WidgetSpec }) {
  if (spec.viz.type === "text") {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{spec.viz.text}</p>;
  }
  await connection();
  const loaded = await loadDataset(spec.dataset as string, spec.params);
  if (!loaded.ok) {
    return <p className="text-sm text-down-tw">資料載入失敗：{loaded.message}</p>;
  }
  return <Viz spec={spec} result={loaded.result} />;
}

function Viz({ spec, result }: { spec: WidgetSpec; result: DatasetResult }) {
  const viz = spec.viz;
  const rows = result.rows as Record<string, unknown>[];
  const cols = result.columns;
  const label = (key: string) => cols[key]?.description ?? key;

  switch (viz.type) {
    case "candlestick":
      return <PriceChart bars={rows as unknown as Bar[]} />;

    case "line":
    case "area":
    case "bar":
      return (
        <div className="h-full min-h-40">
          <SeriesChart
            type={viz.type}
            rows={rows}
            x={viz.x}
            y={viz.y}
            stacked={viz.type === "bar" && viz.stacked}
            labels={Object.fromEntries(viz.y.map((k) => [k, label(k)]))}
          />
        </div>
      );

    case "stat": {
      const row = viz.row === "first" ? rows[0] : rows.at(-1);
      if (!row) return <p className="text-sm text-muted">沒有資料</p>;
      const compare = viz.compare ? row[viz.compare] : undefined;
      return (
        <div className="tabular">
          <div className="text-3xl font-semibold">
            {formatValue(row[viz.value], cols[viz.value])}
          </div>
          {viz.compare && (
            <div className={`mt-1 text-sm ${trendClass(compare)}`}>
              {formatValue(compare, cols[viz.compare])}
              <span className="ml-1.5 text-xs text-muted">{label(viz.compare)}</span>
            </div>
          )}
        </div>
      );
    }

    case "table": {
      const keys = viz.columns ?? Object.keys(rows[0] ?? cols);
      let shown = rows;
      if (viz.sort) {
        const { field, dir } = viz.sort;
        shown = [...rows].sort((a, b) => {
          const av = a[field];
          const bv = b[field];
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv));
          return dir === "asc" ? cmp : -cmp;
        });
      }
      const columns: Column<Record<string, unknown>>[] = keys.map((key) => {
        const spec = cols[key];
        const numeric = spec?.type === "number" || typeof rows[0]?.[key] === "number";
        return {
          key,
          label: spec?.description ? shortLabel(spec.description) : key,
          align: numeric ? "right" : "left",
          render: (r) =>
            isSigned(spec) ? (
              <span className={trendClass(r[key])}>{formatValue(r[key], spec)}</span>
            ) : (
              formatValue(
                r[key],
                spec ?? (numeric ? { type: "number", description: key } : undefined),
              )
            ),
        };
      });
      return <Table columns={columns} rows={shown.slice(0, viz.limit)} />;
    }
  }
}

/** Column descriptions can be sentences; keep table headers short. */
function shortLabel(description: string) {
  const first = description.split(/[(（,;]/)[0]?.trim() ?? description;
  return first.length > 28 ? `${first.slice(0, 26)}…` : first;
}
