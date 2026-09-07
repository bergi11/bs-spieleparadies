import words from './words.json';

/**
 * Geläufige deutsche Hauptwörter, fünf bis zwölf Buchstaben, erzeugt von
 * `npm run words:hangman`. Ohne Umlaute und ß, weil die Bildschirmtastatur
 * wie bei "Wörtchen" mit A–Z auskommt.
 */
export const WORDS: string[] = words;

/** Zieht ein Wort und meidet dabei das zuletzt gespielte. */
export function pickWord(previous?: string): string {
  for (let tries = 0; tries < 8; tries++) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (word !== previous) return word;
  }
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}
