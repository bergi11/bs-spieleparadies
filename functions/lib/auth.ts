/**
 * Sehr schlanke Sitzungsverwaltung: ein gemeinsames Seitenpasswort.
 * Nach erfolgreichem Login bekommt der Browser ein signiertes Cookie
 * ("<ablauf>.<hmac>"). Es gibt keine Nutzer-Anmeldung – die Profile auf
 * der Seite sind nur Namensschilder, kein Sicherheitsmerkmal.
 */

export interface Env {
  DB: D1Database;
  SITE_PASSWORD: string;
  SESSION_SECRET: string;
}

export const COOKIE_NAME = 'bsp_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // ~6 Monate

const encoder = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Vergleich in konstanter Zeit, damit die Signatur nicht erratbar wird. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionCookie(env: Env): Promise<string> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = `${expires}.${await hmac(env.SESSION_SECRET, String(expires))}`;
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join('; ');
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function hasValidSession(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  const [expires, signature] = decodeURIComponent(match[1]).split('.');
  if (!expires || !signature) return false;
  if (!Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return false;

  return safeEqual(signature, await hmac(env.SESSION_SECRET, expires));
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  });
}

export function error(status: number, message: string): Response {
  return json({ error: message }, { status });
}
