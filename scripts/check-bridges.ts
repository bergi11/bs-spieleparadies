/**
 * Prüft die erzeugten Rätsel von "Brücken" gegen den Regelkern des Spiels.
 *
 *   npm run check:bridges
 *
 * Erzeuger und Spiel führen denselben Grenzen-Solver getrennt mit: einmal als
 * .mjs im Skript, einmal als .ts im Spiel. Hier läuft die Fassung des Spiels
 * über die fertige Datei – samt der Frage, die beim Bauen leicht untergeht:
 * Passt die mitgelieferte Lösung überhaupt zu den Zahlen auf den Inseln, und
 * ist sie die einzige?
 */
import {
  gradVon,
  kanten,
  kreuzen,
  kreuzungen,
  loese,
  stand,
  zusammenhaengend,
  type Daten,
  type Raetsel,
} from '../src/games/bridges/logic.ts';
import raetselJson from '../src/games/bridges/raetsel.json' with { type: 'json' };

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

// ---------------------------------------------------------------- Aufbau

pruefe(
  'Die Nummern laufen lückenlos',
  DATEN.raetsel.map((r) => r.id),
  DATEN.raetsel.map((_, i) => i + 1),
);

const ausserhalb = DATEN.raetsel.filter((r) =>
  r.inseln.some((insel) => insel.r < 0 || insel.r >= r.n || insel.c < 0 || insel.c >= r.n),
);
pruefe('Alle Inseln liegen im Gitter', ausserhalb.map((r) => r.id), []);

const doppelt = DATEN.raetsel.filter(
  (r) => new Set(r.inseln.map((insel) => `${insel.r},${insel.c}`)).size !== r.inseln.length,
);
pruefe('Keine zwei Inseln auf demselben Feld', doppelt.map((r) => r.id), []);

/** Zwei Inseln nebeneinander hätten keinen Platz für eine Brücke dazwischen. */
const aneinander = DATEN.raetsel.filter((r) =>
  r.inseln.some((eins, i) =>
    r.inseln.some(
      (zwei, k) => k !== i && Math.abs(eins.r - zwei.r) + Math.abs(eins.c - zwei.c) === 1,
    ),
  ),
);
pruefe('Keine zwei Inseln direkt nebeneinander', aneinander.map((r) => r.id), []);

const schieferGrad = DATEN.raetsel.filter((r) =>
  r.inseln.some((insel) => insel.grad < 1 || insel.grad > 8),
);
pruefe('Jede Insel verlangt zwischen 1 und 8 Brücken', schieferGrad.map((r) => r.id), []);

const schiefeLaenge = DATEN.raetsel.filter((r) => r.loesung.length !== kanten(r).length);
pruefe('Die Lösung nennt jede mögliche Verbindung', schiefeLaenge.map((r) => r.id), []);

// ---------------------------------------------------------------- Lösung

/** Stimmt die mitgelieferte Lösung mit den Zahlen auf den Inseln überein? */
function loesungPasst(r: Raetsel): boolean {
  const alle = kanten(r);
  if (r.loesung.some((wert) => wert < 0 || wert > 2)) return false;
  if (r.inseln.some((insel, i) => gradVon(alle, r.loesung, i) !== insel.grad)) return false;

  const imWeg = kreuzungen(r, alle);
  const kreuzt = alle.some(
    (_, k) => r.loesung[k] > 0 && imWeg[k].some((quer) => r.loesung[quer] > 0),
  );
  if (kreuzt) return false;

  return zusammenhaengend(r, alle, r.loesung);
}

pruefe(
  'Die Lösung erfüllt jede Inselzahl, kreuzt nichts und hängt zusammen',
  DATEN.raetsel.filter((r) => !loesungPasst(r)).map((r) => r.id),
  [],
);

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
  if (ergebnis.werte.join(',') !== r.loesung.join(',')) andereLoesung.push(r.id);
}

pruefe('Jedes Rätsel geht ohne Raten auf', nichtLoesbar, []);
pruefe('Es kommt die mitgelieferte Lösung heraus', andereLoesung, []);

// ------------------------------------------------------- Regeln im Spiel

const probe = DATEN.raetsel[0];
const alleProbe = kanten(probe);
const leer = alleProbe.map(() => 0);

pruefe('Ein leeres Netz läuft noch', stand(probe, alleProbe, leer, false), 'laeuft');
pruefe('Die Lösung gilt als gewonnen', stand(probe, alleProbe, probe.loesung, false), 'gewonnen');

/**
 * Ein Netz, das jede Inselzahl erfüllt, aber in zwei Teile zerfällt, ist nicht
 * gelöst. Das ist die Regel, die man beim Spielen am ehesten vergisst.
 */
const zerfallen = DATEN.raetsel.find((r) => {
  const alle = kanten(r);
  return alle.some((_, k) => {
    if (r.loesung[k] === 0) return false;
    const kaputt = [...r.loesung];
    kaputt[k] = 0;
    return !zusammenhaengend(r, alle, kaputt);
  });
});
pruefe('Es gibt Rätsel, bei denen eine Brücke das Netz trägt', Boolean(zerfallen), true);

const waagerecht = { a: 0, b: 1, waagerecht: true };
const senkrecht = { a: 2, b: 3, waagerecht: false };
const kreuzProbe: Raetsel = {
  id: 0,
  n: 3,
  inseln: [
    { r: 1, c: 0, grad: 1 },
    { r: 1, c: 2, grad: 1 },
    { r: 0, c: 1, grad: 1 },
    { r: 2, c: 1, grad: 1 },
  ],
  loesung: [],
};
pruefe('Waagerecht und senkrecht kreuzen sich', kreuzen(kreuzProbe, waagerecht, senkrecht), true);
pruefe(
  'Zwei waagerechte kreuzen sich nie',
  kreuzen(kreuzProbe, waagerecht, { a: 0, b: 1, waagerecht: true }),
  false,
);

// ------------------------------------------------------------------ Fazit

const groessen = new Map<string, number>();
for (const r of DATEN.raetsel) {
  const schluessel = `${r.n}×${r.n}`;
  groessen.set(schluessel, (groessen.get(schluessel) ?? 0) + 1);
}

console.log(
  `\n${DATEN.raetsel.length} Rätsel geprüft ` +
    `(${[...groessen.entries()].map(([groesse, anzahl]) => `${anzahl}× ${groesse}`).join(', ')}), ` +
    `${(runden / DATEN.raetsel.length).toFixed(1)} Grenzrunden im Schnitt.`,
);
console.log(fehler === 0 ? 'Alle Prüfungen bestanden.' : `${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
