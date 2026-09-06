-- Schema für bs-spieleparadies (Cloudflare D1 / SQLite)
-- Idempotent: kann gefahrlos erneut ausgeführt werden.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  avatar     TEXT NOT NULL DEFAULT '🎮',
  color      TEXT NOT NULL DEFAULT '#7c5cff',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Namen sind eindeutig, aber unabhängig von Groß-/Kleinschreibung.
CREATE UNIQUE INDEX IF NOT EXISTS users_name_unique ON users (lower(name));

-- Ein Spielstand pro (Nutzer, Spiel). `state` ist frei belegbares JSON,
-- damit jedes Spiel sein eigenes Format mitbringen kann.
CREATE TABLE IF NOT EXISTS saves (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    TEXT NOT NULL,
  state      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS saves_by_game ON saves (game_id);
