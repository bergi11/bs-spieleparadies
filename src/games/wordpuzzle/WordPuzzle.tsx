import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import { buildCells, classify, isComplete, shuffle, wheelPositions, type Level } from './logic';
import levelData from './levels.json';

const LEVELS = levelData as Level[];

export interface WordPuzzleSave {
  /** 1-basierte Nummer des aktuellen Levels. */
  level: number;
  found: string[];
  bonus: string[];
  solved: number;
  bonusTotal: number;
}

const EMPTY: WordPuzzleSave = { level: 1, found: [], bonus: [], solved: 0, bonusTotal: 0 };

/** Trefferradius um einen Buchstaben, in SVG-Einheiten. Etwas großzügiger
 *  als der gezeichnete Kreis (r = 11), damit Daumen nicht danebengreifen. */
const HIT_RADIUS = 13;

export function WordPuzzle({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<WordPuzzleSave>(
    user.id,
    'wordpuzzle',
    EMPTY,
  );

  const levelIndex = Math.min(Math.max(save.level, 1), LEVELS.length) - 1;
  const level = LEVELS[levelIndex];

  const [order, setOrder] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /**
   * Zeigerereignisse kommen mit 60–120 Hz herein, also schneller als React
   * neu rendert. Würden die Handler die Auswahl aus dem State lesen, wären
   * sie bei zügigem Ziehen veraltet und es fielen Buchstaben unter den
   * Tisch. Die Ref ist deshalb die Wahrheit, der State nur fürs Zeichnen.
   */
  const pickedRef = useRef<number[]>([]);

  const updatePicked = useCallback((next: number[]) => {
    pickedRef.current = next;
    setPicked(next);
  }, []);

  // Bei jedem Levelwechsel neu mischen.
  useEffect(() => {
    setOrder(shuffle(level.letters.split('')));
    updatePicked([]);
  }, [level, updatePicked]);

  const positions = useMemo(() => wheelPositions(order.length), [order.length]);
  const cells = useMemo(() => buildCells(level), [level]);

  const found = save.found ?? [];
  const bonus = save.bonus ?? [];
  const done = isComplete(level, found);

  const notify = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage((current) => (current === text ? null : current)), 1600);
  }, []);

  const submit = useCallback(
    (indices: number[]) => {
      const word = indices.map((i) => order[i]).join('');
      if (word.length < 3) return;

      switch (classify(level, word, found, bonus)) {
        case 'known':
          notify('Schon gefunden.');
          break;
        case 'grid':
          persist((previous) => ({ ...previous, found: [...(previous.found ?? []), word] }));
          break;
        case 'bonus':
          persist((previous) => ({
            ...previous,
            bonus: [...(previous.bonus ?? []), word],
            bonusTotal: (previous.bonusTotal ?? 0) + 1,
          }));
          notify(`Bonuswort: ${word}`);
          break;
        default:
          notify('Kenne ich nicht.');
      }
    },
    [bonus, found, level, notify, order, persist],
  );

  /** Zeigerposition in die Koordinaten des SVG umrechnen (0–100). */
  const toSvg = (event: React.PointerEvent): { x: number; y: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const letterAt = (point: { x: number; y: number }): number | null => {
    for (let i = 0; i < positions.length; i++) {
      const dx = positions[i].x - point.x;
      const dy = positions[i].y - point.y;
      if (Math.hypot(dx, dy) <= HIT_RADIUS) return i;
    }
    return null;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (done || status === 'laden') return;
    const point = toSvg(event);
    if (!point) return;

    const index = letterAt(point);
    if (index === null) return;

    // Der Zeiger kann zwischen Ereignis und Aufruf schon wieder weg sein –
    // dann wirft setPointerCapture. Das Ziehen soll deshalb auch ohne
    // Capture weiterlaufen.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ohne Capture geht es auch, nur weniger zuverlässig am Rand */
    }

    updatePicked([index]);
    setPointer(point);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = pickedRef.current;
    if (!current.length) return;

    const point = toSvg(event);
    if (!point) return;
    setPointer(point);

    const index = letterAt(point);
    if (index === null) return;

    // Zurückziehen auf den vorletzten Buchstaben nimmt den letzten weg –
    // so lässt sich ein Vertippen korrigieren, ohne neu anzusetzen.
    if (current.length > 1 && index === current[current.length - 2]) {
      updatePicked(current.slice(0, -1));
      return;
    }
    if (!current.includes(index)) updatePicked([...current, index]);
  };

  const onPointerUp = () => {
    if (pickedRef.current.length) submit(pickedRef.current);
    updatePicked([]);
    setPointer(null);
  };

  const advance = () => {
    persist((previous) => ({
      level: Math.min((previous.level ?? 1) + 1, LEVELS.length),
      found: [],
      bonus: [],
      solved: (previous.solved ?? 0) + 1,
      bonusTotal: previous.bonusTotal ?? 0,
    }));
  };

  const draft = picked.map((i) => order[i]).join('');
  const lastLevel = save.level >= LEVELS.length && done;

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Wortsalat</strong>
          <span>
            Level {level.id} · {found.length}/{level.words.length}
          </span>
        </div>
        <div className="bonus-count" title="Gesammelte Bonuswörter">
          ✦ {save.bonusTotal ?? 0}
        </div>
      </header>

      <div className="puzzle-board">
        {message && <div className="toast">{message}</div>}

        <svg
          className="puzzle-grid"
          viewBox={`0 0 ${level.width * 10} ${level.height * 10}`}
          role="img"
          aria-label="Kreuzworträtsel"
        >
          {cells.map((cell) => {
            const revealed = cell.words.some((word) => found.includes(word));
            return (
              <g key={`${cell.row},${cell.col}`}>
                <rect
                  x={cell.col * 10 + 0.5}
                  y={cell.row * 10 + 0.5}
                  width={9}
                  height={9}
                  rx={1.5}
                  className={revealed ? 'cell cell-found' : 'cell'}
                />
                {revealed && (
                  <text
                    x={cell.col * 10 + 5}
                    y={cell.row * 10 + 5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="cell-letter"
                  >
                    {cell.letter}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="draft">{draft || ' '}</div>

      {bonus.length > 0 && (
        <div className="bonus-words">
          {bonus.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </div>
      )}

      <div className="wheel-wrap">
        <svg
          ref={svgRef}
          className="wheel"
          viewBox="0 0 100 100"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <circle cx={50} cy={50} r={46} className="wheel-bg" />

          {picked.length > 0 && (
            <polyline
              className="wheel-trail"
              points={[
                ...picked.map((i) => `${positions[i].x},${positions[i].y}`),
                ...(pointer ? [`${pointer.x},${pointer.y}`] : []),
              ].join(' ')}
            />
          )}

          {order.map((letter, i) => (
            <g key={`${letter}-${i}`}>
              <circle
                cx={positions[i].x}
                cy={positions[i].y}
                r={11}
                className={picked.includes(i) ? 'wheel-key wheel-key-active' : 'wheel-key'}
              />
              <text
                x={positions[i].x}
                y={positions[i].y}
                textAnchor="middle"
                dominantBaseline="central"
                className="wheel-letter"
              >
                {letter}
              </text>
            </g>
          ))}
        </svg>

        <button
          className="icon-button shuffle"
          onClick={() => setOrder(shuffle(order))}
          aria-label="Buchstaben mischen"
        >
          ⟳
        </button>
      </div>

      {status === 'fehler' && (
        <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>
      )}

      {done && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <h2>{lastLevel ? 'Alle Level geschafft!' : 'Level geschafft!'}</h2>
            <p className="muted">
              {level.words.length} Wörter gefunden
              {bonus.length > 0 &&
                `, dazu ${bonus.length} ${bonus.length === 1 ? 'Bonuswort' : 'Bonuswörter'}`}
              .
            </p>
            <div className="sheet-actions">
              {lastLevel ? (
                <button className="button" onClick={onExit}>
                  Zurück zum Launchpad
                </button>
              ) : (
                <button className="button" onClick={advance}>
                  Weiter zu Level {level.id + 1}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
