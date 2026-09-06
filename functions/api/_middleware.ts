import { type Env, error, hasValidSession } from '../lib/auth';

/**
 * Schützt alles unter /api/*. Ausgenommen ist nur der Login selbst und
 * die Sitzungsabfrage, die absichtlich auch ohne Cookie antworten muss.
 */
const PUBLIC_PATHS = new Set(['/api/login', '/api/session']);

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;

  if (!env.SESSION_SECRET || !env.SITE_PASSWORD) {
    return error(500, 'Server ist nicht konfiguriert: SITE_PASSWORD/SESSION_SECRET fehlen.');
  }

  const { pathname } = new URL(request.url);
  if (PUBLIC_PATHS.has(pathname)) return next();

  if (!(await hasValidSession(request, env))) {
    return error(401, 'Nicht angemeldet.');
  }
  return next();
};
