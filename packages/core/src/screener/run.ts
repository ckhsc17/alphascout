import type { Db } from "@alphascout/db";
import { sql } from "drizzle-orm";
import { isoDate, type Row, round } from "../datasets/define.ts";
import { compileWhere, referencedFields, usesCrosses } from "./compile.ts";
import { NUMERIC_FIELDS, type Screen } from "./schema.ts";

export interface ScreenResult {
  date: string | null;
  rows: Row[];
}

export async function runScreen(db: Db, screen: Screen): Promise<ScreenResult> {
  const dates = await db.execute<{ date: unknown; prev: unknown }>(sql`
    with target as (
      select max(date) as date from tw_indicator_snapshots
      ${screen.date ? sql`where date <= ${screen.date}` : sql``}
    )
    select target.date,
      (select max(date) from tw_indicator_snapshots where date < target.date) as prev
    from target`);
  const date = isoDate(dates[0]?.date);
  const prev = isoDate(dates[0]?.prev);
  if (!date) return { date: null, rows: [] };

  const fields = referencedFields(screen).filter((f) => f !== "close");
  const select = sql.join(
    fields.map((f) => sql.raw(`s.${NUMERIC_FIELDS[f].column} as "${f}"`)),
    sql`, `,
  );
  const joinPrev =
    usesCrosses(screen.where) && prev
      ? sql`join tw_indicator_snapshots p on p.security_id = s.security_id and p.date = ${prev}`
      : usesCrosses(screen.where)
        ? sql`join tw_indicator_snapshots p on false`
        : sql``;
  const order = screen.sort
    ? sql.raw(
        `s.${NUMERIC_FIELDS[screen.sort.field].column} ${screen.sort.dir} nulls last, sec.symbol`,
      )
    : sql.raw("sec.symbol");

  const rows = await db.execute<Record<string, unknown>>(sql`
    select sec.symbol, sec.name, sec.board, sec.industry, s.close, s.change_pct
      ${fields.length ? sql`, ${select}` : sql``}
    from tw_indicator_snapshots s
    join securities sec on sec.id = s.security_id and sec.is_active
    ${joinPrev}
    where s.date = ${date} and ${compileWhere(screen.where)}
    order by ${order}
    limit ${screen.limit}`);

  return {
    date,
    rows: rows.map((r) => {
      const out: Row = {
        symbol: r.symbol as string,
        name: r.name as string,
        board: r.board as string,
        industry: (r.industry as string | null) ?? null,
        close: round(r.close),
        change_pct: round(r.change_pct),
      };
      for (const f of fields) {
        out[f] = f.endsWith("streak") ? (r[f] as number | null) : round(r[f]);
      }
      return out;
    }),
  };
}
