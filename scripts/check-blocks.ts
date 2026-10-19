/**
 * Prüft den Regelkern von "Klötzchen".
 *
 *   npm run check:blocks
 *
 * Der wichtigste Teil ist die Verteilung: Das Spiel verspricht, dass jede Form
 * gleich oft kommt, ganz gleich, wie es auf dem Brett aussieht. Das wird hier
 * nachgezählt – einmal frei gezogen, einmal nur in Lagen, in denen es eng ist.
 * Schöbe der Kern heimlich passende oder unpassende Formen zu, fiele es in
 * der zweiten Zählung auf.
 */
import {
  FARBEN,
  FORMEN,
  GROESSE,
  LEER_BONUS,
  festgefahren,
  gueltig,
  irgendwoPlatz,
  legen,
  masse,
  neuePartie,
  normieren,
  passt,
  raeumPunkte,
  sichererZufall,
  ziehen,
  type Partie,
  type Zelle,
  type Zufall,
} from '../src/games/blocks/logic.ts';

let fehler = 0;

function pruefe(name: string, ist: unknown, soll: unknown) {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  if (!gleich) fehler++;
  console.log(
    `${gleich ? '  ok  ' : 'FEHLER'}  ${name}` +
      `${gleich ? '' : `  ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`}`,
  );
}

/** Wiederholbarer Zufall für die Spielzüge – nicht für die Verteilungsprüfung. */
function saat(start: number): Zufall {
  let s = start >>> 0;
  return (n) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.floor((s / 0x1_0000_0000) * n);
  };
}

const leer = () => Array<number>(GROESSE * GROESSE).fill(0);
const schluessel = (zellen: readonly Zelle[]) => JSON.stringify(normieren(zellen));

// ---------------------------------------------------------------- Katalog

pruefe('37 Formen im Katalog', FORMEN.length, 37);
pruefe('Keine Form doppelt', new Set(FORMEN.map(schluessel)).size, FORMEN.length);
pruefe(
  'Alle Formen liegen oben links',
  FORMEN.filter((f) => schluessel(f) !== JSON.stringify(f)).length,
  0,
);
pruefe(
  'Keine Form größer als 5×5',
  FORMEN.filter((f) => masse(f).hoehe > 5 || masse(f).breite > 5).length,
  0,
);
pruefe(
  'Auf ein leeres Brett passt jede Form',
  FORMEN.every((f) => passt(leer(), f, 0, 0)),
  true,
);

// ---------------------------------------------------------- Verteilung

/**
 * Chi-Quadrat gegen die Gleichverteilung. Bei 36 Freiheitsgraden liegt die
 * Schwelle für p = 0,001 bei 67,99 – eine ehrliche Quelle reißt sie nur in
 * einem von tausend Läufen.
 */
function chiQuadrat(zaehler: number[]) {
  const summe = zaehler.reduce((a, b) => a + b, 0);
  const erwartet = summe / zaehler.length;
  return zaehler.reduce((chi, z) => chi + (z - erwartet) ** 2 / erwartet, 0);
}
const SCHWELLE_36 = 67.99;
const SCHWELLE_6 = 22.46;

const index = new Map(FORMEN.map((f, i) => [schluessel(f), i]));

const frei = Array<number>(FORMEN.length).fill(0);
const farben = Array<number>(FARBEN).fill(0);
for (let i = 0; i < 370_000; i++) {
  const s = ziehen();
  frei[index.get(schluessel(s.zellen))!]++;
  farben[s.farbe - 1]++;
}
const chiFrei = chiQuadrat(frei);
console.log(`        frei gezogen: χ² = ${chiFrei.toFixed(1)}, je Form ${Math.min(...frei)}–${Math.max(...frei)}`);
pruefe('Formen gleichverteilt (frei gezogen)', chiFrei < SCHWELLE_36, true);
pruefe('Farben gleichverteilt', chiQuadrat(farben) < SCHWELLE_6, true);

// Ein Grenzfall des Verwerfens: Bei n = 3 ist 2³² nicht teilbar – ohne das
// Verwerfen käme die 0 minimal öfter. Das sieht man so nicht, aber die Werte
// müssen wenigstens alle im Bereich liegen.
const kleine = new Set(Array.from({ length: 1000 }, () => sichererZufall(3)));
pruefe('Zufall bleibt im Bereich', [...kleine].sort(), [0, 1, 2]);

/**
 * Jetzt die Probe aufs Exempel: echte Partien mit dem echten Zufall spielen
 * und nur die Hände zählen, die auf ein volles Brett folgen. Wählte der Kern
 * nach dem Brett, wäre die Verteilung hier schief.
 */
const eng = Array<number>(FORMEN.length).fill(0);
const spieler = saat(7);
let partien = 0;
let haende = 0;
while (haende < 40_000) {
  let p: Partie = neuePartie();
  partien++;
  while (!p.vorbei) {
    const i = p.hand.findIndex((s) => s !== null && irgendwoPlatz(p.feld, s.zellen));
    const stueck = p.hand[i]!;
    // Erste passende Stelle in zufälliger Reihenfolge – ein schwacher Spieler,
    // damit das Brett oft voll wird.
    const stellen: [number, number][] = [];
    for (let r = 0; r < GROESSE; r++)
      for (let c = 0; c < GROESSE; c++) if (passt(p.feld, stueck.zellen, r, c)) stellen.push([r, c]);
    const [r, c] = stellen[spieler(stellen.length)];
    const vorher = p.hand.filter((s) => s !== null).length;
    const zug = legen(p, i, r, c)!;
    p = zug.partie;
    if (vorher === 1 && p.feld.filter((f) => f > 0).length >= 30) {
      for (const s of p.hand) eng[index.get(schluessel(s!.zellen))!]++;
      haende++;
    }
  }
}
const chiEng = chiQuadrat(eng);
console.log(
  `        auf vollem Brett: χ² = ${chiEng.toFixed(1)} über ${haende} Hände aus ${partien} Partien`,
);
pruefe('Formen gleichverteilt (auch wenn es eng ist)', chiEng < SCHWELLE_36, true);

// ---------------------------------------------------------------- Regeln

const zeile = FORMEN.findIndex((f) => f.length === 5 && masse(f).hoehe === 1);
const fuenf = FORMEN[zeile];
const ohneZufall: Zufall = () => 0;

function partieMit(feld: number[], hand: Partie['hand']): Partie {
  return { feld, hand, punkte: 0, kombo: 0, seitRaeumen: 0, zuege: 0, vorbei: false };
}

{
  const feld = leer();
  for (let c = 0; c < 3; c++) feld[c] = 1;
  feld[GROESSE * 7] = 2; // damit das Brett nach dem Räumen nicht leer ist
  const p = partieMit(feld, [{ zellen: fuenf, farbe: 3 }, { zellen: [[0, 0]], farbe: 1 }, null]);
  const zug = legen(p, 0, 0, 3, ohneZufall)!;
  pruefe('Eine volle Zeile verschwindet', zug.partie.feld.slice(0, GROESSE), leer().slice(0, GROESSE));
  pruefe('Eine Linie: 5 Felder + 10', zug.gewinn, 15);
  pruefe('Kombo beginnt bei 1', zug.partie.kombo, 1);
  pruefe('Gelegte Form verschwindet aus der Hand', zug.partie.hand[0], null);
  pruefe('Übrige Form bleibt', zug.partie.hand[1]?.farbe, 1);
  pruefe('Nicht passend: kein Zug', legen(zug.partie, 1, 7, 0), null);
}

{
  // Zeile 0 und Spalte 0 gleichzeitig, danach ist das Brett leer.
  const feld = leer();
  for (let k = 1; k < GROESSE; k++) {
    feld[k] = 1;
    feld[k * GROESSE] = 1;
  }
  const p = partieMit(feld, [{ zellen: [[0, 0]], farbe: 4 }, null, null]);
  const zug = legen(p, 0, 0, 0, ohneZufall)!;
  pruefe('Zeile und Spalte zugleich: zwei Linien', zug.linien, 2);
  pruefe('Leeres Brett gibt den Bonus', zug.gewinn, 1 + raeumPunkte(2, 1) + LEER_BONUS);
  pruefe('Letzte Form gelegt: neue Hand', zug.partie.hand.every((s) => s !== null), true);
}

{
  const p = { ...partieMit(leer(), [{ zellen: [[0, 0]], farbe: 1 }, null, null]), kombo: 2, seitRaeumen: 2 };
  const zug = legen(p, 0, 4, 4, ohneZufall)!;
  pruefe('Drei Formen ohne Räumen: Kombo reißt ab', zug.partie.kombo, 0);
  pruefe('Raumpunkte wachsen mit der Kombo', raeumPunkte(1, 3), 30);
}

{
  // Schachbrett: Kein Feld hat einen freien Nachbarn, nur Einzelfelder passen.
  const feld = leer().map((_, i) => ((i >> 3) + i) % 2);
  const domino = FORMEN.find((f) => f.length === 2)!;
  pruefe('Festgefahren, wenn nichts passt', festgefahren(feld, [{ zellen: domino, farbe: 1 }, null, null]), true);
  pruefe(
    'Nicht festgefahren, solange eine Form passt',
    festgefahren(feld, [{ zellen: domino, farbe: 1 }, { zellen: [[0, 0]], farbe: 1 }, null]),
    false,
  );
}

pruefe('Ein frischer Stand ist gültig', gueltig(neuePartie()), true);
pruefe('Ein kaputter Stand nicht', gueltig({ feld: [1, 2], hand: [] }), false);

console.log(fehler === 0 ? '\nAlle Prüfungen bestanden.' : `\n${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
