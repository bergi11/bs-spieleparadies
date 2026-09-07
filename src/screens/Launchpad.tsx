import { useEffect, useState, type CSSProperties } from 'react';
import { api, type User } from '../lib/api';
import { GAMES } from '../games/registry';

interface Props {
  user: User;
  onOpenGame: (id: string) => void;
  onSwitchUser: () => void;
  onBestenliste: () => void;
}

export function Launchpad({ user, onOpenGame, onSwitchUser, onBestenliste }: Props) {
  const [saves, setSaves] = useState<Record<string, { state: unknown }>>({});

  // Die Kacheln zeigen den Fortschritt des aktuellen Profils. Klappt das
  // Laden nicht, bleiben die Kacheln einfach ohne Zusatzzeile.
  useEffect(() => {
    let cancelled = false;
    api
      .loadAllSaves(user.id)
      .then(({ states }) => {
        if (!cancelled) setSaves(states);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <div className="launchpad">
      <header className="launch-bar">
        <div>
          <p className="muted">Willkommen zurück</p>
          <h1>{user.name}</h1>
        </div>
        <div className="launch-knoepfe">
          <button className="icon-button" onClick={onBestenliste} aria-label="Bestenliste">
            🏆
          </button>
          <button className="avatar-button" onClick={onSwitchUser} aria-label="Profil wechseln">
          <span className="profile-avatar" style={{ background: user.color }}>
            {user.avatar}
            </span>
          </button>
        </div>
      </header>

      <div className="tiles">
        {GAMES.map((game) => {
          const summary = game.summary?.(saves[game.id]?.state ?? null) ?? null;
          return (
            <button
              key={game.id}
              className="tile-card"
              style={{ '--accent': game.accent } as CSSProperties}
              onClick={() => onOpenGame(game.id)}
            >
              <span className="tile-icon">{game.icon}</span>
              <span className="tile-title">{game.title}</span>
              <span className="tile-tagline">{summary ?? game.tagline}</span>
            </button>
          );
        })}

        <div className="tile-card tile-placeholder">
          <span className="tile-icon">➕</span>
          <span className="tile-title">Mehr Spiele</span>
          <span className="tile-tagline">Kommen noch</span>
        </div>
      </div>
    </div>
  );
}
