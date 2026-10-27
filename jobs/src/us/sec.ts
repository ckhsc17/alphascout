import type { FetchOptions } from "../lib/http.ts";

/** SEC requires automated clients to identify themselves with contact details. */
export function secHeaders(): FetchOptions {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) throw new Error('SEC_USER_AGENT is not set (e.g. "AlphaScout you@example.com")');
  return { headers: { "User-Agent": userAgent } };
}
