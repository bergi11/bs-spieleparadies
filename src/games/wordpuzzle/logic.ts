export type Direction = 'h' | 'v';

export interface Placement {
  word: string;
  row: number;
  col: number;
  dir: Direction;
}

export interface Level {
  id: number;
  letters: string;
  width: number;
  height: number;
  words: Placement[];
  /** Weitere legbare Wörter, die nicht im Gitter stehen. */
  bonus: string[];
}

/** Eine Zelle des Kreuzworträtsels. */
export interface Cell {
  row: number;
  col: number;
  letter: string;
  /** Alle Gitterwörter, die durch diese Zelle laufen. */
  words: string[];
}

/**
 * Baut die Zellen des Gitters aus den Wortplatzierungen. Kreuzungspunkte
 * gehören zu mehreren Wörtern – deshalb sammeln wir sie, statt nur den
 * Buchstaben abzulegen: eine Zelle wird sichtbar, sobald eines ihrer Wörter
 * gefunden ist.
 */
export function buildCells(level: Level): Cell[] {
  const map = new Map<string, Cell>();

  for (const placement of level.words) {
    for (let i = 0; i < placement.word.length; i++) {
      const row = placement.row + (placement.dir === 'v' ? i : 0);
      const col = placement.col + (placement.dir === 'h' ? i : 0);
      const key = `${row},${col}`;

      const existing = map.get(key);
      if (existing) existing.words.push(placement.word);
      else map.set(key, { row, col, letter: placement.word[i], words: [placement.word] });
    }
  }

  return [...map.values()];
}

export type GuessResult = 'grid' | 'bonus' | 'known' | 'unknown';

/** Wie ist ein eingegebenes Wort zu werten? */
export function classify(
  level: Level,
  word: string,
  foundGrid: readonly string[],
  foundBonus: readonly string[],
): GuessResult {
  if (foundGrid.includes(word) || foundBonus.includes(word)) return 'known';
  if (level.words.some((placement) => placement.word === word)) return 'grid';
  if (level.bonus.includes(word)) return 'bonus';
  return 'unknown';
}

export function isComplete(level: Level, foundGrid: readonly string[]): boolean {
  return level.words.every((placement) => foundGrid.includes(placement.word));
}

/**
 * Positionen der Buchstaben auf dem Rad, in den Koordinaten des SVG
 * (0–100 in beide Richtungen). Der erste Buchstabe sitzt oben, die
 * übrigen im Uhrzeigersinn.
 */
export function wheelPositions(count: number, radius = 34): { x: number; y: number }[] {
  if (count === 1) return [{ x: 50, y: 50 }];

  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
  });
}

/** Mischt die Buchstaben, ohne die Ausgangsreihenfolge zu wiederholen. */
export function shuffle(letters: string[]): string[] {
  if (letters.length < 3) return [...letters].reverse();

  const next = [...letters];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next.join('') === letters.join('') ? shuffle(letters) : next;
}
