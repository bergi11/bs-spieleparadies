/**
 * Regelkern von "Wolkenkratzer".
 *
 * Ein Rätsel ist ein n×n-Gitter. In jede Zeile und jede Spalte kommt jede Höhe
 * von 1 bis n genau einmal. Am Rand steht, wie viele Häuser man von dort aus
 * sieht: ein Haus ist sichtbar, wenn kein höheres davorsteht.
 *
 * Der Solver hier arbeitet nur mit Ausschluss – er probiert nichts durch und
 * rät nicht. Was er löst, kann ein Mensch auch ohne Raten lösen. Das Skript
 * `scripts/build-skyscrapers.mjs` nimmt nur Rätsel auf, die genau dieser Solver
 * knackt; `npm run check:skyscrapers` prüft das noch einmal gegen die fertige
 * Datei.
 */

export interface Raetsel {
  id: number;
  /** Kantenlänge des Gitters. */
  n: number;
  /** Hinweise über den Spalten, von links nach rechts. 0 heißt: kein Hinweis. */
  oben: number[];
  /** Hinweise unter den Spalten, von links nach rechts. */
  unten: number[];
  /** Hinweise links der Zeilen, von oben nach unten. */
  links: number[];
  /** Hinweise rechts der Zeilen, von oben nach unten. */
  rechts: number[];
  /** Die Lösung, zeilenweise. */
  loesung: number[];
}

export interface Daten {
  raetsel: Raetsel[];
}

/** So viele Felder darf man sich pro Rätsel verraten lassen. */
export const TIPPS = 3;

/** Wie viele Häuser man von vorne sieht. */
export function sichtbar(reihe: number[]): number {
  let hoechstes = 0;
  let anzahl = 0;
  for (const haus of reihe) {
    if (haus > hoechstes) {
      hoechstes = haus;
      anzahl++;
    }
  }
  return anzahl;
}

const PERM_CACHE = new Map<number, number[][]>();

/** Alle Anordnungen der Höhen 1..n. Für n bis 6 sind das höchstens 720. */
export function permutationen(n: number): number[][] {
  const gemerkt = PERM_CACHE.get(n);
  if (gemerkt) return gemerkt;

  const alle: number[][] = [];
  const bauen = (rest: number[], bisher: number[]) => {
    if (rest.length === 0) {
      alle.push(bisher);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      bauen([...rest.slice(0, i), ...rest.slice(i + 1)], [...bisher, rest[i]]);
    }
  };
  bauen(
    Array.from({ length: n }, (_, i) => i + 1),
    [],
  );

  PERM_CACHE.set(n, alle);
  return alle;
}

/** Passt eine Anordnung zu den Hinweisen an ihren beiden Enden? */
export function passtZuHinweisen(reihe: number[], vorne: number, hinten: number): boolean {
  if (vorne > 0 && sichtbar(reihe) !== vorne) return false;
  if (hinten > 0 && sichtbar([...reihe].reverse()) !== hinten) return false;
  return true;
}

export type Loesungsstand =
  /** Eindeutig und ohne Raten lösbar. `runden` sagt, wie zäh es war. */
  | { art: 'geloest'; gitter: number[]; runden: number }
  /** Ausschluss allein reicht nicht – hier müsste man probieren. */
  | { art: 'offen' }
  /** Die Hinweise widersprechen sich, es gibt keine Lösung. */
  | { art: 'leer' };

const bitVon = (wert: number) => 1 << (wert - 1);

/** Welche Höhen eine Kandidatenliste an Position i überhaupt noch zulässt. */
function masken(kandidaten: number[][], n: number): number[] {
  const maske = Array<number>(n).fill(0);
  for (const anordnung of kandidaten) {
    for (let i = 0; i < n; i++) maske[i] |= bitVon(anordnung[i]);
  }
  return maske;
}

/**
 * Löst ein Rätsel durch Ausschluss: für jede Zeile und jede Spalte stehen
 * anfangs alle Anordnungen zur Auswahl, die zu ihren Hinweisen passen. Was eine
 * Zeile für ein Feld ausschließt, fällt auch für die Spalte weg – und umgekehrt,
 * bis sich nichts mehr bewegt.
 */
export function loese(raetsel: Raetsel): Loesungsstand {
  const { n } = raetsel;
  const alle = permutationen(n);

  let zeilen = Array.from({ length: n }, (_, r) =>
    alle.filter((p) => passtZuHinweisen(p, raetsel.links[r], raetsel.rechts[r])),
  );
  let spalten = Array.from({ length: n }, (_, c) =>
    alle.filter((p) => passtZuHinweisen(p, raetsel.oben[c], raetsel.unten[c])),
  );

  const summe = () =>
    zeilen.reduce((a, k) => a + k.length, 0) + spalten.reduce((a, k) => a + k.length, 0);

  let runden = 0;
  for (;;) {
    const vorher = summe();

    // spaltenMaske[c][r]: was Spalte c für Zeile r noch zulässt.
    const spaltenMaske = spalten.map((kandidaten) => masken(kandidaten, n));
    zeilen = zeilen.map((kandidaten, r) =>
      kandidaten.filter((p) => p.every((wert, c) => (spaltenMaske[c][r] & bitVon(wert)) !== 0)),
    );
    if (zeilen.some((k) => k.length === 0)) return { art: 'leer' };

    const zeilenMaske = zeilen.map((kandidaten) => masken(kandidaten, n));
    spalten = spalten.map((kandidaten, c) =>
      kandidaten.filter((p) => p.every((wert, r) => (zeilenMaske[r][c] & bitVon(wert)) !== 0)),
    );
    if (spalten.some((k) => k.length === 0)) return { art: 'leer' };

    runden++;
    if (summe() === vorher) break;
  }

  if (zeilen.some((k) => k.length > 1)) return { art: 'offen' };
  return { art: 'geloest', gitter: zeilen.flatMap((k) => k[0]), runden };
}

/* ------------------------------------------------------------------ *
 * Was das Spiel beim Spielen braucht                                  *
 * ------------------------------------------------------------------ */

export const leeresGitter = (n: number): number[] => Array<number>(n * n).fill(0);
export const leereNotizen = (n: number): number[] => Array<number>(n * n).fill(0);
export const leereMarken = (n: number): boolean[] => Array<boolean>(n * n).fill(false);

export const zeileVon = (feld: number, n: number): number => Math.floor(feld / n);
export const spalteVon = (feld: number, n: number): number => feld % n;

export const notizGesetzt = (maske: number, wert: number): boolean => (maske & bitVon(wert)) !== 0;
export const notizUmschalten = (maske: number, wert: number): number => maske ^ bitVon(wert);
export const notizLoeschen = (maske: number, wert: number): number => maske & ~bitVon(wert);

/** Die Höhen einer Zeile, von links nach rechts. */
export const zeile = (gitter: number[], n: number, r: number): number[] =>
  gitter.slice(r * n, r * n + n);

/** Die Höhen einer Spalte, von oben nach unten. */
export const spalte = (gitter: number[], n: number, c: number): number[] =>
  Array.from({ length: n }, (_, r) => gitter[r * n + c]);

/**
 * Felder, deren Höhe in ihrer Zeile oder Spalte ein zweites Mal vorkommt. Das
 * verrät nichts über die Lösung – es zeigt nur, was ohnehin schon dasteht.
 */
export function doppelte(gitter: number[], n: number): boolean[] {
  const treffer = Array<boolean>(n * n).fill(false);

  for (let i = 0; i < n; i++) {
    const linien = [
      Array.from({ length: n }, (_, k) => i * n + k),
      Array.from({ length: n }, (_, k) => k * n + i),
    ];

    for (const linie of linien) {
      const gesehen = new Map<number, number[]>();
      for (const feld of linie) {
        const wert = gitter[feld];
        if (!wert) continue;
        const liste = gesehen.get(wert) ?? [];
        liste.push(feld);
        gesehen.set(wert, liste);
      }
      for (const felder of gesehen.values()) {
        if (felder.length > 1) for (const feld of felder) treffer[feld] = true;
      }
    }
  }

  return treffer;
}

export interface HinweisFehler {
  oben: boolean[];
  unten: boolean[];
  links: boolean[];
  rechts: boolean[];
}

/**
 * Hinweise, die eine fertig gefüllte Reihe verletzt. Erst wenn die Reihe voll
 * ist – vorher wäre die Meldung nur Lärm, weil sich die Sicht mit jedem
 * weiteren Haus noch ändert.
 */
export function hinweisFehler(raetsel: Raetsel, gitter: number[]): HinweisFehler {
  const { n } = raetsel;
  const fehler: HinweisFehler = {
    oben: Array<boolean>(n).fill(false),
    unten: Array<boolean>(n).fill(false),
    links: Array<boolean>(n).fill(false),
    rechts: Array<boolean>(n).fill(false),
  };

  for (let i = 0; i < n; i++) {
    const reihe = zeile(gitter, n, i);
    if (reihe.every(Boolean)) {
      if (raetsel.links[i] > 0 && sichtbar(reihe) !== raetsel.links[i]) fehler.links[i] = true;
      if (raetsel.rechts[i] > 0 && sichtbar([...reihe].reverse()) !== raetsel.rechts[i]) {
        fehler.rechts[i] = true;
      }
    }

    const strang = spalte(gitter, n, i);
    if (strang.every(Boolean)) {
      if (raetsel.oben[i] > 0 && sichtbar(strang) !== raetsel.oben[i]) fehler.oben[i] = true;
      if (raetsel.unten[i] > 0 && sichtbar([...strang].reverse()) !== raetsel.unten[i]) {
        fehler.unten[i] = true;
      }
    }
  }

  return fehler;
}

export const gefuellt = (gitter: number[]): number => gitter.filter(Boolean).length;

export const stimmt = (raetsel: Raetsel, gitter: number[]): boolean =>
  gitter.length === raetsel.loesung.length &&
  gitter.every((wert, feld) => wert === raetsel.loesung[feld]);

export type Stand = 'laeuft' | 'gewonnen' | 'aufgegeben';

export function stand(raetsel: Raetsel, gitter: number[], aufgegeben: boolean): Stand {
  if (aufgegeben) return 'aufgegeben';
  return stimmt(raetsel, gitter) ? 'gewonnen' : 'laeuft';
}
