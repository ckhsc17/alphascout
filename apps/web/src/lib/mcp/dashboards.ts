import { VIZ_DOCS } from "@alphascout/core/dashboards";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { BASE_URL } from "@/lib/auth";
import {
  addWidget,
  createDashboard,
  DashboardError,
  dashboardUrl,
  deleteDashboard,
  getDashboard,
  listOwnDashboards,
  removeWidget,
  updateDashboard,
  updateWidget,
} from "@/lib/dashboards";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const json = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return json(await fn());
  } catch (err) {
    if (err instanceof DashboardError) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
    console.error(err);
    return { content: [{ type: "text", text: "Internal error." }], isError: true };
  }
}

const visibility = z
  .enum(["private", "unlisted", "public"])
  .describe("private: only you · unlisted: anyone with the link · public: listed on the site");

const position = z
  .object({
    x: z.number().int().min(0).max(11).optional(),
    y: z.number().int().min(0).optional(),
    w: z.number().int().min(1).max(12).optional().describe("Width in grid columns (of 12)"),
    h: z.number().int().min(1).max(24).optional().describe("Height in grid rows (~40px each)"),
  })
  .optional()
  .describe("Omit x/y to auto-place in the first free slot");

const specDescription = `Widget spec: { title, description?, dataset, params, viz }. viz.type is one of ${Object.keys(VIZ_DOCS).join(", ")} — call list_viz_types for each type's fields and an example. Columns referenced by viz must exist in the dataset (see describe_dataset). Prefer relative params (period "latest", days: 30) so the widget stays current.`;

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

/** Dashboard tools for an authenticated user (`userId` comes from the verified access token). */
export function registerDashboardTools(server: McpServer, userId: string) {
  server.registerTool(
    "list_viz_types",
    {
      title: "List widget types",
      description: "Widget visualization types with their fields and a complete example spec.",
      annotations: READ_ONLY,
    },
    async () => json(VIZ_DOCS),
  );

  server.registerTool(
    "list_dashboards",
    { title: "My dashboards", description: "Your AlphaScout dashboards.", annotations: READ_ONLY },
    async () =>
      run(async () =>
        (await listOwnDashboards(userId)).map((d) => ({ ...d, url: dashboardUrl(BASE_URL, d.id) })),
      ),
  );

  server.registerTool(
    "get_dashboard",
    {
      title: "Get dashboard",
      description: "A dashboard with every widget's id, spec and grid position.",
      inputSchema: z.object({ dashboard_id: z.string() }),
      annotations: READ_ONLY,
    },
    async ({ dashboard_id }) =>
      run(async () => {
        const dash = await getDashboard(dashboard_id, userId);
        if (!dash || dash.ownerId !== userId)
          throw new DashboardError("Dashboard not found or not yours.");
        return { ...dash, url: dashboardUrl(BASE_URL, dash.id) };
      }),
  );

  server.registerTool(
    "create_dashboard",
    {
      title: "Create dashboard",
      description:
        "Create an empty dashboard and get its id and URL. Then add widgets with add_widget. Plan the layout first: a text widget explaining the goal, KPIs (stat) on top, charts and tables below.",
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        description: z.string().max(1000).optional(),
        visibility: visibility.default("unlisted"),
      }),
      annotations: WRITE,
    },
    async (args) =>
      run(async () => {
        const id = await createDashboard(userId, args);
        return { dashboard_id: id, url: dashboardUrl(BASE_URL, id) };
      }),
  );

  server.registerTool(
    "update_dashboard",
    {
      title: "Update dashboard",
      description: "Rename a dashboard or change its description / visibility.",
      inputSchema: z.object({
        dashboard_id: z.string(),
        title: z.string().min(1).max(120).optional(),
        description: z.string().max(1000).nullable().optional(),
        visibility: visibility.optional(),
      }),
      annotations: WRITE,
    },
    async ({ dashboard_id, ...patch }) =>
      run(async () => {
        await updateDashboard(dashboard_id, userId, patch);
        return { ok: true, url: dashboardUrl(BASE_URL, dashboard_id) };
      }),
  );

  server.registerTool(
    "delete_dashboard",
    {
      title: "Delete dashboard",
      description:
        "Permanently delete a dashboard and all its widgets. Confirm with the user first.",
      inputSchema: z.object({ dashboard_id: z.string() }),
      annotations: DESTRUCTIVE,
    },
    async ({ dashboard_id }) =>
      run(async () => {
        await deleteDashboard(dashboard_id, userId);
        return { ok: true };
      }),
  );

  server.registerTool(
    "add_widget",
    {
      title: "Add widget",
      description: `Add a widget to one of your dashboards. ${specDescription} Validation errors explain what to fix.`,
      inputSchema: z.object({
        dashboard_id: z.string(),
        spec: z.record(z.string(), z.unknown()).describe(specDescription),
        position,
      }),
      annotations: WRITE,
    },
    async ({ dashboard_id, spec, position: pos }) =>
      run(async () => {
        const widget = await addWidget(dashboard_id, userId, spec, pos);
        return {
          widget_id: widget.id,
          position: widget.position,
          url: dashboardUrl(BASE_URL, dashboard_id),
        };
      }),
  );

  server.registerTool(
    "update_widget",
    {
      title: "Update widget",
      description: `Replace a widget's spec and/or move / resize it. ${specDescription}`,
      inputSchema: z.object({
        dashboard_id: z.string(),
        widget_id: z.string(),
        spec: z.record(z.string(), z.unknown()).optional(),
        position,
      }),
      annotations: WRITE,
    },
    async ({ dashboard_id, widget_id, spec, position: pos }) =>
      run(async () => {
        await updateWidget(dashboard_id, userId, widget_id, { spec, position: pos });
        return { ok: true };
      }),
  );

  server.registerTool(
    "remove_widget",
    {
      title: "Remove widget",
      description: "Remove a widget from one of your dashboards.",
      inputSchema: z.object({ dashboard_id: z.string(), widget_id: z.string() }),
      annotations: DESTRUCTIVE,
    },
    async ({ dashboard_id, widget_id }) =>
      run(async () => {
        await removeWidget(dashboard_id, userId, widget_id);
        return { ok: true };
      }),
  );
}
