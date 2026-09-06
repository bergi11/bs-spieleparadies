import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import { evaluate, letterStates, shareText, type Mark } from './logic';
import { MAX_GUESSES, WORD_LENGTH, isValidGuess, puzzleNumber, solutionFor } from './words';

export interface WordleStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastPuzzle: number | null;
  distribution: number[];
}

export interface WordleSave {
  puzzle: number;
  guesses: string[];
  stats: WordleStats;
}

const EMPTY_STATS: WordleStats = {
  played: 0,
  won: 0,
  streak: 0,
  maxStreak: 0,
  lastPuzzle: null,
  distribution: Array(MAX_GUESSES).fill(0),
};

const KEYBOARD_ROWS = ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'];

const PRAISE = ['Wahnsinn!', 'Stark!', 'Sauber!', 'Gut gemacht!', 'Geschafft!', 'Puh, knapp!'];

export function Wordle({ user, onExit }: GameProps) {
  const today = useMemo(() => puzzleNumber(), []);
  const solution = useMemo(() => solutionFor(today), [today]);

  const fallback = useMemo<WordleSave>(
    () => ({ puzzle: today, guesses: [], stats: EMPTY_STATS }),
    [today],
  );
  const { state: save, save: persist, status } = useGameSave<WordleSave>(user.id, 'wordle', fallback);

  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Ist der gespeicherte Stand von gestern, bleibt nur die Statistik stehen.
  const guesses = save.puzzle === today ? save.guesses : [];
  const won = guesses.includes(solution);
  const finished = won || guesses.length >= MAX_GUESSES;

  const notify = useCallback((text: string, shake = true) => {
    setMessage(text);
    if (shake) {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    }
    setTimeout(() => setMessage((current) => (current === text ? null : current)), 2200);
  }, []);

  const submit = useCallback(() => {
    if (finished || status === 'laden') return;
    if (draft.length < WORD_LENGTH) {
      notify('Zu kurz.');
      return;
    }
    if (!isValidGuess(draft)) {
      notify('Kenne ich nicht.');
      return;
    }

    const nextGuesses = [...guesses, draft];
    const hitIt = draft === solution;
    const over = hitIt || nextGuesses.length >= MAX_GUESSES;

    persist((previous) => {
      const stats = previous.stats ?? EMPTY_STATS;
      if (!over) return { puzzle: today, guesses: nextGuesses, stats };

      // Eine ununterbrochene Serie heißt: das vorige Rätsel war gestern.
      const continues = stats.lastPuzzle === today - 1;
      const streak = hitIt ? (continues ? stats.streak + 1 : 1) : 0;
      const distribution = [...stats.distribution];
      if (hitIt) distribution[nextGuesses.length - 1] += 1;

      return {
        puzzle: today,
        guesses: nextGuesses,
        stats: {
          played: stats.played + 1,
          won: stats.won + (hitIt ? 1 : 0),
          streak,
          maxStreak: Math.max(stats.maxStreak, streak),
          lastPuzzle: today,
          distribution,
        },
      };
    });

    setDraft('');
    if (over) {
      notify(hitIt ? PRAISE[nextGuesses.length - 1] : solution, false);
      setTimeout(() => setShowStats(true), 1600);
    }
  }, [draft, finished, guesses, notify, persist, solution, status, today]);

  const press = useCallback(
    (key: string) => {
      if (finished) return;
      if (key === 'ENTER') {
        submit();
      } else if (key === 'BACK') {
        setDraft((current) => current.slice(0, -1));
      } else if (/^[A-Z]$/.test(key)) {
        setDraft((current) => (current.length < WORD_LENGTH ? current + key : current));
      }
    },
    [finished, submit],
  );

  // Damit es sich auch am Rechner vernünftig spielt.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Enter') press('ENTER');
      else if (event.key === 'Backspace') press('BACK');
      else if (/^[a-zA-Z]$/.test(event.key)) press(event.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const keyStates = useMemo(() => letterStates(guesses, solution), [guesses, solution]);

  const rows = useMemo(() => {
    const played: { word: string; marks: Mark[] | null }[] = guesses.map((guess) => ({
      word: guess,
      marks: evaluate(guess, solution),
    }));
    const active = finished ? [] : [{ word: draft.padEnd(WORD_LENGTH), marks: null }];
    const empty = Array.from({ length: Math.max(0, MAX_GUESSES - played.length - active.length) }, () => ({
      word: ' '.repeat(WORD_LENGTH),
      marks: null,
    }));
    return [...played, ...active, ...empty];
  }, [draft, finished, guesses, solution]);

  const share = async () => {
    const text = shareText(today, guesses, solution, won);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        notify('Ergebnis kopiert.', false);
      }
    } catch {
      // Bricht der Nutzer den Teilen-Dialog ab, ist das kein Fehler.
    }
  };

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Wörtchen</strong>
          <span>Rätsel #{today}</span>
        </div>
        <button className="icon-button" onClick={() => setShowStats(true)} aria-label="Statistik">
          📊
        </button>
      </header>

      <div className="wordle-board">
        {message && <div className="toast">{message}</div>}

        <div className={shaking ? 'wordle-grid shake' : 'wordle-grid'}>
          {rows.map((row, rowIndex) => (
            <div className="wordle-row" key={rowIndex}>
              {Array.from({ length: WORD_LENGTH }, (_, i) => {
                const letter = row.word[i] === ' ' ? '' : row.word[i];
                const classes = ['tile'];
                if (row.marks) classes.push(`tile-${row.marks[i]}`);
                else if (letter) classes.push('tile-filled');
                return (
                  <div
                    key={i}
                    className={classes.join(' ')}
                    style={row.marks ? { animationDelay: `${i * 90}ms` } : undefined}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="keyboard">
        {KEYBOARD_ROWS.map((row, index) => (
          <div className="keyboard-row" key={row}>
            {index === 2 && (
              <button className="key key-wide" onClick={() => press('ENTER')}>
                Enter
              </button>
            )}
            {row.split('').map((letter) => (
              <button
                key={letter}
                className={keyStates[letter] ? `key key-${keyStates[letter]}` : 'key'}
                onClick={() => press(letter)}
              >
                {letter}
              </button>
            ))}
            {index === 2 && (
              <button className="key key-wide" onClick={() => press('BACK')} aria-label="Löschen">
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      {status === 'fehler' && <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>}

      {showStats && (
        <StatsSheet
          stats={save.stats ?? EMPTY_STATS}
          finished={finished}
          onShare={share}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

function StatsSheet({
  stats,
  finished,
  onShare,
  onClose,
}: {
  stats: WordleStats;
  finished: boolean;
  onShare: () => void;
  onClose: () => void;
}) {
  const best = Math.max(1, ...stats.distribution);
  const quote = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>Statistik</h2>

        <div className="stat-row">
          <Stat label="Gespielt" value={stats.played} />
          <Stat label="Gewonnen" value={`${quote}%`} />
          <Stat label="Serie" value={stats.streak} />
          <Stat label="Beste" value={stats.maxStreak} />
        </div>

        <h3>Verteilung</h3>
        <div className="distribution">
          {stats.distribution.map((count, index) => (
            <div className="distribution-row" key={index}>
              <span className="distribution-label">{index + 1}</span>
              <div className="bar" style={{ width: `${Math.max(10, (count / best) * 100)}%` }}>
                {count}
              </div>
            </div>
          ))}
        </div>

        <div className="sheet-actions">
          {finished && (
            <button className="button" onClick={onShare}>
              Ergebnis teilen
            </button>
          )}
          <button className="button button-ghost" onClick={onClose}>
            Schließen
          </button>
        </div>

        {!finished && <p className="hint">Das nächste Rätsel gibt es um Mitternacht.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
