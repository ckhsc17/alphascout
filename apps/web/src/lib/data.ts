import {
  DatasetError,
  type DatasetResult,
  getDataset,
  runDataset,
} from "@alphascout/core/datasets";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

/**
 * Runs a dataset for a page. Data changes once a day after the ingestion jobs, so results are
 * cached for hours. Only call from components rendered at request time (behind <Suspense>),
 * so builds never need database access.
 */
export async function loadDataset(id: string, params: Record<string, unknown> = {}) {
  "use cache";
  cacheLife("hours");
  try {
    return { ok: true as const, result: await runDataset(getDb(), getDataset(id), params) };
  } catch (err) {
    if (err instanceof DatasetError) return { ok: false as const, message: err.message };
    throw err;
  }
}

/** Like loadDataset, but renders the 404 page for unknown symbols / investors. */
export async function requireDataset(
  id: string,
  params: Record<string, unknown> = {},
): Promise<DatasetResult> {
  const loaded = await loadDataset(id, params);
  if (!loaded.ok) notFound();
  return loaded.result;
}
