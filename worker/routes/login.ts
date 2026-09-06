import { type Handler, error, json } from '../lib/http';
import { createSessionCookie } from '../lib/auth';

/** Kleine Bremse gegen stures Durchprobieren des Seitenpassworts. */
const DELAY_ON_FAILURE_MS = 700;

export const login: Handler = async (request, env) => {
  let password: unknown;
  try {
    ({ password } = (await request.json()) as { password?: unknown });
  } catch {
    return error(400, 'Ungültige Anfrage.');
  }

  if (typeof password !== 'string' || password !== env.SITE_PASSWORD) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_ON_FAILURE_MS));
    return error(401, 'Falsches Passwort.');
  }

  return json({ ok: true }, { headers: { 'Set-Cookie': await createSessionCookie(env) } });
};
