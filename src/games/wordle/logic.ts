import { WORD_LENGTH } from './words';

export type Mark = 'correct' | 'present' | 'absent';

/**
 * Bewertet einen Rateversuch. Doppelte Buchstaben brauchen zwei Durchgänge:
 * erst die exakten Treffer markieren, danach die verbleibenden Buchstaben
 * aus dem Vorrat bedienen. Sonst bekäme "OTTER" gegen "ORTEN" ein zweites
 * gelbes T, das es gar nicht gibt.
 */
export function evaluate(guess: string, solution: string): Mark[] {
  const marks: Mark[] = Array(WORD_LENGTH).fill('absent');
  const pool = new Map<string, number>();

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === solution[i]) marks[i] = 'correct';
    else pool.set(solution[i], (pool.get(solution[i]) ?? 0) + 1);
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === 'correct') continue;
    const left = pool.get(guess[i]) ?? 0;
    if (left > 0) {
      marks[i] = 'present';
      pool.set(guess[i], left - 1);
    }
  }

  return marks;
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Bester bisher erreichter Status je Buchstabe – für die Tastaturfarben. */
export function letterStates(guesses: string[], solution: string): Record<string, Mark> {
  const states: Record<string, Mark> = {};
  for (const guess of guesses) {
    const marks = evaluate(guess, solution);
    for (let i = 0; i < guess.length; i++) {
      const current = states[guess[i]];
      if (!current || RANK[marks[i]] > RANK[current]) states[guess[i]] = marks[i];
    }
  }
  return states;
}

/** Ergebnis als Emoji-Raster – zum Teilen im Chat. */
export function shareText(puzzle: number, guesses: string[], solution: string, won: boolean): string {
  const rows = guesses.map((guess) =>
    evaluate(guess, solution)
      .map((mark) => (mark === 'correct' ? '🟩' : mark === 'present' ? '🟨' : '⬛'))
      .join(''),
  );
  const score = won ? `${guesses.length}/6` : 'X/6';
  return [`Wörtchen #${puzzle} ${score}`, '', ...rows].join('\n');
}
