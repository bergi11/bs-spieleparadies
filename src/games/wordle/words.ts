import solutions from './solutions.json';
import valid from './valid.json';

/**
 * Wortlisten aus dem MIT-lizenzierten Projekt wordle-de
 * (https://github.com/wordle-de/wordle-de.github.io), ergänzt um weitere
 * zulässige Rateworte aus der Wortliste von davidak.
 *
 * `SOLUTIONS` ist die kuratierte Reihenfolge der Tageswörter und enthält
 * bewusst keine Umlaute und kein ß – deshalb kommt die Tastatur mit A–Z aus.
 * `VALID` ist die deutlich größere Liste erlaubter Eingaben.
 */
export const SOLUTIONS: string[] = solutions;

const VALID = new Set<string>(valid);

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** Tag 0 des Rätsels. Ab hier läuft die Liste der Tageswörter durch. */
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidGuess(word: string): boolean {
  return VALID.has(word.toUpperCase());
}

/** Fortlaufende Rätselnummer für ein Datum – lokale Zeit, nicht UTC. */
export function puzzleNumber(date = new Date()): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / DAY_MS);
}

export function solutionFor(puzzle: number): string {
  // Modulo läuft nach ~2,8 Jahren einmal um; negative Tage (vor EPOCH)
  // werden dabei ebenfalls sauber abgebildet.
  const index = ((puzzle % SOLUTIONS.length) + SOLUTIONS.length) % SOLUTIONS.length;
  return SOLUTIONS[index];
}
