import { type Env, clearSessionCookie, hasValidSession, json } from '../lib/auth';

/** Fragt beim Seitenstart ab, ob das Cookie noch gilt. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  return json({ authenticated: await hasValidSession(request, env) });
};

/** Abmelden. */
export const onRequestDelete: PagesFunction<Env> = async () => {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
