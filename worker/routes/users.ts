import { type Handler, error, json } from '../lib/http';

interface UserRow {
  id: string;
  name: string;
  avatar: string;
  color: string;
  created_at: string;
}

const NAME_MAX = 20;

export const listUsers: Handler = async (_request, env) => {
  const { results } = await env.DB.prepare(
    'SELECT id, name, avatar, color, created_at FROM users ORDER BY created_at',
  ).all<UserRow>();
  return json({ users: results ?? [] });
};

export const createUser: Handler = async (request, env) => {
  let body: { name?: unknown; avatar?: unknown; color?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return error(400, 'Ungültige Anfrage.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return error(400, 'Bitte einen Namen angeben.');
  if (name.length > NAME_MAX) return error(400, `Name darf höchstens ${NAME_MAX} Zeichen haben.`);

  const user: UserRow = {
    id: crypto.randomUUID(),
    name,
    avatar: typeof body.avatar === 'string' && body.avatar ? body.avatar.slice(0, 8) : '🎮',
    color:
      typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#7c5cff',
    created_at: new Date().toISOString(),
  };

  try {
    await env.DB.prepare(
      'INSERT INTO users (id, name, avatar, color, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(user.id, user.name, user.avatar, user.color, user.created_at)
      .run();
  } catch (err) {
    // Der Unique-Index auf lower(name) greift bei doppelten Namen.
    if (String(err).includes('UNIQUE')) return error(409, 'Diesen Namen gibt es schon.');
    throw err;
  }

  return json({ user }, { status: 201 });
};

/**
 * Profil löschen. Die Spielstände räumen wir ausdrücklich mit ab, statt uns
 * auf ON DELETE CASCADE zu verlassen – so bleibt es auch dann korrekt, wenn
 * Fremdschlüssel in der Datenbank einmal nicht erzwungen werden.
 */
export const deleteUser: Handler = async (request, env) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error(400, 'Parameter "id" fehlt.');

  const [, deleted] = await env.DB.batch([
    env.DB.prepare('DELETE FROM saves WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  if (!deleted.meta.changes) return error(404, 'Profil nicht gefunden.');
  return json({ ok: true });
};
