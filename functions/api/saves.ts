import { type Env, error, json } from '../lib/auth';

/**
 * Spielstände. Der Inhalt von `state` ist bewusst nicht festgelegt – jedes
 * Spiel legt sein eigenes JSON ab und interpretiert es selbst.
 */

const MAX_STATE_BYTES = 64 * 1024;

/** GET /api/saves?user=<id>[&game=<id>] */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const params = new URL(request.url).searchParams;
  const userId = params.get('user');
  const gameId = params.get('game');
  if (!userId) return error(400, 'Parameter "user" fehlt.');

  if (gameId) {
    const row = await env.DB.prepare(
      'SELECT state, updated_at FROM saves WHERE user_id = ? AND game_id = ?',
    )
      .bind(userId, gameId)
      .first<{ state: string; updated_at: string }>();

    if (!row) return json({ state: null, updatedAt: null });
    return json({ state: JSON.parse(row.state), updatedAt: row.updated_at });
  }

  // Ohne "game" alle Stände des Nutzers – praktisch fürs Launchpad,
  // das je Kachel eine kurze Zusammenfassung anzeigt.
  const { results } = await env.DB.prepare(
    'SELECT game_id, state, updated_at FROM saves WHERE user_id = ?',
  )
    .bind(userId)
    .all<{ game_id: string; state: string; updated_at: string }>();

  const states: Record<string, { state: unknown; updatedAt: string }> = {};
  for (const row of results ?? []) {
    states[row.game_id] = { state: JSON.parse(row.state), updatedAt: row.updated_at };
  }
  return json({ states });
};

/** PUT /api/saves  { userId, gameId, state } */
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  let body: { userId?: unknown; gameId?: unknown; state?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return error(400, 'Ungültige Anfrage.');
  }

  const { userId, gameId, state } = body;
  if (typeof userId !== 'string' || !userId) return error(400, '"userId" fehlt.');
  if (typeof gameId !== 'string' || !gameId) return error(400, '"gameId" fehlt.');
  if (state === undefined) return error(400, '"state" fehlt.');

  const serialised = JSON.stringify(state);
  if (serialised.length > MAX_STATE_BYTES) return error(413, 'Spielstand ist zu groß.');

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error(404, 'Profil nicht gefunden.');

  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saves (user_id, game_id, state, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, game_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
  )
    .bind(userId, gameId, serialised, updatedAt)
    .run();

  return json({ ok: true, updatedAt });
};
