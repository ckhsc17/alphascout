"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DashboardError,
  deleteDashboard,
  forkDashboard,
  removeWidget,
  saveLayout,
  updateDashboard,
  type Visibility,
} from "@/lib/dashboards";
import { getSessionUser } from "@/lib/session";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new DashboardError("請先登入");
  return user;
}

export async function saveLayoutAction(
  dashboardId: string,
  layout: { id: string; x: number; y: number; w: number; h: number }[],
) {
  const user = await requireUser();
  await saveLayout(dashboardId, user.id, layout);
}

export async function removeWidgetAction(dashboardId: string, widgetId: string) {
  const user = await requireUser();
  await removeWidget(dashboardId, user.id, widgetId);
  revalidatePath(`/d/${dashboardId}`);
}

export async function updateDashboardAction(dashboardId: string, formData: FormData) {
  const user = await requireUser();
  const visibility = String(formData.get("visibility") ?? "");
  await updateDashboard(dashboardId, user.id, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    ...(["private", "unlisted", "public"].includes(visibility)
      ? { visibility: visibility as Visibility }
      : {}),
  });
  revalidatePath(`/d/${dashboardId}`);
}

export async function deleteDashboardAction(dashboardId: string) {
  const user = await requireUser();
  await deleteDashboard(dashboardId, user.id);
  redirect("/dashboards");
}

export async function forkDashboardAction(dashboardId: string) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const id = await forkDashboard(dashboardId, user.id);
  redirect(`/d/${id}`);
}
