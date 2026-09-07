/**
 * Regelkern von "Kreuzchen" (Mini-Kreuzworträtsel, 5x5).
 *
 * Ein Rätsel ist ein 5x5-Gitter aus schwarzen und weißen Feldern. Zu jedem
 * Wort gehört ein Hinweis; die Nummer steht im ersten Feld und gilt für die
 * waagerechte und die senkrechte Frage gleichermaßen.
 *
 * Nicht jeder Buchstabe steht in zwei Wörtern – wie im Schwedenrätsel gibt es
 * Felder, die nur von einer Seite bestimmt sind. Warum das so ist, steht im
 * Kopf von `scripts/build-crossword.mjs`.
 */

export interface Frage {
  /** Nummer im Gitter; waagerecht und senkrecht teilen sie sich. */
  nr: number;
  waagerecht: boolean;
  /** Feld, in dem das Wort anfängt. */
  start: number;
  laenge: number;
  wort: string;
  hinweis: string;
}

export interface Raetsel {
  id: number;
  /** 25 Zeichen, zeilenweise. '#' ist ein schwarzes Feld. */
  gitter: string;
  fragen: Frage[];
}

export interface Daten {
  raetsel: Raetsel[];
}

export const SEITE = 5;
export const FELDER = SEITE * SEITE;

/** So viele Buchstaben darf man sich pro Rätsel verraten lassen. */
export const TIPPS = 3;

/** Leeres Feld im Spielstand. Der Punkt steht dort, wo noch nichts steht. */
export const LEER = '.';

export const istSchwarz = (raetsel: Raetsel, feld: number): boolean =>
  raetsel.gitter[feld] === '#';

export const zeileVon = (feld: number): number => Math.floor(feld / SEITE);
export const spalteVon = (feld: number): number => feld % SEITE;

/** Die Felder einer Frage, vom ersten Buchstaben an. */
export function felderVon(frage: Frage): number[] {
  return Array.from({ length: frage.laenge }, (_, i) =>
    frage.waagerecht ? frage.start + i : frage.start + i * SEITE,
  );
}

/** Die Nummern, die in den Ecken der Startfelder stehen. */
export function nummern(raetsel: Raetsel): Map<number, number> {
  return new Map(raetsel.fragen.map((frage) => [frage.start, frage.nr]));
}

/** Die Frage einer Richtung, die durch dieses Feld läuft – falls es eine gibt. */
export function frageAn(
  raetsel: Raetsel,
  feld: number,
  waagerecht: boolean,
): Frage | undefined {
  return raetsel.fragen.find(
    (frage) => frage.waagerecht === waagerecht && felderVon(frage).includes(feld),
  );
}

/**
 * Die Richtung, in der ein Feld überhaupt zu einer Frage gehört. Steht es in
 * beiden, gewinnt die gewünschte – sonst die, die es gibt.
 */
export function richtungFuer(
  raetsel: Raetsel,
  feld: number,
  wunsch: boolean,
): boolean | null {
  if (frageAn(raetsel, feld, wunsch)) return wunsch;
  if (frageAn(raetsel, feld, !wunsch)) return !wunsch;
  return null;
}

export const leereEingabe = (raetsel: Raetsel): string =>
  Array.from({ length: FELDER }, (_, feld) => (istSchwarz(raetsel, feld) ? '#' : LEER)).join('');

/** Setzt einen Buchstaben und lässt schwarze Felder in Ruhe. */
export function schreibe(eingabe: string, feld: number, zeichen: string): string {
  if (eingabe[feld] === '#') return eingabe;
  return eingabe.slice(0, feld) + zeichen + eingabe.slice(feld + 1);
}

/** Ist ein Wort vollständig und richtig eingetragen? */
export function wortStimmt(frage: Frage, eingabe: string): boolean {
  return felderVon(frage).every((feld, i) => eingabe[feld] === frage.wort[i]);
}

export const voll = (raetsel: Raetsel, eingabe: string): boolean =>
  eingabe.split('').every((zeichen, feld) => istSchwarz(raetsel, feld) || zeichen !== LEER);

export const stimmt = (raetsel: Raetsel, eingabe: string): boolean =>
  raetsel.fragen.every((frage) => wortStimmt(frage, eingabe));

/** Wie viele weiße Felder schon einen Buchstaben tragen. */
export function gefuellt(raetsel: Raetsel, eingabe: string): number {
  return eingabe
    .split('')
    .filter((zeichen, feld) => !istSchwarz(raetsel, feld) && zeichen !== LEER).length;
}

export type Stand = 'laeuft' | 'gewonnen' | 'aufgegeben';

export function stand(raetsel: Raetsel, eingabe: string, aufgegeben: boolean): Stand {
  if (aufgegeben) return 'aufgegeben';
  return stimmt(raetsel, eingabe) ? 'gewonnen' : 'laeuft';
}

/**
 * Das nächste Feld derselben Frage. `null`, wenn das Wort zu Ende ist – dann
 * bleibt die Auswahl stehen, statt irgendwohin zu springen.
 */
export function naechstesFeld(frage: Frage, feld: number): number | null {
  const felder = felderVon(frage);
  const platz = felder.indexOf(feld);
  return platz >= 0 && platz + 1 < felder.length ? felder[platz + 1] : null;
}

export function vorigesFeld(frage: Frage, feld: number): number | null {
  const felder = felderVon(frage);
  const platz = felder.indexOf(feld);
  return platz > 0 ? felder[platz - 1] : null;
}

/**
 * Das nächste noch leere Feld einer Frage – dorthin springt die Auswahl, wenn
 * man eine Frage anwählt. Ist alles gefüllt, an den Anfang.
 */
export function ersteLuecke(frage: Frage, eingabe: string): number {
  const felder = felderVon(frage);
  return felder.find((feld) => eingabe[feld] === LEER) ?? felder[0];
}

/** Die Fragen in der Reihenfolge, in der man sie durchblättert. */
export function reihenfolge(raetsel: Raetsel): Frage[] {
  return [...raetsel.fragen].sort(
    (a, b) => Number(b.waagerecht) - Number(a.waagerecht) || a.nr - b.nr,
  );
}
