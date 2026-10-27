const USER_AGENT =
  "Mozilla/5.0 (compatible; AlphaScout/0.1; +https://github.com/ckhsc17/alphascout)";

/**
 * Minimum gap between requests to the same host. TWSE in particular blocks clients that send
 * more than a few requests every few seconds.
 */
const MIN_INTERVAL_MS: Record<string, number> = {
  "www.twse.com.tw": 3000,
  "openapi.twse.com.tw": 1000,
  "www.tpex.org.tw": 2000,
  "mopsov.twse.com.tw": 3000,
  // SEC allows 10 requests/second across its hosts; stay well below.
  "data.sec.gov": 150,
  "www.sec.gov": 150,
  // OpenFIGI without an API key: 25 requests/minute.
  "api.openfigi.com": 2500,
};
const DEFAULT_INTERVAL_MS = 500;

const lastRequestAt = new Map<string, number>();

/** Reserves the next free slot for `host`, so concurrent callers stay spaced out too. */
async function throttle(host: string) {
  const gap = MIN_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS;
  const slot = Math.max(Date.now(), (lastRequestAt.get(host) ?? 0) + gap);
  lastRequestAt.set(host, slot);
  const wait = slot - Date.now();
  if (wait > 0) await sleep(wait);
}

export interface FetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  retries?: number;
}

export async function fetchJson<T>(url: string, init: FetchOptions = {}): Promise<T> {
  const res = await request(url, {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });
  return (await res.json()) as T;
}

export async function fetchText(
  url: string,
  init: FetchOptions & { encoding?: string } = {},
): Promise<string> {
  const res = await request(url, init);
  if (!init.encoding) return res.text();
  return new TextDecoder(init.encoding).decode(await res.arrayBuffer());
}

async function request(url: string, init: FetchOptions): Promise<Response> {
  const host = new URL(url).host;
  const retries = init.retries ?? 3;

  for (let attempt = 0; ; attempt++) {
    await throttle(host);
    try {
      const res = await fetch(url, {
        method: init.method ?? "GET",
        headers: { "User-Agent": USER_AGENT, ...init.headers },
        body: init.body,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return res;
    } catch (err) {
      const retryable = !(err instanceof HttpError) || err.status === 429 || err.status >= 500;
      if (!retryable || attempt >= retries) throw err;
      await sleep(2 ** attempt * 5000);
    }
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
