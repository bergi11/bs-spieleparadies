/**
 * Die Bauteile in der Reihenfolge, in der sie gezeichnet werden. Der Galgen
 * gehört bewusst dazu: so passiert auch beim ersten Fehlversuch schon etwas
 * auf dem Bild, statt dass die ersten Striche gratis wären.
 */
export const PARTS = [
  'ground',
  'post',
  'beam',
  'brace',
  'rope',
  'head',
  'body',
  'armLeft',
  'armRight',
  'legLeft',
  'legRight',
] as const;

export type Part = (typeof PARTS)[number];

/** So oft darf danebengegriffen werden – beim letzten Mal hängt er. */
export const MAX_WRONG = PARTS.length;

export type Outcome = 'running' | 'won' | 'lost';

/** Stellen im Wort, an denen dieser Buchstabe steht. */
export function positionsOf(word: string, letter: string): number[] {
  const spots: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] === letter) spots.push(i);
  }
  return spots;
}

export function wrongCount(word: string, guessed: string[]): number {
  return guessed.filter((letter) => !word.includes(letter)).length;
}

/** Alle Buchstaben des Wortes geraten? */
export function isSolved(word: string, guessed: string[]): boolean {
  return word.length > 0 && [...word].every((letter) => guessed.includes(letter));
}

export function outcome(word: string, guessed: string[], surrendered: boolean): Outcome {
  if (!word) return 'running';
  if (isSolved(word, guessed)) return 'won';
  if (surrendered || wrongCount(word, guessed) >= MAX_WRONG) return 'lost';
  return 'running';
}

/**
 * Welche Bauteile sind zu sehen? Beim Aufgeben hängt er komplett – sonst
 * stünde nach dem Aufgeben ein halber Galgen neben dem gelösten Wort.
 */
export function drawnParts(word: string, guessed: string[], surrendered: boolean): Part[] {
  if (surrendered) return [...PARTS];
  return PARTS.slice(0, Math.min(wrongCount(word, guessed), MAX_WRONG));
}
