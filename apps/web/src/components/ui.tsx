import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border px-3 py-2 ${className}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-0.5 text-base font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  rows,
  empty = "沒有符合的資料",
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="tabular w-full min-w-max text-sm">
        <thead>
          <tr className="text-xs text-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-4 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`whitespace-nowrap px-4 py-2 ${c.align === "right" ? "text-right" : ""}`}
                >
                  {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StockLink({ symbol, name }: { symbol: unknown; name?: unknown }) {
  return (
    <Link href={`/s/${symbol}`} className="hover:text-accent">
      <span className="font-medium">{String(symbol)}</span>
      {name != null && <span className="ml-1.5 text-muted">{String(name)}</span>}
    </Link>
  );
}

export function AsOf({ value, source }: { value: unknown; source?: string }) {
  return (
    <span>
      {value ? `資料日期 ${String(value)}` : "資料日期 —"}
      {source ? ` · ${source}` : ""}
    </span>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-border bg-surface ${className}`} />
  );
}

export function Notes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs text-muted">
      {notes.map((n) => (
        <li key={n}>※ {n}</li>
      ))}
    </ul>
  );
}
