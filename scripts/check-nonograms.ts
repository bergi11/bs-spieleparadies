/**
 * Prüft die erzeugten Bilder von "Bildgitter" gegen den Regelkern des Spiels.
 *
 *   npm run check:nonograms
 *
 * Erzeuger und Spiel führen denselben Zeilen-Solver getrennt mit: einmal als
 * .mjs im Skript, einmal als .ts im Spiel. Hier läuft die Fassung des Spiels
 * über die fertige Datei. Geht ein Bild damit nicht auf, stünde man im Spiel
 * irgendwann vor einer Stelle, an der nur noch Raten hilft – und genau das
 * soll keines der Bilder verlangen.
 */
import {
  LEER,
  STRICH,
  VOLL,
  blockLaengen,
  hinweise,
  istVoll,
  loese,
  muster,
  reiheStimmt,
  stand,
  stimmt,
  type Bild,
  type Daten,
  type Feldstand,
} from '../src/games/nonogram/logic.ts';
import bilderJson from '../src/games/nonogram/bilder.json' with { type: 'json' };

const DATEN = bilderJson as Daten;

let fehler = 0;

function pruefe(name: string, ist: unknown, soll: unknown) {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  if (!gleich) fehler++;
  console.log(
    `${gleich ? '  ok  ' : 'FEHLER'}  ${name}` +
      `${gleich ? '' : `  ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`}`,
  );
}

// ------------------------------------------------------------- Blocklängen

pruefe('Zwei Blöcke mit Lücke', blockLaengen([true, true, false, true]), [2, 1]);
pruefe('Eine leere Reihe trägt die 0', blockLaengen([false, false]), [0]);
pruefe('Eine volle Reihe ist ein Block', blockLaengen([true, true, true]), [3]);

// ----------------------------------------------------------------- Muster

pruefe('Ein Block der Länge 2 auf 4 Feldern passt dreimal', muster([2], 4).length, 3);
pruefe('Zwei Einer auf 3 Feldern passen nur einmal', muster([1, 1], 3).length, 1);
pruefe('Die 0 lässt genau eine leere Reihe zu', muster([0], 4).length, 1);
pruefe(
  'Ein voller Block lässt nichts frei',
  muster([3], 3)[0],
  [true, true, true],
);

// ---------------------------------------------------------------- Aufbau

const falscheGroesse = DATEN.bilder.filter(
  (b) => b.n < 4 || b.n > 12 || b.zellen.length !== b.n * b.n || !/^[01]+$/.test(b.zellen),
);
pruefe('Alle Bilder haben passende Felder', falscheGroesse.map((b) => b.id), []);

pruefe(
  'Die Nummern laufen lückenlos',
  DATEN.bilder.map((b) => b.id),
  DATEN.bilder.map((_, i) => i + 1),
);

pruefe(
  'Jedes Bild hat einen Namen',
  DATEN.bilder.filter((b) => !b.name.trim()).map((b) => b.id),
  [],
);

pruefe(
  'Kein Bild ist leer',
  DATEN.bilder.filter((b) => !b.zellen.includes('1')).map((b) => b.id),
  [],
);

pruefe(
  'Die Starthilfe liegt im Gitter',
  DATEN.bilder
    .filter((b) => b.starthilfe.some((feld) => feld < 0 || feld >= b.n * b.n))
    .map((b) => b.id),
  [],
);

// ------------------------------------------------------------ Lösbarkeit

const brauchtRaten: number[] = [];
let hilfen = 0;

for (const b of DATEN.bilder) {
  hilfen += b.starthilfe.length;
  if (loese(b).art !== 'geloest') brauchtRaten.push(b.id);
}
pruefe('Jedes Bild geht mit Zeilenlogik auf', brauchtRaten, []);

/**
 * Die Starthilfe soll knapp sein. Deckt ein Feld nichts auf, was der Solver
 * ohne es nicht auch fände, steht es nur im Weg.
 */
const zuVielHilfe = DATEN.bilder.filter((b) =>
  b.starthilfe.some((_, i) => {
    const ohne = b.starthilfe.filter((__, k) => k !== i);
    return loese(b, ohne).art === 'geloest';
  }),
);
pruefe('Keine überflüssige Starthilfe', zuVielHilfe.map((b) => b.id), []);

// ------------------------------------------------------- Regeln im Spiel

const probe: Bild = DATEN.bilder[0];
const leer = Array<Feldstand>(probe.n * probe.n).fill(LEER);
const geloest = Array.from({ length: probe.n * probe.n }, (_, i) =>
  istVoll(probe, i) ? VOLL : LEER,
) as Feldstand[];

pruefe('Das leere Gitter ist nicht die Lösung', stimmt(probe, leer), false);
pruefe('Die richtigen Felder sind die Lösung', stimmt(probe, geloest), true);

const mitStrichen = geloest.map((feld) => (feld === LEER ? STRICH : feld)) as Feldstand[];
pruefe('Striche stören die Lösung nicht', stimmt(probe, mitStrichen), true);

pruefe('Ein gelöstes Bild gilt als gewonnen', stand(probe, geloest, false), 'gewonnen');
pruefe('Ein leeres Bild läuft noch', stand(probe, leer, false), 'laeuft');

const zahlen = hinweise(probe);
pruefe(
  'Im gelösten Bild ist jede Zeile fertig',
  zahlen.zeilen.map((z, r) => reiheStimmt(z, geloest, probe.n, 'zeile', r)).filter((ok) => !ok),
  [],
);
pruefe(
  'Im gelösten Bild ist jede Spalte fertig',
  zahlen.spalten.map((z, c) => reiheStimmt(z, geloest, probe.n, 'spalte', c)).filter((ok) => !ok),
  [],
);

// ------------------------------------------------------------------ Fazit

const groessen = new Map<number, number>();
for (const b of DATEN.bilder) groessen.set(b.n, (groessen.get(b.n) ?? 0) + 1);

console.log(
  `\n${DATEN.bilder.length} Bilder geprüft ` +
    `(${[...groessen.entries()].map(([n, anzahl]) => `${anzahl}× ${n}×${n}`).join(', ')}), ` +
    `${hilfen} Startfelder insgesamt.`,
);
console.log(fehler === 0 ? 'Alle Prüfungen bestanden.' : `${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
