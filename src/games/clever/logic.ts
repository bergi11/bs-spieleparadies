import {
  BLAU_BONI,
  BLAU_NEBENDIAGONALE_PUNKTE,
  BLAU_SPALTENWERTE,
  GELB_BONI,
  GELB_SPALTEN,
  GELB_SPALTENWERTE,
  GRAU_BONI,
  GRAU_RASTER,
  GRAU_SPALTENWERTE,
  GRAU_START_FELDER,
  GRUEN_BONI,
  GRUEN_FELDER,
  GRUEN_VERDOPPELT_AB,
  PINK_BONI,
  PINK_KREIS_PUNKTE,
  PINK_WERTE,
  TITEL,
  type Bereich,
  type Bonus,
} from './sheet';

/**
 * Regelkern von Clever 4Ever. Bewusst ohne React und ohne Zufall: alle
 * Funktionen sind rein, damit sie sich einzeln prüfen lassen. Würfel und
 * Rundenablauf liegen darüber.
 */

export interface Blatt {
  /** 3 Reihen à 5 Felder; null = leer. */
  gelb: (number | null)[][];
  /** 6×6 Kreuze. */
  blau: boolean[][];
  /** 4×16 abgekreuzte Felder. */
  grau: boolean[][];
  /** Obere und untere Dreiecke, je 11 Felder. */
  gruenOben: (number | null)[];
  gruenUnten: (number | null)[];
  /** 12 Felder. */
  pink: (number | null)[];
  fuechse: number;
}

export function leeresBlatt(): Blatt {
  return {
    gelb: Array.from({ length: 3 }, () => Array<number | null>(GELB_SPALTEN).fill(null)),
    blau: Array.from({ length: 6 }, () => Array<boolean>(6).fill(false)),
    grau: Array.from({ length: 4 }, () => Array<boolean>(16).fill(false)),
    gruenOben: Array<number | null>(GRUEN_FELDER).fill(null),
    gruenUnten: Array<number | null>(GRUEN_FELDER).fill(null),
    pink: Array<number | null>(PINK_WERTE.length).fill(null),
    fuechse: 0,
  };
}

// ------------------------------------------------------------------ Gelb

/** Nächstes freies Feld einer Reihe, oder -1 wenn die Reihe voll ist. */
export function gelbNaechstesFeld(blatt: Blatt, reihe: number): number {
  return blatt.gelb[reihe].findIndex((wert) => wert === null);
}

/**
 * Die obere Reihe muss streng aufsteigend gefüllt werden und ist nach einer 6
 * geschlossen. Die beiden unteren Reihen nehmen jeden Wert.
 */
export function gelbErlaubt(blatt: Blatt, reihe: number, wert: number): boolean {
  const feld = gelbNaechstesFeld(blatt, reihe);
  if (feld === -1) return false;
  if (reihe !== 0) return true;

  const vorher = feld === 0 ? null : blatt.gelb[0][feld - 1];
  if (vorher === null) return true;
  if (vorher === 6) return false;
  return wert > vorher;
}

// ------------------------------------------------------------------ Blau

export function blauErlaubt(blatt: Blatt, zeile: number, spalte: number): boolean {
  return !blatt.blau[zeile][spalte];
}

// ------------------------------------------------------------------ Grau

export interface GrauGruppe {
  farbe: 'W' | 'H' | 'D';
  felder: [number, number][];
}

/**
 * Teilflächen des grauen Bereichs: zusammenhängende Felder gleicher Färbung.
 * Wird aus dem Raster berechnet statt von Hand gepflegt – so kann sich nur an
 * einer Stelle ein Fehler einschleichen.
 */
export const GRAU_GRUPPEN: GrauGruppe[] = (() => {
  const gesehen = GRAU_RASTER.map((zeile) => zeile.map(() => false));
  const gruppen: GrauGruppe[] = [];

  for (let r = 0; r < GRAU_RASTER.length; r++) {
    for (let c = 0; c < GRAU_RASTER[r].length; c++) {
      if (gesehen[r][c]) continue;
      const farbe = GRAU_RASTER[r][c];
      const felder: [number, number][] = [];
      const stapel: [number, number][] = [[r, c]];
      gesehen[r][c] = true;

      while (stapel.length) {
        const [zr, zc] = stapel.pop()!;
        felder.push([zr, zc]);
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nr = zr + dr;
          const nc = zc + dc;
          if (nr < 0 || nc < 0 || nr >= GRAU_RASTER.length || nc >= GRAU_RASTER[0].length) continue;
          if (gesehen[nr][nc] || GRAU_RASTER[nr][nc] !== farbe) continue;
          gesehen[nr][nc] = true;
          stapel.push([nr, nc]);
        }
      }

      gruppen.push({ farbe, felder });
    }
  }
  return gruppen;
})();

const gruppeVon = (r: number, c: number) =>
  GRAU_GRUPPEN.findIndex((g) => g.felder.some(([gr, gc]) => gr === r && gc === c));

const START_GRUPPEN = new Set(GRAU_START_FELDER.map(([r, c]) => gruppeVon(r, c)));

const grauLeer = (blatt: Blatt) => blatt.grau.every((zeile) => zeile.every((f) => !f));

/**
 * Welche Teilflächen sind mit diesem Würfelwert abzukreuzen? Der Wert muss
 * mindestens so groß sein wie die Fläche Felder hat. Der erste Zug muss in
 * einer der beiden Startflächen liegen, danach muss die neue Fläche an eine
 * bereits abgekreuzte grenzen.
 */
export function grauVerfuegbar(blatt: Blatt, wert: number): number[] {
  const ersterZug = grauLeer(blatt);

  return GRAU_GRUPPEN.map((gruppe, index) => ({ gruppe, index }))
    .filter(({ gruppe, index }) => {
      if (gruppe.felder.length > wert) return false;
      if (gruppe.felder.every(([r, c]) => blatt.grau[r][c])) return false;
      if (ersterZug) return START_GRUPPEN.has(index);

      return gruppe.felder.some(([r, c]) =>
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ].some(([dr, dc]) => {
          const nr = r + dr;
          const nc = c + dc;
          return (
            nr >= 0 &&
            nc >= 0 &&
            nr < blatt.grau.length &&
            nc < blatt.grau[0].length &&
            blatt.grau[nr][nc]
          );
        }),
      );
    })
    .map(({ index }) => index);
}

// ------------------------------------------------------------------ Grün

export function gruenNaechstesFeld(blatt: Blatt, reihe: 'oben' | 'unten'): number {
  const felder = reihe === 'oben' ? blatt.gruenOben : blatt.gruenUnten;
  return felder.findIndex((wert) => wert === null);
}

/**
 * Jedes grüne Feld wird von unten nach oben gefüllt: erst das untere Dreieck
 * (das den Bonus bringt), danach erst das obere, das das Feld vervollständigt
 * und Punkte gibt. Beide Reihen laufen dabei von links nach rechts.
 */
export function gruenErlaubt(blatt: Blatt, reihe: 'oben' | 'unten'): boolean {
  const feld = gruenNaechstesFeld(blatt, reihe);
  if (feld === -1) return false;
  return reihe === 'unten' || blatt.gruenUnten[feld] !== null;
}

// ------------------------------------------------------------------ Pink

export function pinkNaechstesFeld(blatt: Blatt): number {
  return blatt.pink.findIndex((wert) => wert === null);
}

export const pinkErlaubt = (blatt: Blatt) => pinkNaechstesFeld(blatt) !== -1;

// -------------------------------------------------------------- Eintragen

export interface Eintrag {
  bereich: Bereich;
  wert: number;
  /** Gelb: Reihe. Grün: 'oben' | 'unten'. Blau: [zeile, spalte]. Grau: Gruppenindex. */
  ziel?: number | 'oben' | 'unten' | [number, number];
}

/**
 * Trägt einen Würfel ein und liefert das neue Blatt samt der dadurch
 * ausgelösten Boni. Wirft, wenn der Zug nicht erlaubt ist – die Oberfläche
 * darf nur erlaubte Züge anbieten.
 */
export function eintragen(blatt: Blatt, eintrag: Eintrag): { blatt: Blatt; boni: Bonus[] } {
  const neu = strukturKopie(blatt);
  const boni: Bonus[] = [];

  switch (eintrag.bereich) {
    case 'gelb': {
      const reihe = eintrag.ziel as number;
      if (!gelbErlaubt(blatt, reihe, eintrag.wert)) throw new Error('Gelb: Zug nicht erlaubt.');
      const feld = gelbNaechstesFeld(blatt, reihe);
      neu.gelb[reihe][feld] = eintrag.wert;
      pushBonus(boni, GELB_BONI[reihe][feld]);
      break;
    }
    case 'blau': {
      const [zeile, spalte] = eintrag.ziel as [number, number];
      if (!blauErlaubt(blatt, zeile, spalte)) throw new Error('Blau: Feld belegt.');
      neu.blau[zeile][spalte] = true;
      boni.push(...blauAusgeloest(blatt, neu, zeile));
      break;
    }
    case 'grau': {
      const index = eintrag.ziel as number;
      if (!grauVerfuegbar(blatt, eintrag.wert).includes(index)) {
        throw new Error('Grau: Teilfläche nicht wählbar.');
      }
      for (const [r, c] of GRAU_GRUPPEN[index].felder) {
        neu.grau[r][c] = true;
        const bonus = GRAU_BONI[`${r},${c}`];
        if (bonus) boni.push(bonus);
      }
      boni.push(...grauFuechse(blatt, neu));
      break;
    }
    case 'gruen': {
      const reihe = eintrag.ziel as 'oben' | 'unten';
      if (!gruenErlaubt(blatt, reihe)) throw new Error('Grün: Reihe voll.');
      const feld = gruenNaechstesFeld(blatt, reihe);
      if (reihe === 'oben') neu.gruenOben[feld] = eintrag.wert;
      else {
        neu.gruenUnten[feld] = eintrag.wert;
        pushBonus(boni, GRUEN_BONI[feld]);
      }
      break;
    }
    case 'pink': {
      if (!pinkErlaubt(blatt)) throw new Error('Pink: Leiste voll.');
      const feld = pinkNaechstesFeld(blatt);
      neu.pink[feld] = eintrag.wert;
      // Die 5 und die 6 lösen den Bonus unter dem Feld aus.
      if (eintrag.wert >= 5) pushBonus(boni, PINK_BONI[feld]);
      // Eine 3 trägt sich sofort im nächsten Feld noch einmal ein.
      if (eintrag.wert === 3 && feld + 1 < neu.pink.length) neu.pink[feld + 1] = 3;
      break;
    }
  }

  for (const bonus of boni) if (bonus.art === 'fuchs') neu.fuechse++;
  return { blatt: neu, boni };
}

function pushBonus(liste: Bonus[], bonus: Bonus | null | undefined) {
  if (bonus) liste.push(bonus);
}

/** Zeilenbonus bei genau 2 Kreuzen, dazu die Hauptdiagonale. */
function blauAusgeloest(vorher: Blatt, nachher: Blatt, zeile: number): Bonus[] {
  const boni: Bonus[] = [];
  const zaehle = (b: boolean[]) => b.filter(Boolean).length;

  if (zaehle(vorher.blau[zeile]) < 2 && zaehle(nachher.blau[zeile]) === 2) {
    pushBonus(boni, BLAU_BONI[zeile]);
  }

  // Zwei Kreuze auf der Hauptdiagonale (oben links → unten rechts) geben einen
  // Neuwurf. Die Nebendiagonale gibt keinen Bonus, sondern am Ende 6 Punkte.
  const diagonale = (blatt: Blatt) => blatt.blau.filter((z, i) => z[i]).length;
  if (diagonale(vorher) < 2 && diagonale(nachher) === 2) boni.push({ art: 'neuwurf' });

  return boni;
}

/** Ein Fuchs für jede vollständig abgekreuzte Färbung im grauen Bereich. */
function grauFuechse(vorher: Blatt, nachher: Blatt): Bonus[] {
  const komplett = (blatt: Blatt, farbe: 'W' | 'H' | 'D') =>
    GRAU_RASTER.every((zeile, r) => zeile.every((f, c) => f !== farbe || blatt.grau[r][c]));

  return (['W', 'H', 'D'] as const)
    .filter((farbe) => !komplett(vorher, farbe) && komplett(nachher, farbe))
    .map(() => ({ art: 'fuchs' }) as Bonus);
}

function strukturKopie(blatt: Blatt): Blatt {
  return {
    gelb: blatt.gelb.map((z) => [...z]),
    blau: blatt.blau.map((z) => [...z]),
    grau: blatt.grau.map((z) => [...z]),
    gruenOben: [...blatt.gruenOben],
    gruenUnten: [...blatt.gruenUnten],
    pink: [...blatt.pink],
    fuechse: blatt.fuechse,
  };
}

// --------------------------------------------------------------- Wertung

export function punkteGelb(blatt: Blatt): number {
  const summe = (reihe: (number | null)[]) => reihe.reduce<number>((s, w) => s + (w ?? 0), 0);

  let spalten = 0;
  for (let c = 0; c < GELB_SPALTEN; c++) {
    if (blatt.gelb.every((reihe) => reihe[c] !== null)) spalten += GELB_SPALTENWERTE[c];
  }
  return -summe(blatt.gelb[1]) + summe(blatt.gelb[2]) + spalten;
}

export function punkteBlau(blatt: Blatt): number {
  let punkte = 0;
  for (let c = 0; c < 6; c++) {
    const kreuze = blatt.blau.filter((zeile) => zeile[c]).length;
    if (kreuze >= 2) punkte += BLAU_SPALTENWERTE[c];
  }
  const neben = blatt.blau.filter((zeile, r) => zeile[5 - r]).length;
  if (neben >= 2) punkte += BLAU_NEBENDIAGONALE_PUNKTE;
  return punkte;
}

export function punkteGrau(blatt: Blatt): number {
  let punkte = 0;
  for (let c = 0; c < GRAU_SPALTENWERTE.length; c++) {
    if (blatt.grau.every((zeile) => zeile[c])) punkte += GRAU_SPALTENWERTE[c];
  }
  return punkte;
}

export function punkteGruen(blatt: Blatt): number {
  let punkte = 0;
  for (let i = 0; i < GRUEN_FELDER; i++) {
    const oben = blatt.gruenOben[i];
    const unten = blatt.gruenUnten[i];
    // Nur vollständig gefüllte Felder geben Punkte.
    if (oben === null || unten === null) continue;
    punkte += (oben + unten) * (i >= GRUEN_VERDOPPELT_AB ? 2 : 1);
  }
  return punkte;
}

export function punktePink(blatt: Blatt): number {
  const letztes = blatt.pink.reduce<number>((letzt, wert, i) => (wert !== null ? i : letzt), -1);
  const leiste = letztes >= 0 ? PINK_WERTE[letztes] : 0;
  const kreise = blatt.pink.reduce<number>(
    (s, wert) => s + (wert === null ? 0 : (PINK_KREIS_PUNKTE[wert] ?? 0)),
    0,
  );
  return leiste + kreise;
}

export interface Wertung {
  gelb: number;
  blau: number;
  grau: number;
  gruen: number;
  pink: number;
  fuechse: number;
  gesamt: number;
  titel: string;
}

export function werten(blatt: Blatt): Wertung {
  const gelb = punkteGelb(blatt);
  const blau = punkteBlau(blatt);
  const grau = punkteGrau(blatt);
  const gruen = punkteGruen(blatt);
  const pink = punktePink(blatt);

  // Jeder Fuchs zählt so viel wie der schwächste Bereich.
  const schwaechster = Math.min(gelb, blau, grau, gruen, pink);
  const fuechse = blatt.fuechse * schwaechster;

  const gesamt = gelb + blau + grau + gruen + pink + fuechse;
  return {
    gelb,
    blau,
    grau,
    gruen,
    pink,
    fuechse,
    gesamt,
    // Zur Sicherheit der letzte Eintrag, falls die Tabelle je eine Lücke bekommt.
    titel: (TITEL.find((t) => gesamt >= t.ab) ?? TITEL[TITEL.length - 1]).text,
  };
}

