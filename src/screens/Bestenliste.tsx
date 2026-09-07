import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { GAMES } from '../games/registry';

interface Spieler {
  id: string;
  name: string;
  avatar: string;
  color: string;
  staende: Record<string, unknown>;
}

interface Platz {
  spieler: Spieler;
  wert: number;
  text: string;
}

/**
 * Bestenliste über alle Profile.
 *
 * Was in einem Spiel „gut" ist, weiß nur das Spiel selbst – deshalb liefert
 * jedes über `bestwert` in der Registry seinen Vergleichswert. Spiele ohne
 * diese Angabe tauchen hier gar nicht auf.
 */
export function Bestenliste({ onExit }: { onExit: () => void }) {
  const [spieler, setSpieler] = useState<Spieler[] | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    api
      .loadScores()
      .then(({ spieler }) => {
        if (!abgebrochen) setSpieler(spieler);
      })
      .catch(() => {
        if (!abgebrochen) setFehler(true);
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Bestenliste</strong>
          <span>über alle Partien</span>
        </div>
        <div style={{ width: '2.75rem' }} />
      </header>

      <div className="bestenliste">
        {fehler && <p className="error">Bestenliste konnte nicht geladen werden.</p>}
        {!spieler && !fehler && <p className="muted">…</p>}

        {spieler &&
          GAMES.filter((spiel) => spiel.bestwert).map((spiel) => {
            const plaetze: Platz[] = spieler
              .map((s) => {
                const wertung = spiel.bestwert!(s.staende[spiel.id] ?? null);
                return wertung ? { spieler: s, ...wertung } : null;
              })
              .filter((p): p is Platz => p !== null)
              .sort((a, b) => b.wert - a.wert);

            return (
              <section key={spiel.id} className="besten-block">
                <h3 style={{ color: spiel.accent }}>
                  {spiel.icon} {spiel.title}
                </h3>

                {plaetze.length === 0 ? (
                  <p className="muted">Noch nichts gespielt.</p>
                ) : (
                  <ol className="besten-plaetze">
                    {plaetze.map((p, i) => (
                      <li key={p.spieler.id} className={i === 0 ? 'platz platz-erster' : 'platz'}>
                        <span className="platz-nummer">{i + 1}</span>
                        <span className="profile-avatar" style={{ background: p.spieler.color }}>
                          {p.spieler.avatar}
                        </span>
                        <span className="platz-name">
                          <strong>{p.spieler.name}</strong>
                          <span className="muted">{p.text}</span>
                        </span>
                        {i === 0 && <span className="platz-krone">👑</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
      </div>
    </div>
  );
}
