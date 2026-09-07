/**
 * Regelkern von "Schnittpunkte".
 *
 * Ein Rätsel ist ein 4x4-Gitter: die Zeilen sind Kategorien ("Tiere"), die
 * Spalten Eigenschaften der Schreibweise ("beginnt mit S"). In jedes Feld
 * gehört ein selbst ausgedachtes Wort, das beides erfüllt.
 *
 * Geprüft wird gegen die Wortlisten aus `daten.json`. Die Regeln stehen dort
 * als Daten; `erfuellt` wertet sie aus. Dieselbe Auswertung gibt es im
 * Erzeugerskript – `npm run check:intersections` hält beide zusammen.
 */

export type Regel =
  | { art: 'anfang'; wert: string }
  | { art: 'ende'; wert: string }
  | { art: 'laenge'; wert: number }
  | { art: 'folge'; wert: string }
  | { art: 'doppel' }
  | { art: 'umlaut' }
  | { art: 'ohne-e' }
  | { art: 'rahmen' }
  | { art: 'versteckt'; wert: string[] };

export interface Kategorie {
  id: string;
  label: string;
  woerter: string[];
}

export interface Eigenschaft {
  id: string;
  label: string;
  regel: Regel;
}

export interface Raetsel {
  id: number;
  /** Vier Kategorie-Kennungen, von oben nach unten. */
  zeilen: string[];
  /** Vier Eigenschafts-Kennungen, von links nach rechts. */
  spalten: string[];
  /** Eine gültige Lösung – für Tipp und Auflösung, nicht als einzige Wahrheit. */
  loesung: string[];
}

export interface Daten {
  kategorien: Kategorie[];
  eigenschaften: Eigenschaft[];
  raetsel: Raetsel[];
}

export const SEITE = 4;
export const FELDER = SEITE * SEITE;
/** So viele Felder darf man sich pro Rätsel verraten lassen. */
export const TIPPS = 3;

export function erfuellt(regel: Regel, wort: string): boolean {
  switch (regel.art) {
    case 'anfang':
      return wort.startsWith(regel.wert);
    case 'ende':
      return wort.endsWith(regel.wert);
    case 'laenge':
      return wort.length === regel.wert;
    case 'folge':
      return wort.includes(regel.wert);
    case 'doppel':
      return /(.)\1/.test(wort);
    case 'umlaut':
      return /[ÄÖÜ]/.test(wort);
    case 'ohne-e':
      return !wort.includes('E');
    case 'rahmen':
      return wort[0] === wort[wort.length - 1];
    case 'versteckt':
      return regel.wert.some((teil) => wort.includes(teil));
    default:
      return false;
  }
}

/**
 * Vergleichsform einer Eingabe. Umlaute werden aufgelöst, damit "MOEWE" auch
 * ohne Umlauttaste durchgeht; gespeichert wird trotzdem die Schreibweise aus
 * der Liste, denn an ihr hängen die Regeln.
 */
export function normalisiere(text: string): string {
  return text
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS')
    .replace(/[^A-Z]/g, '');
}

/** Nachschlagewerk über alle Kategorien: Vergleichsform → Wort und Herkunft. */
export function baueIndex(kategorien: Kategorie[]): Map<string, { wort: string; kategorie: string }> {
  const index = new Map<string, { wort: string; kategorie: string }>();
  for (const kategorie of kategorien) {
    for (const wort of kategorie.woerter) {
      index.set(normalisiere(wort), { wort, kategorie: kategorie.id });
    }
  }
  return index;
}

export type Urteil =
  | { art: 'ok'; wort: string }
  | { art: 'leer' }
  | { art: 'unbekannt' }
  | { art: 'doppelt'; wort: string }
  | { art: 'andere-kategorie'; wort: string; kategorie: Kategorie }
  | { art: 'passt-nicht'; wort: string };

/**
 * Beurteilt eine Eingabe für ein Feld. Die Reihenfolge der Prüfungen ist die
 * Reihenfolge, in der eine Rückmeldung nützlich ist: erst überhaupt bekannt,
 * dann schon benutzt, dann Zeile, dann Spalte.
 */
export function pruefeEingabe(
  eingabe: string,
  zeile: Kategorie,
  spalte: Eigenschaft,
  index: Map<string, { wort: string; kategorie: string }>,
  kategorien: Kategorie[],
  benutzt: string[],
): Urteil {
  const gesucht = normalisiere(eingabe);
  if (!gesucht) return { art: 'leer' };

  const treffer = index.get(gesucht);
  if (!treffer) return { art: 'unbekannt' };

  if (benutzt.includes(treffer.wort)) return { art: 'doppelt', wort: treffer.wort };

  if (treffer.kategorie !== zeile.id) {
    const kategorie = kategorien.find((k) => k.id === treffer.kategorie);
    // Ohne passende Kategorie in den Daten wäre der Hinweis irreführend.
    if (!kategorie) return { art: 'unbekannt' };
    return { art: 'andere-kategorie', wort: treffer.wort, kategorie };
  }

  if (!erfuellt(spalte.regel, treffer.wort)) return { art: 'passt-nicht', wort: treffer.wort };

  return { art: 'ok', wort: treffer.wort };
}

/** Text zum Urteil – steht so im Eingabeblatt. */
export function rueckmeldung(urteil: Urteil, spalte: Eigenschaft): string {
  switch (urteil.art) {
    case 'leer':
      return 'Da steht noch nichts.';
    case 'unbekannt':
      return 'Das Wort kenne ich nicht.';
    case 'doppelt':
      return `${urteil.wort} steht schon im Gitter.`;
    case 'andere-kategorie':
      return `${urteil.wort} führe ich unter „${urteil.kategorie.label}".`;
    case 'passt-nicht':
      return `${urteil.wort} passt nicht zu „${spalte.label}".`;
    default:
      return '';
  }
}

export const zeileVon = (feld: number): number => Math.floor(feld / SEITE);
export const spalteVon = (feld: number): number => feld % SEITE;

export const leereEingaben = (): string[] => Array<string>(FELDER).fill('');
export const leereTipps = (): boolean[] => Array<boolean>(FELDER).fill(false);

export const gefuellt = (eingaben: string[]): number =>
  eingaben.filter((wort) => wort.length > 0).length;

export type Stand = 'laeuft' | 'gewonnen' | 'aufgegeben';

export function stand(eingaben: string[], aufgegeben: boolean): Stand {
  if (aufgegeben) return 'aufgegeben';
  return gefuellt(eingaben) === FELDER ? 'gewonnen' : 'laeuft';
}

/**
 * Ein passendes Wort für ein Feld – für Tipp und Auflösung. Zuerst das aus den
 * Daten; steht es schon im Gitter, sucht die Liste ein anderes. Die mitgelieferte
 * Lösung ist eben nur eine von vielen.
 */
export function wortFuer(
  kategorie: Kategorie,
  eigenschaft: Eigenschaft,
  vorschlag: string,
  benutzt: string[],
): string | null {
  if (vorschlag && !benutzt.includes(vorschlag)) return vorschlag;
  return (
    kategorie.woerter.find(
      (wort) => erfuellt(eigenschaft.regel, wort) && !benutzt.includes(wort),
    ) ?? null
  );
}
