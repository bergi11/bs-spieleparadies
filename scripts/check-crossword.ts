/**
 * Prüft die erzeugten Rätsel von "Kreuzchen" gegen den Regelkern des Spiels.
 *
 *   npm run check:crossword
 *
 * Beim Kreuzworträtsel steckt der Fehler selten in der Logik und fast immer in
 * den Daten: ein Hinweis, der sein Wort verrät; eine Nummer, die zweimal
 * vergeben ist; ein Feld, zu dem gar keine Frage gehört. Genau danach wird
 * hier gesucht – und nebenbei nachgerechnet, dass die Wörter wirklich im
 * Gitter stehen.
 */
import {
  FELDER,
  LEER,
  SEITE,
  ersteLuecke,
  felderVon,
  frageAn,
  istSchwarz,
  leereEingabe,
  naechstesFeld,
  nummern,
  reihenfolge,
  richtungFuer,
  schreibe,
  stand,
  stimmt,
  voll,
  vorigesFeld,
  wortStimmt,
  type Daten,
  type Raetsel,
} from '../src/games/crossword/logic.ts';
import raetselJson from '../src/games/crossword/raetsel.json' with { type: 'json' };

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

pruefe(
  'Jedes Gitter hat 25 Felder aus A–Z und #',
  DATEN.raetsel.filter((r) => !/^[A-Z#]{25}$/.test(r.gitter)).map((r) => r.id),
  [],
);

pruefe(
  'Kein Gitter ist doppelt',
  DATEN.raetsel.length - new Set(DATEN.raetsel.map((r) => r.gitter)).size,
  0,
);

// ----------------------------------------------------------------- Wörter

const falschesWort = DATEN.raetsel.filter((r) =>
  r.fragen.some((frage) => felderVon(frage).map((feld) => r.gitter[feld]).join('') !== frage.wort),
);
pruefe('Jedes Wort steht so im Gitter', falschesWort.map((r) => r.id), []);

const schiefeLaenge = DATEN.raetsel.filter((r) =>
  r.fragen.some((frage) => frage.wort.length !== frage.laenge || frage.laenge < 3),
);
pruefe('Jedes Wort ist mindestens drei Buchstaben lang', schiefeLaenge.map((r) => r.id), []);

const ueberRand = DATEN.raetsel.filter((r) =>
  r.fragen.some((frage) =>
    felderVon(frage).some(
      (feld, i) =>
        feld >= FELDER ||
        istSchwarz(r, feld) ||
        // Ein waagerechtes Wort darf nicht in die nächste Zeile rutschen.
        (frage.waagerecht && Math.floor(feld / SEITE) !== Math.floor(frage.start / SEITE)) ||
        (!frage.waagerecht && feld % SEITE !== frage.start % SEITE) ||
        (i === 0 && feld !== frage.start),
    ),
  ),
);
pruefe('Kein Wort läuft über den Rand oder ein schwarzes Feld', ueberRand.map((r) => r.id), []);

/** Ein Wort soll in einem Rätsel nicht zweimal vorkommen. */
const zweimal = DATEN.raetsel.filter(
  (r) => new Set(r.fragen.map((frage) => frage.wort)).size !== r.fragen.length,
);
pruefe('Kein Wort steht zweimal im selben Rätsel', zweimal.map((r) => r.id), []);

const ohneFrage = DATEN.raetsel.filter((r) => {
  const abgedeckt = new Set(r.fragen.flatMap((frage) => felderVon(frage)));
  return Array.from({ length: FELDER }, (_, feld) => feld).some(
    (feld) => !istSchwarz(r, feld) && !abgedeckt.has(feld),
  );
});
pruefe('Zu jedem weißen Feld gehört eine Frage', ohneFrage.map((r) => r.id), []);

// --------------------------------------------------------------- Hinweise

const verraeterisch: string[] = [];
const leererHinweis: string[] = [];
for (const r of DATEN.raetsel) {
  for (const frage of r.fragen) {
    if (!frage.hinweis.trim()) leererHinweis.push(frage.wort);
    if (frage.hinweis.toUpperCase().includes(frage.wort)) verraeterisch.push(frage.wort);
  }
}
pruefe('Kein Hinweis enthält sein eigenes Wort', [...new Set(verraeterisch)], []);
pruefe('Jede Frage hat einen Hinweis', [...new Set(leererHinweis)], []);

/** Dasselbe Wort trägt überall denselben Hinweis. */
const hinweise = new Map<string, string>();
const uneinig: string[] = [];
for (const r of DATEN.raetsel) {
  for (const frage of r.fragen) {
    const bekannt = hinweise.get(frage.wort);
    if (bekannt === undefined) hinweise.set(frage.wort, frage.hinweis);
    else if (bekannt !== frage.hinweis) uneinig.push(frage.wort);
  }
}
pruefe('Ein Wort hat überall denselben Hinweis', [...new Set(uneinig)], []);

// --------------------------------------------------------------- Nummern

/**
 * Die Nummern werden in Leserichtung vergeben, und waagerecht und senkrecht
 * teilen sich die Nummer eines Feldes.
 */
const schiefeNummern = DATEN.raetsel.filter((r) => {
  const anfaenge = [...new Set(r.fragen.map((frage) => frage.start))].sort((a, b) => a - b);
  return anfaenge.some((feld, i) =>
    r.fragen.filter((frage) => frage.start === feld).some((frage) => frage.nr !== i + 1),
  );
});
pruefe('Die Nummern stehen in Leserichtung', schiefeNummern.map((r) => r.id), []);

// ------------------------------------------------------- Regeln im Spiel

const probe: Raetsel = DATEN.raetsel[0];
const leer = leereEingabe(probe);

pruefe('Ein leeres Gitter läuft noch', stand(probe, leer, false), 'laeuft');
pruefe('Das gefüllte Gitter ist die Lösung', stimmt(probe, probe.gitter), true);
pruefe('Das leere Gitter ist nicht voll', voll(probe, leer), false);
pruefe('Das gelöste Gitter ist voll', voll(probe, probe.gitter), true);

const ersteFrage = reihenfolge(probe)[0];
const einBuchstabe = schreibe(leer, ersteFrage.start, ersteFrage.wort[0]);
pruefe(
  'Ein Buchstabe landet im richtigen Feld',
  einBuchstabe[ersteFrage.start],
  ersteFrage.wort[0],
);
pruefe(
  'Schwarze Felder nehmen nichts an',
  schreibe(leer, probe.gitter.indexOf('#'), 'X')[probe.gitter.indexOf('#')],
  '#',
);
pruefe('Ein halbes Wort stimmt noch nicht', wortStimmt(ersteFrage, einBuchstabe), false);
pruefe('Das ganze Wort stimmt', wortStimmt(ersteFrage, probe.gitter), true);

pruefe(
  'Die erste Lücke ist der Anfang des leeren Wortes',
  ersteLuecke(ersteFrage, leer),
  ersteFrage.start,
);
pruefe(
  'Nach dem letzten Buchstaben geht es nicht weiter',
  naechstesFeld(ersteFrage, felderVon(ersteFrage)[ersteFrage.laenge - 1]),
  null,
);
pruefe('Vor dem ersten Buchstaben ist Schluss', vorigesFeld(ersteFrage, ersteFrage.start), null);

pruefe(
  'Ein Feld kennt seine Richtung',
  richtungFuer(probe, ersteFrage.start, ersteFrage.waagerecht),
  ersteFrage.waagerecht,
);
pruefe(
  'Ohne Wort in der Wunschrichtung gilt die andere',
  Boolean(
    frageAn(probe, ersteFrage.start, !ersteFrage.waagerecht)
      ? true
      : richtungFuer(probe, ersteFrage.start, !ersteFrage.waagerecht) === ersteFrage.waagerecht,
  ),
  true,
);

const leerImGitter = leer.split('').filter((zeichen) => zeichen === LEER).length;
pruefe(
  'Im leeren Gitter sind alle weißen Felder frei',
  leerImGitter,
  probe.gitter.split('').filter((zeichen) => zeichen !== '#').length,
);

// ------------------------------------------------------------------ Fazit

const woerter = new Set(DATEN.raetsel.flatMap((r) => r.fragen.map((frage) => frage.wort)));
const proRaetsel = (
  DATEN.raetsel.reduce((summe, r) => summe + r.fragen.length, 0) / DATEN.raetsel.length
).toFixed(1);

console.log(
  `\n${DATEN.raetsel.length} Rätsel geprüft, ${woerter.size} verschiedene Wörter, ` +
    `${proRaetsel} Fragen je Rätsel.`,
);
console.log(fehler === 0 ? 'Alle Prüfungen bestanden.' : `${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
