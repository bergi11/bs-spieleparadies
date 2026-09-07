/**
 * Regelkern von "Brücken" (Hashiwokakero).
 *
 * Auf einem Gitter liegen Inseln mit Zahlen. Zwischen zwei Inseln dürfen
 * waagerecht oder senkrecht bis zu zwei Brücken laufen. Sie kreuzen einander
 * nicht und führen nicht über eine Insel hinweg. Die Zahl auf einer Insel sagt,
 * wie viele Brücken dort ankommen – und am Ende muss alles ein einziges Netz
 * sein, ohne abgehängte Inselgruppe.
 *
 * Der Solver hier rechnet nur mit Ober- und Untergrenzen je Verbindung: Wenn
 * eine Insel drei Brücken braucht und ihre übrigen Nachbarn zusammen höchstens
 * zwei hergeben, muss mindestens eine hierhin. Mehr macht er nicht – kein
 * Durchprobieren. Was er löst, löst auch ein Mensch ohne Raten.
 *
 * `scripts/build-bridges.mjs` nimmt nur Rätsel auf, die dieser Solver knackt;
 * `npm run check:bridges` lässt ihn über die fertige Datei laufen.
 */

export interface Insel {
  /** Zeile im Gitter, von oben. */
  r: number;
  /** Spalte im Gitter, von links. */
  c: number;
  /** Wie viele Brücken hier ankommen müssen. */
  grad: number;
}

export interface Raetsel {
  id: number;
  /** Kantenlänge des Gitters. */
  n: number;
  inseln: Insel[];
  /** Die Lösung: je Verbindung die Anzahl Brücken, in der Reihenfolge von `kanten`. */
  loesung: number[];
}

export interface Daten {
  raetsel: Raetsel[];
}

/** So viele Verbindungen darf man sich pro Rätsel verraten lassen. */
export const TIPPS = 3;

/** Eine mögliche Verbindung zwischen zwei Inseln. */
export interface Kante {
  /** Index der ersten Insel; immer die obere beziehungsweise linke. */
  a: number;
  /** Index der zweiten Insel. */
  b: number;
  waagerecht: boolean;
}

/**
 * Alle Paare, zwischen denen überhaupt eine Brücke laufen könnte: gleiche Zeile
 * oder gleiche Spalte, keine Insel dazwischen. Die Reihenfolge ist fest, damit
 * ein gespeicherter Stand später zu denselben Verbindungen passt.
 */
export function kanten(raetsel: Raetsel): Kante[] {
  const { inseln } = raetsel;
  const liste: Kante[] = [];

  const dazwischen = (a: Insel, b: Insel, waagerecht: boolean) =>
    inseln.some((insel) =>
      waagerecht
        ? insel.r === a.r && insel.c > Math.min(a.c, b.c) && insel.c < Math.max(a.c, b.c)
        : insel.c === a.c && insel.r > Math.min(a.r, b.r) && insel.r < Math.max(a.r, b.r),
    );

  for (let a = 0; a < inseln.length; a++) {
    for (let b = a + 1; b < inseln.length; b++) {
      const eins = inseln[a];
      const zwei = inseln[b];

      if (eins.r === zwei.r && !dazwischen(eins, zwei, true)) {
        liste.push({ a, b, waagerecht: true });
      } else if (eins.c === zwei.c && !dazwischen(eins, zwei, false)) {
        liste.push({ a, b, waagerecht: false });
      }
    }
  }

  return liste;
}

/** Die Verbindungen, die an einer Insel hängen. */
export function kantenAn(alle: Kante[], insel: number): number[] {
  return alle
    .map((kante, i) => (kante.a === insel || kante.b === insel ? i : -1))
    .filter((i) => i >= 0);
}

/** Kreuzen sich zwei Verbindungen? Nur eine waagerechte und eine senkrechte können das. */
export function kreuzen(raetsel: Raetsel, eins: Kante, zwei: Kante): boolean {
  if (eins.waagerecht === zwei.waagerecht) return false;

  const quer = eins.waagerecht ? eins : zwei;
  const hoch = eins.waagerecht ? zwei : eins;

  const { inseln } = raetsel;
  const zeile = inseln[quer.a].r;
  const spalte = inseln[hoch.a].c;

  const links = Math.min(inseln[quer.a].c, inseln[quer.b].c);
  const rechts = Math.max(inseln[quer.a].c, inseln[quer.b].c);
  const oben = Math.min(inseln[hoch.a].r, inseln[hoch.b].r);
  const unten = Math.max(inseln[hoch.a].r, inseln[hoch.b].r);

  return spalte > links && spalte < rechts && zeile > oben && zeile < unten;
}

/** Für jede Verbindung die Liste der Verbindungen, die ihr im Weg liegen. */
export function kreuzungen(raetsel: Raetsel, alle: Kante[]): number[][] {
  return alle.map((eins, i) =>
    alle.map((zwei, k) => (k !== i && kreuzen(raetsel, eins, zwei) ? k : -1)).filter((k) => k >= 0),
  );
}

export type Loesungsstand =
  /** Eindeutig und ohne Raten lösbar. `runden` sagt, wie zäh es war. */
  | { art: 'geloest'; werte: number[]; runden: number }
  /** Grenzen allein reichen nicht – hier müsste man probieren. */
  | { art: 'offen' }
  /** Die Zahlen widersprechen sich, es gibt keine Lösung. */
  | { art: 'leer' };

/**
 * Löst ein Rätsel, indem es für jede Verbindung eine Ober- und eine
 * Untergrenze führt und beide so lange zusammenschiebt, bis sich nichts mehr
 * bewegt.
 */
export function loese(raetsel: Raetsel): Loesungsstand {
  const alle = kanten(raetsel);
  const imWeg = kreuzungen(raetsel, alle);
  const anInsel = raetsel.inseln.map((_, i) => kantenAn(alle, i));

  const unten = alle.map(() => 0);
  const oben = alle.map(() => 2);

  let runden = 0;
  for (;;) {
    let geaendert = false;
    runden++;

    for (let insel = 0; insel < raetsel.inseln.length; insel++) {
      const grad = raetsel.inseln[insel].grad;
      const meine = anInsel[insel];

      const summeUnten = meine.reduce((summe, k) => summe + unten[k], 0);
      const summeOben = meine.reduce((summe, k) => summe + oben[k], 0);
      if (summeUnten > grad || summeOben < grad) return { art: 'leer' };

      for (const k of meine) {
        // Was die übrigen Verbindungen dieser Insel höchstens tragen, muss
        // diese hier ausgleichen.
        const neuUnten = Math.max(unten[k], grad - (summeOben - oben[k]));
        const neuOben = Math.min(oben[k], grad - (summeUnten - unten[k]));
        if (neuUnten > neuOben) return { art: 'leer' };
        if (neuUnten !== unten[k] || neuOben !== oben[k]) {
          unten[k] = neuUnten;
          oben[k] = neuOben;
          geaendert = true;
        }
      }
    }

    for (let k = 0; k < alle.length; k++) {
      if (unten[k] === 0) continue;
      // Steht hier sicher eine Brücke, ist jede kreuzende Verbindung erledigt.
      for (const quer of imWeg[k]) {
        if (oben[quer] === 0) continue;
        if (unten[quer] > 0) return { art: 'leer' };
        oben[quer] = 0;
        geaendert = true;
      }
    }

    if (!geaendert) break;
  }

  if (alle.some((_, k) => unten[k] !== oben[k])) return { art: 'offen' };

  const werte = [...unten];
  return zusammenhaengend(raetsel, alle, werte)
    ? { art: 'geloest', werte, runden }
    : { art: 'leer' };
}

/** Hängen alle Inseln über Brücken zusammen? */
export function zusammenhaengend(raetsel: Raetsel, alle: Kante[], werte: number[]): boolean {
  const anzahl = raetsel.inseln.length;
  if (anzahl === 0) return true;

  const vater = Array.from({ length: anzahl }, (_, i) => i);
  const suche = (i: number): number => (vater[i] === i ? i : (vater[i] = suche(vater[i])));

  for (const [k, kante] of alle.entries()) {
    if (werte[k] > 0) vater[suche(kante.a)] = suche(kante.b);
  }

  const erste = suche(0);
  return raetsel.inseln.every((_, i) => suche(i) === erste);
}

/* ------------------------------------------------------------------ *
 * Was das Spiel beim Spielen braucht                                  *
 * ------------------------------------------------------------------ */

export const leereWerte = (anzahl: number): number[] => Array<number>(anzahl).fill(0);

/** Wie viele Brücken an einer Insel schon liegen. */
export function gradVon(alle: Kante[], werte: number[], insel: number): number {
  return alle.reduce(
    (summe, kante, k) => summe + (kante.a === insel || kante.b === insel ? werte[k] : 0),
    0,
  );
}

/**
 * Darf hier noch eine Brücke dazu? Zu viele an einer Insel sind erlaubt – man
 * sieht es an der Insel und kann es zurücknehmen. Eine Kreuzung ist dagegen
 * gar kein gültiger Zug und wird abgelehnt.
 */
export function frei(imWeg: number[][], werte: number[], kante: number): boolean {
  return imWeg[kante].every((quer) => werte[quer] === 0);
}

/** Der nächste Stand beim Antippen: keine, eine, zwei, wieder keine. */
export const naechsterWert = (wert: number): number => (wert + 1) % 3;

export type Stand = 'laeuft' | 'gewonnen' | 'aufgegeben';

export function stand(
  raetsel: Raetsel,
  alle: Kante[],
  werte: number[],
  aufgegeben: boolean,
): Stand {
  if (aufgegeben) return 'aufgegeben';

  const gradeStimmen = raetsel.inseln.every(
    (insel, i) => gradVon(alle, werte, i) === insel.grad,
  );
  if (!gradeStimmen) return 'laeuft';

  return zusammenhaengend(raetsel, alle, werte) ? 'gewonnen' : 'laeuft';
}
