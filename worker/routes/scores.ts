import { type Handler, json } from '../lib/http';

/**
 * Alle Spielstände aller Profile auf einmal – Grundlage der Bestenliste.
 *
 * Die Auswertung, was in einem Spiel „gut" ist, macht das Frontend: dort steht
 * ohnehin je Spiel, wie sein Spielstand aussieht. Hier wird nur eingesammelt.
 */

interface Zeile {
  id: string;
  name: string;
  avatar: string;
  color: string;
  game_id: string | null;
  state: string | null;
}

export const readScores: Handler = async (_request, env) => {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, u.avatar, u.color, s.game_id, s.state
     FROM users u
     LEFT JOIN saves s ON s.user_id = u.id
     ORDER BY u.created_at`,
  ).all<Zeile>();

  const spieler = new Map<
    string,
    { id: string; name: string; avatar: string; color: string; staende: Record<string, unknown> }
  >();

  for (const zeile of results ?? []) {
    if (!spieler.has(zeile.id)) {
      spieler.set(zeile.id, {
        id: zeile.id,
        name: zeile.name,
        avatar: zeile.avatar,
        color: zeile.color,
        staende: {},
      });
    }
    // Ein Profil ohne Spielstand kommt durch den LEFT JOIN mit leeren Feldern.
    if (zeile.game_id && zeile.state) {
      spieler.get(zeile.id)!.staende[zeile.game_id] = JSON.parse(zeile.state);
    }
  }

  return json({ spieler: [...spieler.values()] });
};
