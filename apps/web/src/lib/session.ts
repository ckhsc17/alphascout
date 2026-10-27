import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** The signed-in user for this request, or null. Reads request headers, so call behind Suspense. */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
