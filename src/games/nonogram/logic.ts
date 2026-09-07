/**
 * Regelkern von "Bildgitter" (Nonogramm).
 *
 * Ein Rätsel ist ein n×n-Gitter, in dem ein Bild versteckt ist. Vor jeder Zeile
 * und über jeder Spalte stehen die Längen der zusammenhängenden Blöcke, in
 * ihrer Reihenfolge und mit mindestens einer Lücke dazwischen.
 *
 * Der Solver hier arbeitet zeilenweise: Für eine Reihe zählt er alle Muster
 * auf, die zu ihren Zahlen passen und dem widersprechen, was schon feststeht.
 * Was in allen übrig gebliebenen Mustern gleich ist, steht damit fest. Mehr
 * kann er nicht – und mehr soll er nicht, denn genau so geht ein Mensch vor.
 *
 * `scripts/build-nonograms.mjs` prüft damit jedes Bild und legt für die harten
 * Fälle so viele Startfelder offen, bis es ohne Raten aufgeht.
 * `npm run check:nonograms` lässt denselben Solver über die fertige Datei
 * laufen.
 */

export interface Bild {
  id: number;
  /** Steht erst nach dem Lösen da – vorher wäre es die halbe Antwort. */
  name: string;
  /** Kantenlänge des Gitters. */
  n: number;
  /** Zeilenweise, Zeichen für Zeichen: '1' gefüllt, '0' leer. */
  zellen: string;
  /** Felder, die von Anfang an aufgedeckt sind, damit es ohne Raten aufgeht. */
  starthilfe: number[];
}

export interface Daten {
  bilder: Bild[];
}

/** So viele Felder darf man sich pro Bild verraten lassen. */
export const TIPPS = 3;

/** Ein Feld im Gitter: leer, gefüllt oder als leer abgehakt. */
export const LEER = 0;
export const VOLL = 1;
export const STRICH = 2;
export type Feldstand = typeof LEER | typeof VOLL | typeof STRICH;

export const istVoll = (bild: Bild, feld: number): boolean => bild.zellen[feld] === '1';

/** Die Blocklängen einer Reihe – genau das, was am Rand steht. */
export function blockLaengen(reihe: boolean[]): number[] {
  const laengen: number[] = [];
  let lauf = 0;
  for (const gefuellt of reihe) {
    if (gefuellt) lauf++;
    else if (lauf > 0) {
      laengen.push(lauf);
      lauf = 0;
    }
  }
  if (lauf > 0) laengen.push(lauf);
  // Eine leere Reihe trägt die 0, sonst stünde am Rand gar nichts.
  return laengen.length > 0 ? laengen : [0];
}

export interface Hinweise {
  zeilen: number[][];
  spalten: number[][];
}

export function hinweise(bild: Bild): Hinweise {
  const { n } = bild;
  const voll = (r: number, c: number) => bild.zellen[r * n + c] === '1';

  return {
    zeilen: Array.from({ length: n }, (_, r) =>
      blockLaengen(Array.from({ length: n }, (_, c) => voll(r, c))),
    ),
    spalten: Array.from({ length: n }, (_, c) =>
      blockLaengen(Array.from({ length: n }, (_, r) => voll(r, c))),
    ),
  };
}

/**
 * Alle Muster einer Reihe, die zu ihren Zahlen passen. Für die hier
 * verwendeten Gitter bis 10 Feldern sind das nie mehr als ein paar Dutzend.
 */
export function muster(zahlen: number[], laenge: number): boolean[][] {
  const bloecke = zahlen.filter((zahl) => zahl > 0);
  const alle: boolean[][] = [];

  const legen = (rest: number[], ab: number, bisher: boolean[]) => {
    if (rest.length === 0) {
      alle.push([...bisher, ...Array<boolean>(laenge - bisher.length).fill(false)]);
      return;
    }

    const [block, ...weitere] = rest;
    // Was die restlichen Blöcke samt Lücken noch brauchen.
    const platz = weitere.reduce((summe, zahl) => summe + zahl + 1, 0);

    for (let start = ab; start + block + platz <= laenge; start++) {
      const zeile = [...bisher];
      while (zeile.length < start) zeile.push(false);
      for (let i = 0; i < block; i++) zeile.push(true);
      if (weitere.length > 0) zeile.push(false);
      legen(weitere, zeile.length, zeile);
    }
  };

  legen(bloecke, 0, []);
  return alle;
}

/** -1 unbekannt, 0 sicher leer, 1 sicher gefüllt. */
type Wissen = -1 | 0 | 1;

export type Loesungsstand =
  | { art: 'geloest'; runden: number }
  /** Zeilenlogik allein reicht nicht – hier müsste man probieren. */
  | { art: 'offen'; unklar: number[] };

/**
 * Löst ein Bild allein mit Zeilenlogik. `vorgabe` sind Felder, die von Anfang
 * an offenliegen.
 */
export function loese(bild: Bild, vorgabe: number[] = bild.starthilfe): Loesungsstand {
  const { n } = bild;
  const zahlen = hinweise(bild);

  const wissen: Wissen[] = Array<Wissen>(n * n).fill(-1);
  for (const feld of vorgabe) wissen[feld] = istVoll(bild, feld) ? 1 : 0;

  // Für jede Reihe einmal alle Muster aufzählen und dann nur noch aussieben.
  const zeilenMuster = zahlen.zeilen.map((z) => muster(z, n));
  const spaltenMuster = zahlen.spalten.map((z) => muster(z, n));

  const felderVon = (art: 'zeile' | 'spalte', i: number) =>
    Array.from({ length: n }, (_, k) => (art === 'zeile' ? i * n + k : k * n + i));

  let runden = 0;
  for (;;) {
    let geaendert = false;
    runden++;

    for (const art of ['zeile', 'spalte'] as const) {
      const alle = art === 'zeile' ? zeilenMuster : spaltenMuster;

      for (let i = 0; i < n; i++) {
        const felder = felderVon(art, i);
        const passend = alle[i].filter((kandidat) =>
          kandidat.every((gefuellt, k) => {
            const bekannt = wissen[felder[k]];
            return bekannt === -1 || bekannt === (gefuellt ? 1 : 0);
          }),
        );
        alle[i] = passend;

        for (let k = 0; k < n; k++) {
          if (wissen[felder[k]] !== -1) continue;
          const erstes = passend[0]?.[k];
          if (erstes === undefined) continue;
          if (passend.every((kandidat) => kandidat[k] === erstes)) {
            wissen[felder[k]] = erstes ? 1 : 0;
            geaendert = true;
          }
        }
      }
    }

    if (!geaendert) break;
  }

  const unklar = wissen
    .map((wert, feld) => (wert === -1 ? feld : -1))
    .filter((feld) => feld >= 0);

  return unklar.length === 0 ? { art: 'geloest', runden } : { art: 'offen', unklar };
}

/* ------------------------------------------------------------------ *
 * Was das Spiel beim Spielen braucht                                  *
 * ------------------------------------------------------------------ */

export const leeresGitter = (n: number): Feldstand[] => Array<Feldstand>(n * n).fill(LEER);

export const zeileVon = (feld: number, n: number): number => Math.floor(feld / n);
export const spalteVon = (feld: number, n: number): number => feld % n;

/**
 * Ist eine Reihe fertig? Gemeint ist: Die gefüllten Felder ergeben genau die
 * Zahlen am Rand. Striche zählen nicht mit – wer sie weglässt, spielt trotzdem
 * richtig.
 */
export function reiheStimmt(
  zahlen: number[],
  gitter: Feldstand[],
  n: number,
  art: 'zeile' | 'spalte',
  i: number,
): boolean {
  const reihe = Array.from(
    { length: n },
    (_, k) => gitter[art === 'zeile' ? i * n + k : k * n + i] === VOLL,
  );
  const laengen = blockLaengen(reihe);
  return laengen.length === zahlen.length && laengen.every((wert, k) => wert === zahlen[k]);
}

/** Gelöst ist das Bild, wenn genau die richtigen Felder gefüllt sind. */
export function stimmt(bild: Bild, gitter: Feldstand[]): boolean {
  if (gitter.length !== bild.n * bild.n) return false;
  return gitter.every((feld, i) => (feld === VOLL) === istVoll(bild, i));
}

export const gefuellt = (gitter: Feldstand[]): number =>
  gitter.filter((feld) => feld === VOLL).length;

export type Stand = 'laeuft' | 'gewonnen' | 'aufgegeben';

export function stand(bild: Bild, gitter: Feldstand[], aufgegeben: boolean): Stand {
  if (aufgegeben) return 'aufgegeben';
  return stimmt(bild, gitter) ? 'gewonnen' : 'laeuft';
}
