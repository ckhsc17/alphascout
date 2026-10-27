"use server";

import { redirect } from "next/navigation";
import { createDashboard } from "@/lib/dashboards";
import { getSessionUser } from "@/lib/session";

export async function createDashboardAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const id = await createDashboard(user.id, {
    title: String(formData.get("title") ?? "").trim() || "未命名 dashboard",
  });
  redirect(`/d/${id}`);
}
