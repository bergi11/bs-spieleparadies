/**
 * Statische Daten des Spielblatts von Clever 4Ever.
 *
 * Ausgelesen aus dem vorgelegten PDF – Herkunft und Messverfahren stehen in
 * `docs/clever-4ever.md`. Hier stehen nur Zahlen und Formen, keine Regeln:
 * die liegen in `logic.ts`.
 */

/** Die fünf Farbbereiche des Blattes. */
export type Bereich = 'gelb' | 'blau' | 'grau' | 'gruen' | 'pink';

export const BEREICHE: Bereich[] = ['gelb', 'blau', 'grau', 'gruen', 'pink'];

export const BEREICH_NAME: Record<Bereich, string> = {
  gelb: 'Gelb',
  blau: 'Blau',
  grau: 'Grau',
  gruen: 'Grün',
  pink: 'Pink',
};

/**
 * Was ein Bonusfeld auslöst.
 * - `frage`: sofort einzulösender ?-Bonus in der genannten Farbe. `schwarz`
 *   heißt: Farbe frei wählbar.
 * - `weiss`: ein weißer Würfel, also freie Zahl in einem Bereich der Wahl.
 * - `neuwurf` / `extra` / `polieren`: schalten ein Feld der jeweiligen
 *   Aktionsleiste frei.
 */
export type Bonus =
  | { art: 'plus1' }
  | { art: 'frage'; farbe: Bereich | 'schwarz' }
  | { art: 'weiss' }
  | { art: 'neuwurf' }
  | { art: 'extra' }
  | { art: 'polieren' }
  | { art: 'fuchs' };

const f = (farbe: Bereich | 'schwarz'): Bonus => ({ art: 'frage', farbe });
const plus1: Bonus = { art: 'plus1' };
const weiss: Bonus = { art: 'weiss' };
const neuwurf: Bonus = { art: 'neuwurf' };
const fuchs: Bonus = { art: 'fuchs' };

// --------------------------------------------------------------------- Runden

export const RUNDEN = 6;

/** Boni zu Rundenbeginn. Ab Runde 5 gibt es keine mehr. */
export const RUNDEN_BONI: (Bonus | null)[] = [neuwurf, plus1, weiss, f('schwarz'), null, null];

// ----------------------------------------------------------------------- Gelb

/**
 * 3 Reihen à 5 Felder.
 * Reihe 0 muss aufsteigend gefüllt werden, Reihe 1 zählt negativ,
 * Reihe 2 positiv und hat keine Boni.
 */
export const GELB_SPALTEN = 5;
export const GELB_REIHEN = 3;

export const GELB_BONI: (Bonus | null)[][] = [
  [null, weiss, f('grau'), f('gruen'), fuchs],
  [neuwurf, f('pink'), f('blau'), plus1, f('gelb')],
  [null, null, null, null, null],
];

/** Punkte für eine vollständig gefüllte Spalte. */
export const GELB_SPALTENWERTE = [10, 10, 15, 15, 20];

// ----------------------------------------------------------------------- Blau

/** 6×6: blauer Würfel bestimmt die Zeile, weißer die Spalte. */
export const BLAU_BONI: (Bonus | null)[] = [
  f('gruen'),
  f('pink'),
  f('gelb'),
  plus1,
  f('grau'),
  null,
];

/** Punkte je Spalte, sobald darin mindestens 2 Kreuze stehen. */
export const BLAU_SPALTENWERTE = [7, 8, 9, 10, 11, 12];

/** Punkte für mindestens 2 Kreuze auf der Nebendiagonale (oben rechts → unten links). */
export const BLAU_NEBENDIAGONALE_PUNKTE = 6;

// ----------------------------------------------------------------------- Grau

export type GrauFarbe = 'W' | 'H' | 'D';

/**
 * 16 Spalten × 4 Zeilen. Zusammenhängende Felder gleicher Farbe bilden eine
 * Teilfläche; die Verbindungen berechnet `logic.ts` daraus.
 * W = weiß, H = hellgrau, D = dunkelgrau.
 */
export const GRAU_RASTER: GrauFarbe[][] = [
  ['W', 'W', 'W', 'H', 'H', 'H', 'H', 'W', 'W', 'H', 'H', 'D', 'H', 'H', 'D', 'D'],
  ['H', 'W', 'W', 'D', 'D', 'D', 'H', 'W', 'W', 'W', 'H', 'D', 'H', 'W', 'D', 'D'],
  ['H', 'H', 'W', 'H', 'H', 'D', 'W', 'D', 'D', 'H', 'H', 'W', 'H', 'W', 'W', 'D'],
  ['H', 'D', 'D', 'H', 'D', 'D', 'W', 'D', 'D', 'H', 'W', 'W', 'H', 'W', 'D', 'D'],
];

/** Bonusfelder als "zeile,spalte" (beide 0-basiert). */
export const GRAU_BONI: Record<string, Bonus> = {
  '0,0': weiss,
  '0,5': f('gruen'),
  '0,12': weiss,
  '1,7': neuwurf,
  '1,15': f('gruen'),
  '2,3': f('pink'),
  '2,5': weiss,
  '2,9': weiss,
  '2,13': f('blau'),
  '3,0': neuwurf,
  '3,7': plus1,
  '3,11': f('gelb'),
  '3,14': weiss,
};

/** Nur in diesen beiden Teilflächen darf begonnen werden (je ein Feld daraus). */
export const GRAU_START_FELDER: [number, number][] = [
  [0, 0],
  [3, 0],
];

export const GRAU_SPALTENWERTE = [1, 2, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11];

// ----------------------------------------------------------------------- Grün

/** 11 Felder mit je zwei Dreiecken. Boni hängen am unteren Dreieck. */
export const GRUEN_FELDER = 11;

export const GRUEN_BONI: (Bonus | null)[] = [
  neuwurf,
  f('blau'),
  weiss,
  f('gelb'),
  f('grau'),
  plus1,
  f('pink'),
  f('blau'),
  f('gelb'),
  fuchs,
  plus1,
];

/** Ab diesem Feld (0-basiert) zählt die Summe der beiden Dreiecke doppelt. */
export const GRUEN_VERDOPPELT_AB = 3;

// ----------------------------------------------------------------------- Pink

export const PINK_WERTE = [2, 4, 6, 9, 12, 15, 19, 23, 27, 32, 37, 42];

/** Bonus unter dem Feld – greift nur bei einer eingetragenen 5 oder 6. */
export const PINK_BONI: (Bonus | null)[] = [
  weiss,
  null,
  f('gruen'),
  plus1,
  neuwurf,
  null,
  f('grau'),
  fuchs,
  null,
  f('blau'),
  null,
  f('gelb'),
];

/** Zusatzpunkte für eingekreiste Zahlen am Ende. */
export const PINK_KREIS_PUNKTE: Record<number, number> = { 2: 2, 4: 4, 6: 3 };

// ------------------------------------------------------------- Aktionsleisten

export const AKTION_LAENGE = { neuwurf: 7, extra: 7, polieren: 9 } as const;

/** Bonus am Ende einer Leiste, sobald das letzte Feld freigeschaltet ist. */
export const AKTION_ENDBONUS: Record<keyof typeof AKTION_LAENGE, Bonus | null> = {
  neuwurf: f('pink'),
  extra: null,
  polieren: null,
};

// ------------------------------------------------------------------- Endtitel

export const TITEL: { ab: number; text: string }[] = [
  { ab: 450, text: 'Clever forever!' },
  { ab: 420, text: 'Nochmal! So schlau.' },
  { ab: 390, text: 'Hey, Einstein!' },
  { ab: 360, text: 'Deine Freunde beneiden dich.' },
  { ab: 330, text: 'Ganz schön clever!' },
  { ab: 300, text: 'Wunderkind in Ausbildung.' },
  { ab: 270, text: 'Es geht aufwärts.' },
  { ab: 240, text: 'Mann, keine Sorge!' },
  { ab: 210, text: 'Da ist noch Luft nach oben.' },
  { ab: 180, text: 'Die Würfel wollten wohl nicht.' },
  // Fängt auch negative Zwischenstände ab: die mittlere gelbe Reihe zählt
  // negativ, damit kann die Summe zeitweise unter null liegen.
  { ab: Number.NEGATIVE_INFINITY, text: 'Reden wir über etwas anderes…' },
];
