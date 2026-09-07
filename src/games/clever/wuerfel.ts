import {
  blauErlaubt,
  gelbErlaubt,
  grauVerfuegbar,
  gruenErlaubt,
  pinkErlaubt,
  type Blatt,
  type Eintrag,
} from './logic';
import { RUNDEN, type Bereich } from './sheet';

/**
 * Würfel und Rundenablauf der Solo-Variante.
 *
 * Wie `logic.ts` bewusst ohne React. Der Zufall kommt von außen herein
 * (`Rng`), damit sich ganze Runden mit festen Würfelfolgen durchspielen und
 * prüfen lassen.
 */

export type WuerfelFarbe = Bereich | 'weiss';

export interface Wuerfel {
  farbe: WuerfelFarbe;
  wert: number;
}

/** Ein Satz: je ein Würfel pro Bereich, dazu der weiße Joker. */
export const WUERFEL_FARBEN: WuerfelFarbe[] = ['gelb', 'blau', 'grau', 'gruen', 'pink', 'weiss'];

export type Rng = () => number;

const wuerfelWert = (rng: Rng) => 1 + Math.floor(rng() * 6);

export const werfen = (farben: WuerfelFarbe[], rng: Rng): Wuerfel[] =>
  farben.map((farbe) => ({ farbe, wert: wuerfelWert(rng) }));

// ------------------------------------------------------------------ Zustand

export type Phase = 'aktiv' | 'passiv' | 'spielende';

export interface Zugstand {
  /** 1 bis 6. */
  runde: number;
  phase: Phase;
  /** Nummer des Wurfs in der aktiven Phase, 1 bis 3. */
  wurf: number;
  /** Aktuell wählbare Würfel. */
  offen: Wuerfel[];
  /** Silbernes Tablett. In der passiven Phase sind das die wählbaren Würfel. */
  tablett: Wuerfel[];
  /**
   * Die drei Würfelfelder. `null` steht für einen verfallenen Wurf – das Feld
   * bleibt leer und ist trotzdem verbraucht.
   */
  felder: (Wuerfel | null)[];
  /**
   * Passive Phase: die drei hohen Würfel, die der gedachte aktive Spieler
   * genommen hätte. Nur wählbar, wenn vom Tablett nichts geht.
   */
  passivFelder: Wuerfel[];
}

export function neueRunde(runde: number, rng: Rng): Zugstand {
  return {
    runde,
    phase: 'aktiv',
    wurf: 1,
    offen: werfen(WUERFEL_FARBEN, rng),
    tablett: [],
    felder: [],
    passivFelder: [],
  };
}

/**
 * Der Wert des weißen Würfels dieser Runde – egal wo er gerade liegt. Für
 * Blau wird er als Spaltenangabe gebraucht, auch wenn er längst auf dem
 * Tablett liegt.
 */
export function weisserWert(stand: Zugstand): number | null {
  const alle = [...stand.offen, ...stand.tablett, ...stand.passivFelder, ...stand.felder];
  return alle.find((w) => w?.farbe === 'weiss')?.wert ?? null;
}

// -------------------------------------------------------------- Aktive Phase

/**
 * Einen Würfel nehmen. Er kommt auf das nächste Würfelfeld, alle **niedrigeren**
 * wandern aufs Tablett – gleiche Werte bleiben, die sind nicht niedriger.
 * Danach wird mit dem Rest weitergewürfelt.
 */
export function nachWahl(stand: Zugstand, index: number, rng: Rng): Zugstand {
  if (stand.phase !== 'aktiv') throw new Error('Wahl nur in der aktiven Phase.');
  const gewaehlt = stand.offen[index];
  if (!gewaehlt) throw new Error('Diesen Würfel gibt es nicht.');

  const rest = stand.offen.filter((_, i) => i !== index);
  const abgelegt = rest.filter((w) => w.wert < gewaehlt.wert);
  const inHand = rest.filter((w) => w.wert >= gewaehlt.wert);

  const felder = [...stand.felder, gewaehlt];
  const tablett = [...stand.tablett, ...abgelegt];

  // Nach drei Würfeln oder wenn nichts mehr übrig ist, ist die aktive Phase
  // vorbei; alles Verbliebene kommt aufs Tablett.
  if (felder.length >= 3 || inHand.length === 0) {
    return { ...stand, felder, tablett: [...tablett, ...inHand], offen: [], wurf: stand.wurf };
  }

  return {
    ...stand,
    felder,
    tablett,
    wurf: stand.wurf + 1,
    offen: werfen(
      inHand.map((w) => w.farbe),
      rng,
    ),
  };
}

/**
 * Auf den Wurf verzichten. Der Wurf verfällt und ein Würfelfeld bleibt leer,
 * ist aber verbraucht – deshalb ist Verzichten teuer.
 */
export function verzichten(stand: Zugstand, rng: Rng): Zugstand {
  if (stand.phase !== 'aktiv') throw new Error('Verzicht nur in der aktiven Phase.');

  const felder = [...stand.felder, null];
  if (felder.length >= 3) {
    return { ...stand, felder, tablett: [...stand.tablett, ...stand.offen], offen: [] };
  }

  return {
    ...stand,
    felder,
    wurf: stand.wurf + 1,
    offen: werfen(
      stand.offen.map((w) => w.farbe),
      rng,
    ),
  };
}

export const aktivFertig = (stand: Zugstand) => stand.phase === 'aktiv' && stand.offen.length === 0;

// ------------------------------------------------------------ Passive Phase

/**
 * Die passive Phase im Solospiel: alle sechs Würfel werfen, die drei
 * niedrigsten kommen aufs Tablett, die drei hohen liegen auf den Würfelfeldern
 * des gedachten aktiven Spielers. Gewählt wird einer vom Tablett.
 */
export function startePassiv(stand: Zugstand, rng: Rng): Zugstand {
  const wurf = werfen(WUERFEL_FARBEN, rng);
  // Aufsteigend sortieren; bei gleichem Wert entscheidet die feste Reihenfolge
  // der Farben, damit derselbe Wurf immer gleich aufgeteilt wird.
  const sortiert = [...wurf].sort(
    (a, b) =>
      a.wert - b.wert || WUERFEL_FARBEN.indexOf(a.farbe) - WUERFEL_FARBEN.indexOf(b.farbe),
  );

  return {
    ...stand,
    phase: 'passiv',
    offen: [],
    tablett: sortiert.slice(0, 3),
    passivFelder: sortiert.slice(3),
    felder: stand.felder,
  };
}

/**
 * In der passiven Phase wählbare Würfel. Normal ist das Tablett; nur wenn dort
 * nichts verwendbar ist, darf auf die Würfelfelder zurückgegriffen werden.
 */
export function passivWaehlbar(stand: Zugstand, blatt: Blatt): Wuerfel[] {
  const weiss = weisserWert(stand);
  const nutzbar = (w: Wuerfel) => moeglicheZiele(blatt, w, weiss).length > 0;

  const vomTablett = stand.tablett.filter(nutzbar);
  if (vomTablett.length > 0) return vomTablett;
  return stand.passivFelder.filter(nutzbar);
}

// --------------------------------------------------------------- Rundenwechsel

/** Nach der passiven Phase: nächste Runde oder Spielende. */
export function naechsteRunde(stand: Zugstand, rng: Rng): Zugstand {
  if (stand.runde >= RUNDEN) return { ...stand, phase: 'spielende', offen: [], tablett: [] };
  return neueRunde(stand.runde + 1, rng);
}

// ----------------------------------------------------------------- Zielsuche

export interface Ziel extends Eintrag {
  /** Kurzer Text für die Oberfläche, etwa "Reihe 2" oder "Fläche mit 4 Feldern". */
  beschreibung: string;
}

/**
 * Wo lässt sich dieser Würfel eintragen? Die Oberfläche hebt damit die
 * verwendbaren Bereiche hervor und darf nur diese Züge anbieten.
 *
 * Der weiße Würfel ist Joker für Gelb, Grau, Grün und Pink – für Blau nicht,
 * denn dort gibt er die Spalte vor. `weiss` ist sein Wert, egal wo er liegt.
 */
export function moeglicheZiele(blatt: Blatt, wuerfel: Wuerfel, weiss: number | null): Ziel[] {
  const bereiche: Bereich[] =
    wuerfel.farbe === 'weiss'
      ? ['gelb', 'grau', 'gruen', 'pink']
      : [wuerfel.farbe as Bereich];

  const ziele: Ziel[] = [];

  for (const bereich of bereiche) {
    const wert = wuerfel.wert;

    switch (bereich) {
      case 'gelb':
        for (let reihe = 0; reihe < 3; reihe++) {
          if (gelbErlaubt(blatt, reihe, wert)) {
            ziele.push({ bereich, wert, ziel: reihe, beschreibung: `Reihe ${reihe + 1}` });
          }
        }
        break;

      case 'blau': {
        // Zeile aus dem blauen Würfel, Spalte aus dem weißen.
        if (weiss === null) break;
        const zeile = wert - 1;
        const spalte = weiss - 1;
        if (blauErlaubt(blatt, zeile, spalte)) {
          ziele.push({
            bereich,
            wert,
            ziel: [zeile, spalte],
            beschreibung: `Zeile ${wert}, Spalte ${weiss}`,
          });
        }
        break;
      }

      case 'grau':
        for (const index of grauVerfuegbar(blatt, wert)) {
          ziele.push({ bereich, wert, ziel: index, beschreibung: `Teilfläche ${index + 1}` });
        }
        break;

      case 'gruen':
        for (const reihe of ['oben', 'unten'] as const) {
          if (gruenErlaubt(blatt, reihe)) {
            ziele.push({
              bereich,
              wert,
              ziel: reihe,
              beschreibung: reihe === 'oben' ? 'oberes Dreieck' : 'unteres Dreieck',
            });
          }
        }
        break;

      case 'pink':
        if (pinkErlaubt(blatt)) {
          ziele.push({ bereich, wert, beschreibung: 'nächstes Feld' });
        }
        break;
    }
  }

  return ziele;
}

/** Welche der offenen Würfel lassen sich überhaupt eintragen? */
export const nutzbareWuerfel = (stand: Zugstand, blatt: Blatt): Wuerfel[] => {
  const weiss = weisserWert(stand);
  return stand.offen.filter((w) => moeglicheZiele(blatt, w, weiss).length > 0);
};
