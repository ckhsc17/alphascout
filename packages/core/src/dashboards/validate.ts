import { type ColumnSpec, explainIssues } from "../datasets/define.ts";
import { DATASETS } from "../datasets/index.ts";
import { type WidgetSpec, widgetSpecSchema } from "./spec.ts";

export type ValidationResult = { ok: true; spec: WidgetSpec } | { ok: false; errors: string[] };

/**
 * Validates a widget spec end to end: shape, dataset id, dataset params, and that every column
 * the viz references exists (with the right type). Errors are phrased so an AI client can fix
 * the spec and retry.
 */
export function validateWidgetSpec(input: unknown): ValidationResult {
  const parsed = widgetSpecSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: explainIssues(parsed.error.issues) };
  const spec = parsed.data;
  if (spec.viz.type === "text")
    return { ok: true, spec: { ...spec, dataset: undefined, params: {} } };

  const dataset = DATASETS.find((d) => d.id === spec.dataset);
  if (!dataset) {
    return {
      ok: false,
      errors: [
        `Unknown dataset "${spec.dataset}". Available: ${DATASETS.map((d) => d.id).join(", ")}`,
      ],
    };
  }

  const params = dataset.params.safeParse(spec.params);
  if (!params.success) {
    return {
      ok: false,
      errors: explainIssues(params.error.issues).map((m) => `params.${m}`),
    };
  }

  const errors: string[] = [];
  const cols = dataset.columns;
  const available = Object.keys(cols).join(", ");
  const check = (name: string, where: string, need?: "number") => {
    const col: ColumnSpec | undefined = cols[name];
    if (!col) {
      if (!dataset.openColumns) {
        errors.push(`${where}: column "${name}" is not in ${dataset.id}. Available: ${available}`);
      }
      return;
    }
    if (need === "number" && col.type !== "number") {
      errors.push(`${where}: column "${name}" is ${col.type}, expected a number`);
    }
  };

  const viz = spec.viz;
  switch (viz.type) {
    case "candlestick":
      if (dataset.id !== "tw.prices")
        errors.push('viz.type "candlestick" requires dataset "tw.prices"');
      break;
    case "line":
    case "area":
    case "bar":
      check(viz.x, "viz.x");
      viz.y.forEach((y, i) => check(y, `viz.y[${i}]`, "number"));
      break;
    case "table":
      viz.columns?.forEach((c, i) => check(c, `viz.columns[${i}]`));
      if (viz.sort) check(viz.sort.field, "viz.sort.field");
      break;
    case "stat":
      check(viz.value, "viz.value");
      if (viz.compare) check(viz.compare, "viz.compare");
      break;
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, spec: { ...spec, params: params.data as Record<string, unknown> } };
}
