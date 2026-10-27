import { type SQL, sql } from "drizzle-orm";
import {
  type Condition,
  type ConditionNode,
  NUMERIC_FIELDS,
  type NumericField,
  type Screen,
  TEXT_FIELDS,
} from "./schema.ts";

/**
 * Compiles a validated screen into a WHERE clause over `tw_indicator_snapshots s` (target date),
 * `tw_indicator_snapshots p` (previous session, for crosses) and `securities sec`.
 * Field names only reach SQL through the whitelists; values are always bound parameters.
 */
export function compileWhere(node: ConditionNode): SQL {
  if ("all" in node) return sql`(${sql.join(node.all.map(compileWhere), sql` and `)})`;
  if ("any" in node) return sql`(${sql.join(node.any.map(compileWhere), sql` or `)})`;
  return compileCondition(node);
}

function col(alias: "s" | "p", field: NumericField): SQL {
  return sql.raw(`${alias}.${NUMERIC_FIELDS[field].column}`);
}

type TextCondition = Extract<Condition, { field: keyof typeof TEXT_FIELDS }>;

function isTextCondition(c: Condition): c is TextCondition {
  return c.field in TEXT_FIELDS;
}

function compileCondition(c: Condition): SQL {
  if (isTextCondition(c)) {
    const column = sql.raw(`sec.${TEXT_FIELDS[c.field].column}`);
    const values = Array.isArray(c.value) ? c.value : [c.value];
    if (c.op === "=" && !Array.isArray(c.value)) return sql`${column} = ${c.value}`;
    return sql`${column} in (${sql.join(
      values.map((v) => sql`${v}`),
      sql`, `,
    )})`;
  }

  const field = c.field as NumericField;
  const s = col("s", field);

  switch (c.op) {
    case "between":
      return sql`${s} between ${c.min} and ${c.max}`;
    case "crosses_above":
    case "crosses_below": {
      const p = col("p", field);
      const sRef = "ref" in c && c.ref ? col("s", c.ref) : sql`${c.value}`;
      const pRef = "ref" in c && c.ref ? col("p", c.ref) : sql`${c.value}`;
      return c.op === "crosses_above"
        ? sql`(${s} > ${sRef} and ${p} <= ${pRef})`
        : sql`(${s} < ${sRef} and ${p} >= ${pRef})`;
    }
    default: {
      const op = sql.raw(c.op);
      if ("ref" in c && c.ref) {
        const ref = col("s", c.ref);
        const rhs = c.multiplier ? sql`${ref} * ${c.multiplier}` : ref;
        return sql`${s} ${op} ${rhs}`;
      }
      return sql`${s} ${op} ${(c as { value: number }).value}`;
    }
  }
}

/** Numeric fields referenced anywhere in the screen, in first-seen order. */
export function referencedFields(screen: Screen): NumericField[] {
  const seen = new Set<NumericField>();
  const visit = (node: ConditionNode) => {
    if ("all" in node) return node.all.forEach(visit);
    if ("any" in node) return node.any.forEach(visit);
    if (node.field in NUMERIC_FIELDS) seen.add(node.field as NumericField);
    if ("ref" in node && node.ref) seen.add(node.ref);
  };
  visit(screen.where);
  if (screen.sort) seen.add(screen.sort.field);
  return [...seen];
}

export function usesCrosses(node: ConditionNode): boolean {
  if ("all" in node) return node.all.some(usesCrosses);
  if ("any" in node) return node.any.some(usesCrosses);
  return node.op === "crosses_above" || node.op === "crosses_below";
}
