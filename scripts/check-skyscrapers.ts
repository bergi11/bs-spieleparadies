/**
 * Prüft die erzeugten Rätsel von "Wolkenkratzer" gegen den Regelkern des Spiels.
 *
 *   npm run check:skyscrapers
 *
 * Erzeuger und Spiel führen denselben Solver getrennt mit: einmal als .mjs im
 * Skript, einmal als .ts im Spiel. Hier läuft die Fassung des Spiels über die
 * fertige Datei. Damit steht fest, was das Skript nur behauptet: Jedes Rätsel
 * ist ohne Raten lösbar, und es kommt genau die mitgelieferte Lösung heraus.
 */
import {
  doppelte,
  hinweisFehler,
  loese,
  sichtbar,
  spalte,
  stand,
  zeile,
  type Daten,
  type Raetsel,
} from '../src/games/skyscrapers/logic.ts';
import raetselJson from '../src/games/skyscrapers/raetsel.json' with { type: 'json' };

const DATEN = raetselJson as Daten;

let fehler = 0;

function pruefe(name: string, ist: unknown, soll: unknown) {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  if (!gleich) fehler++;
  console.log(
    `${gleich ? '  ok  ' : 'FEHLER'}  ${name}` +
      `${gleich ? '' : `  ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`}`,
  );
}

// ------------------------------------------------------------- Sichtweite

pruefe('Aufsteigend sieht man alles', sichtbar([1, 2, 3, 4]), 4);
pruefe('Der Riese vorne verdeckt den Rest', sichtbar([4, 1, 2, 3]), 1);
pruefe('Zwischendurch Höheres zählt mit', sichtbar([2, 1, 4, 3]), 2);

// ---------------------------------------------------------------- Aufbau

const falscheGroesse = DATEN.raetsel.filter(
  (r) =>
    r.n < 4 ||
    r.n > 6 ||
    r.loesung.length !== r.n * r.n ||
    [r.oben, r.unten, r.links, r.rechts].some((seite) => seite.length !== r.n),
);
pruefe('Alle Rätsel haben passende Feldzahlen', falscheGroesse.map((r) => r.id), []);

pruefe(
  'Die Nummern laufen lückenlos',
  DATEN.raetsel.map((r) => r.id),
  DATEN.raetsel.map((_, i) => i + 1),
);

const vollstaendig = (werte: number[], n: number) =>
  werte.length === n && new Set(werte).size === n && werte.every((w) => w >= 1 && w <= n);

const keinQuadrat = DATEN.raetsel.filter((r) =>
  Array.from({ length: r.n }, (_, i) => i).some(
    (i) =>
      !vollstaendig(zeile(r.loesung, r.n, i), r.n) || !vollstaendig(spalte(r.loesung, r.n, i), r.n),
  ),
);
pruefe('Jede Höhe steht einmal je Zeile und Spalte', keinQuadrat.map((r) => r.id), []);

/** Steht ein Hinweis, muss er zur mitgelieferten Lösung passen. */
function hinweiseStimmen(r: Raetsel): boolean {
  for (let i = 0; i < r.n; i++) {
    const reihe = zeile(r.loesung, r.n, i);
    const strang = spalte(r.loesung, r.n, i);
    if (r.links[i] && sichtbar(reihe) !== r.links[i]) return false;
    if (r.rechts[i] && sichtbar([...reihe].reverse()) !== r.rechts[i]) return false;
    if (r.oben[i] && sichtbar(strang) !== r.oben[i]) return false;
    if (r.unten[i] && sichtbar([...strang].reverse()) !== r.unten[i]) return false;
  }
  return true;
}

pruefe(
  'Die Hinweise passen zur Lösung',
  DATEN.raetsel.filter((r) => !hinweiseStimmen(r)).map((r) => r.id),
  [],
);

// ------------------------------------------------------------ Lösbarkeit

const nichtLoesbar: number[] = [];
const andereLoesung: number[] = [];
let runden = 0;

for (const r of DATEN.raetsel) {
  const ergebnis = loese(r);
  if (ergebnis.art !== 'geloest') {
    nichtLoesbar.push(r.id);
    continue;
  }
  runden += ergebnis.runden;
  if (ergebnis.gitter.join(',') !== r.loesung.join(',')) andereLoesung.push(r.id);
}

pruefe('Jedes Rätsel geht ohne Raten auf', nichtLoesbar, []);
pruefe('Es kommt die mitgelieferte Lösung heraus', andereLoesung, []);

// ------------------------------------------------------- Rückmeldung im Spiel

const probe = DATEN.raetsel[0];
const leer = Array<number>(probe.n * probe.n).fill(0);

pruefe('Ein leeres Gitter zeigt keine Doppelten', doppelte(leer, probe.n).filter(Boolean), []);

const mitDoppel = [...leer];
mitDoppel[0] = 2;
mitDoppel[1] = 2;
pruefe(
  'Zweimal dieselbe Höhe in einer Zeile fällt auf',
  doppelte(mitDoppel, probe.n)
    .map((treffer, feld) => (treffer ? feld : -1))
    .filter((feld) => feld >= 0),
  [0, 1],
);

const fehlerLeer = hinweisFehler(probe, leer);
pruefe(
  'Halbe Reihen werden noch nicht angemeckert',
  [...fehlerLeer.oben, ...fehlerLeer.unten, ...fehlerLeer.links, ...fehlerLeer.rechts].filter(
    Boolean,
  ),
  [],
);

const fehlerLoesung = hinweisFehler(probe, probe.loesung);
pruefe(
  'Die Lösung verletzt keinen Hinweis',
  [
    ...fehlerLoesung.oben,
    ...fehlerLoesung.unten,
    ...fehlerLoesung.links,
    ...fehlerLoesung.rechts,
  ].filter(Boolean),
  [],
);

pruefe('Die volle Lösung gilt als gewonnen', stand(probe, probe.loesung, false), 'gewonnen');
pruefe('Ein leeres Gitter läuft noch', stand(probe, leer, false), 'laeuft');

// ------------------------------------------------------------------ Fazit

const groessen = new Map<number, number>();
for (const r of DATEN.raetsel) groessen.set(r.n, (groessen.get(r.n) ?? 0) + 1);

console.log(
  `\n${DATEN.raetsel.length} Rätsel geprüft ` +
    `(${[...groessen.entries()].map(([n, anzahl]) => `${anzahl}× ${n}×${n}`).join(', ')}), ` +
    `${(runden / DATEN.raetsel.length).toFixed(1) } Ausschlussrunden im Schnitt.`,
);
console.log(fehler === 0 ? 'Alle Prüfungen bestanden.' : `${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
