import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

export const dashboardVisibility = pgEnum("dashboard_visibility", [
  "private",
  "unlisted",
  "public",
]);

export const dashboards = pgTable(
  "dashboards",
  {
    /** Short random id used in URLs (/d/<id>). */
    id: text().primaryKey(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    visibility: dashboardVisibility().notNull().default("unlisted"),
    forkedFrom: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.ownerId), index().on(t.visibility, t.updatedAt)],
);

/** Position on a 12-column grid; h is in grid rows. */
export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const widgets = pgTable(
  "widgets",
  {
    id: text().primaryKey(),
    dashboardId: text()
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    /** Validated widget spec (see @alphascout/core/dashboards). Never executable code. */
    spec: jsonb().notNull(),
    position: jsonb().$type<WidgetPosition>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.dashboardId)],
);
