import type { Db } from "@alphascout/db";
import type { z } from "zod";

type Issue = z.core.$ZodIssue;

/**
 * Flattens zod issues into readable lines. Union failures are expanded into their branches and
 * the most specific messages (our own "Unknown field …" / "Provide …") are preferred, so AI
 * clients get an error they can act on instead of "Invalid input".
 */
export function explainIssues(issues: readonly Issue[], prefix: PropertyKey[] = []): string[] {
  const out: string[] = [];
  for (const issue of issues) {
    const path = [...prefix, ...issue.path];
    if (issue.code === "invalid_union" && issue.errors.length > 0) {
      const branches = issue.errors.map((branch) => explainIssues(branch, path));
      const specific = branches.flat().filter((m) => /Unknown|Provide|expected one of/i.test(m));
      out.push(
        ...(specific.length > 0
          ? specific
          : // Otherwise report the branch that got furthest (fewest complaints).
            (branches.sort((a, b) => a.length - b.length)[0] ?? [])),
      );
      continue;
    }
    out.push(`${path.map(String).join(".") || "(root)"}: ${issue.message}`);
  }
  return [...new Set(out)];
}

export type ColumnType = "date" | "number" | "string" | "boolean";

export interface ColumnSpec {
  type: ColumnType;
  description: string;
  /** e.g. "TWD", "USD", "lots (1,000 shares)", "%". */
  unit?: string;
}

export type Row = Record<string, string | number | boolean | null>;

export interface DatasetResult {
  dataset: string;
  /** The market date / period the data reflects. */
  asOf: string | null;
  source: string;
  columns: Record<string, ColumnSpec>;
  rows: Row[];
  /** Caveats the reader should know about (lags, coverage limits, …). */
  notes?: string[];
}

export interface Dataset<P extends z.ZodType = z.ZodType> {
  id: string;
  title: string;
  description: string;
  params: P;
  columns: Record<string, ColumnSpec>;
  source: string;
  notes?: string[];
  /** Rows may carry extra columns beyond `columns` (e.g. screen fields). */
  openColumns?: boolean;
  /** Example params, shown to AI clients in `describe_dataset`. */
  example: z.input<P>;
  run: (db: Db, params: z.output<P>) => Promise<{ asOf: string | null; rows: Row[] }>;
}

export function defineDataset<P extends z.ZodType>(dataset: Dataset<P>): Dataset<P> {
  return dataset;
}

export class DatasetError extends Error {}

/** Validates params and runs a dataset, returning a self-describing result. */
export async function runDataset<P extends z.ZodType>(
  db: Db,
  dataset: Dataset<P>,
  rawParams: unknown,
): Promise<DatasetResult> {
  const parsed = dataset.params.safeParse(rawParams ?? {});
  if (!parsed.success) {
    throw new DatasetError(
      `Invalid params for ${dataset.id}: ${explainIssues(parsed.error.issues).join("; ")}`,
    );
  }
  const { asOf, rows } = await dataset.run(db, parsed.data);
  return {
    dataset: dataset.id,
    asOf,
    source: dataset.source,
    columns: dataset.columns,
    rows,
    ...(dataset.notes ? { notes: dataset.notes } : {}),
  };
}

/** Rounds floats so responses stay compact for AI clients. */
export function round(value: unknown, digits = 2): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Postgres dates come back as Date objects; expose them as "YYYY-MM-DD". */
export function isoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
