import { type Env, type Handler, error } from './lib/http';
import { hasValidSession } from './lib/auth';
import { login } from './routes/login';
import { readSession, logout } from './routes/session';
import { listUsers, createUser, deleteUser } from './routes/users';
import { readSave, writeSave } from './routes/saves';
import { readScores } from './routes/scores';

/**
 * Einstiegspunkt des Workers.
 *
 * Statische Dateien liefert Cloudflare direkt aus dist/ aus, ohne diesen
 * Code überhaupt zu starten – siehe `run_worker_first` in wrangler.toml.
 * Hier kommt also praktisch nur /api/* an.
 */

const ROUTES: Record<string, Record<string, Handler>> = {
  '/api/login': { POST: login },
  '/api/session': { GET: readSession, DELETE: logout },
  '/api/users': { GET: listUsers, POST: createUser, DELETE: deleteUser },
  '/api/saves': { GET: readSave, PUT: writeSave },
  '/api/scores': { GET: readScores },
};

/** Erreichbar ohne gültiges Cookie: der Login selbst und die Sitzungsabfrage. */
const PUBLIC_PATHS = new Set(['/api/login', '/api/session']);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Sollte durch run_worker_first nicht vorkommen; wenn doch, übernimmt
    // die Asset-Auslieferung, statt hier einen 404 zu erfinden.
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (!env.SESSION_SECRET || !env.SITE_PASSWORD) {
      return error(500, 'Server ist nicht konfiguriert: SITE_PASSWORD/SESSION_SECRET fehlen.');
    }

    const methods = ROUTES[pathname];
    if (!methods) return error(404, 'Unbekannter Endpunkt.');

    const handler = methods[request.method];
    if (!handler) {
      return new Response(JSON.stringify({ error: 'Methode nicht erlaubt.' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Allow: Object.keys(methods).join(', '),
        },
      });
    }

    if (!PUBLIC_PATHS.has(pathname) && !(await hasValidSession(request, env))) {
      return error(401, 'Nicht angemeldet.');
    }

    return handler(request, env);
  },
} satisfies ExportedHandler<Env>;
