export interface Env {
  DB: D1Database;
  /** Statische Dateien aus dist/. Siehe [assets] in wrangler.toml. */
  ASSETS: Fetcher;
  SITE_PASSWORD: string;
  SESSION_SECRET: string;
}

/**
 * Ein Endpunkt. Bewusst schlicht: Anfrage rein, Antwort raus. Alles, was
 * mehrere Endpunkte betrifft, erledigt der Router in worker/index.ts.
 */
export type Handler = (request: Request, env: Env) => Response | Promise<Response>;

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  });
}

export function error(status: number, message: string): Response {
  return json({ error: message }, { status });
}
