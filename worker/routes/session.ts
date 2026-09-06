import { type Handler, json } from '../lib/http';
import { clearSessionCookie, hasValidSession } from '../lib/auth';

/** Fragt beim Seitenstart ab, ob das Cookie noch gilt. */
export const readSession: Handler = async (request, env) => {
  return json({ authenticated: await hasValidSession(request, env) });
};

/** Abmelden. */
export const logout: Handler = () => {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
