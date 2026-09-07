import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import { MAX_WRONG, drawnParts, outcome, positionsOf, wrongCount, type Outcome, type Part } from './logic';
import { pickWord } from './words';

export interface HangmanStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
}

export interface HangmanSave {
  /** Das gesuchte Wort. Leer heißt: es muss erst eins gezogen werden. */
  word: string;
  /** Geratene Buchstaben in der Reihenfolge des Ratens. */
  guessed: string[];
  surrendered: boolean;
  stats: HangmanStats;
}

const EMPTY_STATS: HangmanStats = { played: 0, won: 0, streak: 0, maxStreak: 0 };
const EMPTY: HangmanSave = { word: '', guessed: [], surrendered: false, stats: EMPTY_STATS };

const KEYBOARD_ROWS = ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'];

/**
 * Zeiten der Buchstabenanimation. Sie stehen auch im Stylesheet – wird hier
 * gedreht, muss es dort mitgedreht werden, sonst passt der Schnitt nicht mehr.
 */
const CHARGE_MS = 620;
const FLY_MS = 380;
const FLY_STAGGER_MS = 90;
const MISS_MS = 560;
/** Fallen, Pendeln, Gesicht – so lange dauert das Ende. */
const DEATH_MS = 2900;
const WIN_MS = 800;

/** Lob nach Fehlern – je knapper es war, desto zurückhaltender. */
function praise(wrong: number): string {
  if (wrong === 0) return 'Makellos!';
  if (wrong <= 3) return 'Sauber!';
  if (wrong <= 7) return 'Geschafft!';
  return 'Puh, knapp!';
}

type Point = { x: number; y: number };
type Phase = 'idle' | 'charge' | 'fly' | 'miss';

interface Flight {
  letter: string;
  /** Mitte der gedrückten Taste. */
  from: Point;
  /** Bühne über dem Galgen, wo der Buchstabe kurz zappelt. */
  spot: Point;
  /** Mitten der Felder, in die der Buchstabe fällt – leer beim Fehlgriff. */
  targets: Point[];
}

const center = (box: DOMRect): Point => ({
  x: box.left + box.width / 2,
  y: box.top + box.height / 2,
});

const wantsCalm = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function record(stats: HangmanStats, won: boolean): HangmanStats {
  const streak = won ? stats.streak + 1 : 0;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
  };
}

export function Hangman({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<HangmanSave>(user.id, 'hangman', EMPTY);

  const [phase, setPhase] = useState<Phase>('idle');
  const [flight, setFlight] = useState<Flight | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const keyRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const slotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Ausgang, den die Ergebnisanzeige zuletzt gesehen hat. */
  const settled = useRef<Outcome | null>(null);

  const word = save.word ?? '';
  const guessed = save.guessed ?? [];
  const surrendered = save.surrendered ?? false;
  const stats = save.stats ?? EMPTY_STATS;

  const wrong = wrongCount(word, guessed);
  const state = outcome(word, guessed, surrendered);
  const parts = drawnParts(word, guessed, surrendered);
  const dead = state === 'lost';

  const later = useCallback((run: () => void, delay: number) => {
    timers.current.push(setTimeout(run, delay));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Erst nach dem Laden ein Wort ziehen – vorher wüssten wir nicht, ob schon
  // eine Runde läuft, und würden sie überschreiben.
  useEffect(() => {
    if (status !== 'bereit' || save.word) return;
    const next = pickWord();
    persist((previous) => ({ ...previous, word: next, guessed: [], surrendered: false }));
  }, [persist, save.word, status]);

  // Das Ergebnis kommt erst, wenn die Animation durch ist. Beim erneuten
  // Öffnen einer beendeten Runde steht es dagegen sofort da.
  useEffect(() => {
    if (phase !== 'idle') return;

    const before = settled.current;
    settled.current = state;

    if (state === 'running') {
      setShowResult(false);
      return;
    }

    const delay = before === 'running' ? (state === 'lost' ? DEATH_MS : WIN_MS) : 0;
    const timer = setTimeout(() => setShowResult(true), delay);
    return () => clearTimeout(timer);
  }, [phase, state]);

  const commit = useCallback(
    (letter: string) => {
      persist((previous) => {
        const nextGuessed = [...(previous.guessed ?? []), letter];
        const next = { ...previous, guessed: nextGuessed };
        const result = outcome(previous.word ?? '', nextGuessed, previous.surrendered ?? false);
        if (result === 'running') return next;
        return { ...next, stats: record(previous.stats ?? EMPTY_STATS, result === 'won') };
      });
    },
    [persist],
  );

  const press = useCallback(
    (letter: string) => {
      if (state !== 'running' || phase !== 'idle' || status === 'laden') return;
      if (!word || guessed.includes(letter)) return;

      const key = keyRefs.current[letter];
      const board = boardRef.current;
      if (wantsCalm() || !key || !board) {
        commit(letter);
        return;
      }

      const stage = board.getBoundingClientRect();
      const spot = { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 };
      const targets = positionsOf(word, letter)
        .map((index) => slotRefs.current[index])
        .filter((slot): slot is HTMLSpanElement => slot !== null)
        .map((slot) => center(slot.getBoundingClientRect()));

      setFlight({ letter, from: center(key.getBoundingClientRect()), spot, targets });
      setPhase('charge');

      later(() => {
        if (targets.length > 0) {
          setPhase('fly');
          later(
            () => {
              commit(letter);
              setFlight(null);
              setPhase('idle');
            },
            FLY_MS + (targets.length - 1) * FLY_STAGGER_MS,
          );
        } else {
          // Der Strich soll wachsen, während der Buchstabe zerfällt.
          commit(letter);
          setPhase('miss');
          later(() => {
            setFlight(null);
            setPhase('idle');
          }, MISS_MS);
        }
      }, CHARGE_MS);
    },
    [commit, guessed, later, phase, state, status, word],
  );

  // Damit es sich auch am Rechner vernünftig spielt.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Liegt ein Blatt über dem Spiel, gehört die Tastatur ihm.
      if (showStats || showResult) return;
      if (/^[a-zA-Z]$/.test(event.key)) press(event.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, showResult, showStats]);

  const newRound = useCallback(() => {
    const next = pickWord(word);
    setShowResult(false);
    setShowStats(false);
    persist((previous) => ({ ...previous, word: next, guessed: [], surrendered: false }));
  }, [persist, word]);

  const surrender = useCallback(() => {
    setShowStats(false);
    persist((previous) => ({
      ...previous,
      surrendered: true,
      stats: record(previous.stats ?? EMPTY_STATS, false),
    }));
  }, [persist]);

  /**
   * Noch nicht verdiente Teile stehen blass schon da. Das füllt die Fläche und
   * zeigt beim Raten, wie viel Galgen noch fehlt – aus dem Wechsel der Klasse
   * ergibt sich außerdem von selbst die Zeichenanimation.
   */
  const line = (part: Part, extra?: string) =>
    parts.includes(part) ? ['galgen-strich', extra].filter(Boolean).join(' ') : 'galgen-schatten';

  const busy = phase !== 'idle';

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Galgenmännchen</strong>
          <span>{surrendered ? 'Aufgegeben' : `${wrong}/${MAX_WRONG} Fehler`}</span>
        </div>
        <button className="icon-button" onClick={() => setShowStats(true)} aria-label="Statistik">
          📊
        </button>
      </header>

      <div className={dead ? 'hangman-board hangman-board-dead' : 'hangman-board'} ref={boardRef}>
        <svg
          className="hangman-gallows"
          viewBox="0 0 100 116"
          role="img"
          aria-label={`Galgen: ${wrong} von ${MAX_WRONG} Teilen gezeichnet`}
        >
          <line className={line('ground', 'balken')} x1="8" y1="110" x2="80" y2="110" pathLength={1} />
          <line className={line('post', 'balken')} x1="22" y1="110" x2="22" y2="8" pathLength={1} />
          <line className={line('beam', 'balken')} x1="21" y1="8" x2="64" y2="8" pathLength={1} />
          <line className={line('brace', 'balken')} x1="22" y1="26" x2="40" y2="8" pathLength={1} />

          {/* Eigenes Koordinatensystem mit dem Nullpunkt am Querbalken: dort
              hängt der Strick, und um diesen Punkt pendelt später alles. */}
          <g transform="translate(64,8)">
            <g className={dead ? 'hangman-figur hangman-figur-tot' : 'hangman-figur'}>
              <line className={line('rope', 'strick')} x1="0" y1="0" x2="0" y2="16" pathLength={1} />
              <circle className={line('head')} cx="0" cy="24" r="8" pathLength={1} />
              <line className={line('body')} x1="0" y1="32" x2="0" y2="62" pathLength={1} />
              <line className={line('armLeft')} x1="0" y1="38" x2="-13" y2="50" pathLength={1} />
              <line className={line('armRight')} x1="0" y1="38" x2="13" y2="50" pathLength={1} />
              <line className={line('legLeft')} x1="0" y1="62" x2="-12" y2="80" pathLength={1} />
              <line className={line('legRight')} x1="0" y1="62" x2="12" y2="80" pathLength={1} />

              {dead && (
                <g className="hangman-gesicht">
                  <line x1="-4.5" y1="20.5" x2="-1.5" y2="23.5" />
                  <line x1="-4.5" y1="23.5" x2="-1.5" y2="20.5" />
                  <line x1="1.5" y1="20.5" x2="4.5" y2="23.5" />
                  <line x1="1.5" y1="23.5" x2="4.5" y2="20.5" />
                  <path d="M -3 29.5 Q 0 26.5 3 29.5" />
                </g>
              )}
            </g>
          </g>
        </svg>
      </div>

      <div className="hangman-wort">
        {[...word].map((letter, index) => {
          const known = guessed.includes(letter);
          const missed = !known && state === 'lost';
          const classes = ['hangman-feld'];
          if (known) classes.push('hangman-feld-voll');
          if (missed) classes.push('hangman-feld-verpasst');
          return (
            <span
              key={index}
              ref={(element) => {
                slotRefs.current[index] = element;
              }}
              className={classes.join(' ')}
            >
              {known || missed ? letter : ''}
            </span>
          );
        })}
      </div>

      <div className="keyboard">
        {KEYBOARD_ROWS.map((row) => (
          <div className="keyboard-row" key={row}>
            {[...row].map((letter) => {
              const tried = guessed.includes(letter);
              const classes = ['key'];
              if (tried) classes.push(word.includes(letter) ? 'key-correct' : 'key-absent');
              return (
                <button
                  key={letter}
                  ref={(element) => {
                    keyRefs.current[letter] = element;
                  }}
                  className={classes.join(' ')}
                  disabled={tried || busy || state !== 'running'}
                  onClick={() => press(letter)}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {status === 'fehler' && (
        <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>
      )}

      {flight && phase === 'charge' && (
        <Flyer letter={flight.letter} from={flight.from} to={flight.spot} variant="laden" />
      )}

      {flight &&
        phase === 'fly' &&
        flight.targets.map((target, index) => (
          <Flyer
            key={index}
            letter={flight.letter}
            from={flight.spot}
            to={target}
            delay={index * FLY_STAGGER_MS}
            variant="treffer"
          />
        ))}

      {flight && phase === 'miss' && (
        <Flyer letter={flight.letter} from={flight.spot} to={flight.spot} variant="daneben" />
      )}

      {showResult && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <h2>{state === 'won' ? praise(wrong) : 'Aufgeknüpft.'}</h2>
            <p className="muted">
              {state !== 'won'
                ? `Gesucht war: ${word}`
                : wrong === 0
                  ? `${word} – ohne einen Fehler.`
                  : `${word} – mit ${wrong} ${wrong === 1 ? 'Fehler' : 'Fehlern'}.`}
            </p>
            <div className="sheet-actions">
              <button className="button" onClick={newRound}>
                Neues Wort
              </button>
              <button className="button button-ghost" onClick={onExit}>
                Zurück zum Launchpad
              </button>
            </div>
          </div>
        </div>
      )}

      {showStats && (
        <StatsSheet
          stats={stats}
          canSurrender={state === 'running' && guessed.length > 0 && !busy}
          onSurrender={surrender}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

/**
 * Der fliegende Buchstabe. Die Bahn steckt in CSS-Variablen, damit die
 * Bewegung eine Keyframe-Animation bleibt und sich sauber abwarten lässt.
 * Außen liegt die Bahn, innen das Zappeln – zwei Ebenen, weil sich sonst
 * beide um dieselbe `transform` streiten würden.
 */
function Flyer({
  letter,
  from,
  to,
  delay = 0,
  variant,
}: {
  letter: string;
  from: Point;
  to: Point;
  delay?: number;
  variant: 'laden' | 'treffer' | 'daneben';
}) {
  const style = {
    '--von-x': `${from.x}px`,
    '--von-y': `${from.y}px`,
    '--zu-x': `${to.x}px`,
    '--zu-y': `${to.y}px`,
    '--verzug': `${delay}ms`,
  } as CSSProperties;

  return (
    <span className={`hangman-flug hangman-flug-${variant}`} style={style} aria-hidden="true">
      <span className="hangman-flug-kern">{letter}</span>
    </span>
  );
}

function StatsSheet({
  stats,
  canSurrender,
  onSurrender,
  onClose,
}: {
  stats: HangmanStats;
  canSurrender: boolean;
  onSurrender: () => void;
  onClose: () => void;
}) {
  const quote = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>Statistik</h2>

        <div className="stat-row">
          <Stat label="Gespielt" value={stats.played} />
          <Stat label="Gerettet" value={`${quote}%`} />
          <Stat label="Serie" value={stats.streak} />
          <Stat label="Beste" value={stats.maxStreak} />
        </div>

        <div className="sheet-actions">
          {canSurrender && (
            <button className="button button-ghost" onClick={onSurrender}>
              Aufgeben
            </button>
          )}
          <button className="button" onClick={onClose}>
            Weiterspielen
          </button>
        </div>
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
