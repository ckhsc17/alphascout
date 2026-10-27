import {
  DEFAULT_SIZE,
  type GridPosition,
  normalizePosition,
  placeWidget,
  shortId,
  validateWidgetSpec,
  type WidgetSpec,
} from "@alphascout/core/dashboards";
import { and, asc, desc, eq, schema, sql } from "@alphascout/db";
import { getWriteDb } from "@/lib/db";

export const MAX_DASHBOARDS_PER_USER = 30;
export const MAX_WIDGETS_PER_DASHBOARD = 40;

export type Visibility = "private" | "unlisted" | "public";

export interface WidgetRecord {
  id: string;
  spec: WidgetSpec;
  position: GridPosition;
}

export interface DashboardRecord {
  id: string;
  ownerId: string;
  ownerName: string | null;
  title: string;
  description: string | null;
  visibility: Visibility;
  forkedFrom: string | null;
  updatedAt: Date;
  widgets: WidgetRecord[];
}

/** Expected failures (bad input, missing permission); messages are safe to show to users / AI. */
export class DashboardError extends Error {}

const d = schema.dashboards;
const w = schema.widgets;

export function dashboardUrl(baseUrl: string, id: string) {
  return `${baseUrl}/d/${id}`;
}

export async function listOwnDashboards(ownerId: string) {
  return getWriteDb()
    .select({
      id: d.id,
      title: d.title,
      description: d.description,
      visibility: d.visibility,
      updatedAt: d.updatedAt,
      widgets: sql<number>`(select count(*)::int from widgets where widgets.dashboard_id = ${d.id})`,
    })
    .from(d)
    .where(eq(d.ownerId, ownerId))
    .orderBy(desc(d.updatedAt));
}

export async function listPublicDashboards(limit = 30) {
  return getWriteDb()
    .select({
      id: d.id,
      title: d.title,
      description: d.description,
      updatedAt: d.updatedAt,
      ownerName: schema.user.name,
    })
    .from(d)
    .innerJoin(schema.user, eq(schema.user.id, d.ownerId))
    .where(eq(d.visibility, "public"))
    .orderBy(desc(d.updatedAt))
    .limit(limit);
}

/** Loads a dashboard if `viewerId` may see it (owner, or unlisted / public). */
export async function getDashboard(
  id: string,
  viewerId?: string | null,
): Promise<DashboardRecord | null> {
  const db = getWriteDb();
  const [row] = await db
    .select({
      id: d.id,
      ownerId: d.ownerId,
      ownerName: schema.user.name,
      title: d.title,
      description: d.description,
      visibility: d.visibility,
      forkedFrom: d.forkedFrom,
      updatedAt: d.updatedAt,
    })
    .from(d)
    .leftJoin(schema.user, eq(schema.user.id, d.ownerId))
    .where(eq(d.id, id));
  if (!row) return null;
  if (row.visibility === "private" && row.ownerId !== viewerId) return null;

  const widgetRows = await db
    .select({ id: w.id, spec: w.spec, position: w.position })
    .from(w)
    .where(eq(w.dashboardId, id))
    .orderBy(asc(w.createdAt));
  return {
    ...row,
    widgets: widgetRows.map((r) => ({
      id: r.id,
      spec: r.spec as WidgetSpec,
      position: r.position as GridPosition,
    })),
  };
}

async function requireOwned(id: string, ownerId: string) {
  const [row] = await getWriteDb()
    .select({ id: d.id })
    .from(d)
    .where(and(eq(d.id, id), eq(d.ownerId, ownerId)));
  if (!row) throw new DashboardError(`Dashboard "${id}" not found or not yours.`);
}

async function touch(id: string) {
  await getWriteDb().update(d).set({ updatedAt: new Date() }).where(eq(d.id, id));
}

export async function createDashboard(
  ownerId: string,
  input: { title: string; description?: string; visibility?: Visibility; forkedFrom?: string },
) {
  const db = getWriteDb();
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(d)
    .where(eq(d.ownerId, ownerId));
  if (count >= MAX_DASHBOARDS_PER_USER) {
    throw new DashboardError(
      `Limit reached: at most ${MAX_DASHBOARDS_PER_USER} dashboards per user.`,
    );
  }
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new DashboardError("Title is required.");
  const id = shortId();
  await db.insert(d).values({
    id,
    ownerId,
    title,
    description: input.description?.trim().slice(0, 1000) || null,
    visibility: input.visibility ?? "unlisted",
    forkedFrom: input.forkedFrom ?? null,
  });
  return id;
}

export async function updateDashboard(
  id: string,
  ownerId: string,
  patch: { title?: string; description?: string | null; visibility?: Visibility },
) {
  await requireOwned(id, ownerId);
  const set: Partial<typeof d.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) {
    const title = patch.title.trim().slice(0, 120);
    if (!title) throw new DashboardError("Title cannot be empty.");
    set.title = title;
  }
  if (patch.description !== undefined)
    set.description = patch.description?.trim().slice(0, 1000) || null;
  if (patch.visibility !== undefined) set.visibility = patch.visibility;
  await getWriteDb().update(d).set(set).where(eq(d.id, id));
}

export async function deleteDashboard(id: string, ownerId: string) {
  await requireOwned(id, ownerId);
  await getWriteDb().delete(d).where(eq(d.id, id));
}

export async function addWidget(
  dashboardId: string,
  ownerId: string,
  rawSpec: unknown,
  position?: Partial<GridPosition>,
) {
  await requireOwned(dashboardId, ownerId);
  const result = validateWidgetSpec(rawSpec);
  if (!result.ok) throw new DashboardError(`Invalid widget spec: ${result.errors.join("; ")}`);

  const db = getWriteDb();
  const existing = await db
    .select({ position: w.position })
    .from(w)
    .where(eq(w.dashboardId, dashboardId));
  if (existing.length >= MAX_WIDGETS_PER_DASHBOARD) {
    throw new DashboardError(
      `Limit reached: at most ${MAX_WIDGETS_PER_DASHBOARD} widgets per dashboard.`,
    );
  }
  const size = { ...DEFAULT_SIZE[result.spec.viz.type], ...pickSize(position) };
  const placed =
    position?.x !== undefined && position?.y !== undefined
      ? normalizePosition({ x: position.x, y: position.y, ...size })
      : placeWidget(
          existing.map((e) => e.position as GridPosition),
          size,
        );
  const id = shortId(12);
  await db.insert(w).values({ id, dashboardId, spec: result.spec, position: placed });
  await touch(dashboardId);
  return { id, position: placed };
}

function pickSize(p?: Partial<GridPosition>) {
  const out: { w?: number; h?: number } = {};
  if (p?.w !== undefined) out.w = p.w;
  if (p?.h !== undefined) out.h = p.h;
  return out;
}

async function requireWidget(dashboardId: string, widgetId: string) {
  const [row] = await getWriteDb()
    .select({ id: w.id, position: w.position })
    .from(w)
    .where(and(eq(w.id, widgetId), eq(w.dashboardId, dashboardId)));
  if (!row)
    throw new DashboardError(`Widget "${widgetId}" not found on dashboard "${dashboardId}".`);
  return row;
}

export async function updateWidget(
  dashboardId: string,
  ownerId: string,
  widgetId: string,
  patch: { spec?: unknown; position?: Partial<GridPosition> },
) {
  await requireOwned(dashboardId, ownerId);
  const current = await requireWidget(dashboardId, widgetId);
  const set: Partial<typeof w.$inferInsert> = { updatedAt: new Date() };
  if (patch.spec !== undefined) {
    const result = validateWidgetSpec(patch.spec);
    if (!result.ok) throw new DashboardError(`Invalid widget spec: ${result.errors.join("; ")}`);
    set.spec = result.spec;
  }
  if (patch.position) {
    set.position = normalizePosition({ ...(current.position as GridPosition), ...patch.position });
  }
  await getWriteDb().update(w).set(set).where(eq(w.id, widgetId));
  await touch(dashboardId);
}

export async function removeWidget(dashboardId: string, ownerId: string, widgetId: string) {
  await requireOwned(dashboardId, ownerId);
  await requireWidget(dashboardId, widgetId);
  await getWriteDb().delete(w).where(eq(w.id, widgetId));
  await touch(dashboardId);
}

/** Saves positions after a drag / resize on the web. Unknown widget ids are ignored. */
export async function saveLayout(
  dashboardId: string,
  ownerId: string,
  layout: ({ id: string } & GridPosition)[],
) {
  await requireOwned(dashboardId, ownerId);
  const db = getWriteDb();
  await db.transaction(async (tx) => {
    for (const item of layout.slice(0, MAX_WIDGETS_PER_DASHBOARD)) {
      await tx
        .update(w)
        .set({ position: normalizePosition(item), updatedAt: new Date() })
        .where(and(eq(w.id, item.id), eq(w.dashboardId, dashboardId)));
    }
  });
  await touch(dashboardId);
}

/** Copies a visible dashboard into `ownerId`'s account (private by default). */
export async function forkDashboard(sourceId: string, ownerId: string) {
  const source = await getDashboard(sourceId, ownerId);
  if (!source || source.visibility === "private") {
    throw new DashboardError("Dashboard not found or not shareable.");
  }
  const id = await createDashboard(ownerId, {
    title: `${source.title}（副本）`,
    description: source.description ?? undefined,
    visibility: "private",
    forkedFrom: source.id,
  });
  if (source.widgets.length) {
    await getWriteDb()
      .insert(w)
      .values(
        source.widgets.map((widget) => ({
          id: shortId(12),
          dashboardId: id,
          spec: widget.spec,
          position: widget.position,
        })),
      );
  }
  return id;
}
