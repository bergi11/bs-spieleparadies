/**
 * Prüft die erzeugten Daten von "Schnittpunkte" gegen den Regelkern des Spiels.
 *
 *   npm run check:intersections
 *
 * Die Regeln werden zweimal ausgewertet: beim Erzeugen im Skript und im Spiel
 * beim Prüfen einer Eingabe. Hier laufen beide gegeneinander – stimmt eine
 * mitgelieferte Lösung nicht mit dem zusammen, was das Spiel akzeptieren würde,
 * stünde im Gitter am Ende eine Auflösung, die das Spiel selbst ablehnt.
 */
import {
  FELDER,
  SEITE,
  baueIndex,
  erfuellt,
  normalisiere,
  pruefeEingabe,
  wortFuer,
  type Daten,
} from '../src/games/intersections/logic.ts';
import datenJson from '../src/games/intersections/daten.json' with { type: 'json' };

const DATEN = datenJson as Daten;
const KATEGORIEN = new Map(DATEN.kategorien.map((k) => [k.id, k]));
const EIGENSCHAFTEN = new Map(DATEN.eigenschaften.map((e) => [e.id, e]));
const INDEX = baueIndex(DATEN.kategorien);

/**
 * So viele Wörter muss die Liste je Feld mindestens kennen. Der Erzeuger
 * verlangt meist vier; knapp besetzte Bedingungen wie "Farbe versteckt" dürfen
 * mit drei antreten. Hier steht die untere Grenze, unter die keine fallen darf.
 */
const MIND_KANDIDATEN = 3;

let fehler = 0;

function pruefe(name: string, ist: unknown, soll: unknown) {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  if (!gleich) fehler++;
  console.log(
    `${gleich ? '  ok  ' : 'FEHLER'}  ${name}` +
      `${gleich ? '' : `  ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`}`,
  );
}

// ------------------------------------------------------------- Wortlisten

const doppelte: string[] = [];
const gesehen = new Set<string>();
for (const kategorie of DATEN.kategorien) {
  for (const wort of kategorie.woerter) {
    const schluessel = normalisiere(wort);
    if (gesehen.has(schluessel)) doppelte.push(wort);
    gesehen.add(schluessel);
  }
}
pruefe('Kein Wort steht in zwei Kategorien', doppelte, []);

const schief = DATEN.kategorien.flatMap((kategorie) =>
  kategorie.woerter.filter((wort) => !/^[A-ZÄÖÜ]+$/.test(wort)),
);
pruefe('Alle Wörter in Großbuchstaben ohne Sonderzeichen', schief, []);

// -------------------------------------------------------- Alltagswörter

/**
 * Die Listen sind einmal an den Naheliegendsten vorbeigeschrieben worden: Bei
 * "Tiere" standen Gepard und Pelikan, aber kein Hund. Wer ein solches Wort
 * eintippt und abgewiesen wird, hält das Spiel für kaputt – zu Recht. Diese
 * Stichprobe hält die Listen an das Selbstverständliche gebunden.
 */
const ALLTAG: [string, string][] = [
  ['HUND', 'tiere'],
  ['KATZE', 'tiere'],
  ['PFERD', 'tiere'],
  ['MAUS', 'tiere'],
  ['DEUTSCHLAND', 'laender'],
  ['SPANIEN', 'laender'],
  ['BERLIN', 'staedte'],
  ['PARIS', 'staedte'],
  ['APFEL', 'obst'],
  ['BANANE', 'obst'],
  ['KARTOFFEL', 'gemuese'],
  ['SALAT', 'gemuese'],
  ['ARZT', 'berufe'],
  ['KOCH', 'berufe'],
  ['LEHRER', 'berufe'],
  ['KOPF', 'koerperteile'],
  ['ARM', 'koerperteile'],
  ['HAND', 'koerperteile'],
  ['AUGE', 'koerperteile'],
  ['GITARRE', 'instrumente'],
  ['KLAVIER', 'instrumente'],
  ['FUSSBALL', 'sport'],
  ['TENNIS', 'sport'],
  ['HOSE', 'kleidung'],
  ['SCHUH', 'kleidung'],
  ['AUTO', 'fahrzeuge'],
  ['BUS', 'fahrzeuge'],
  ['ZUG', 'fahrzeuge'],
  ['TISCH', 'moebel'],
  ['BETT', 'moebel'],
  ['HAMMER', 'werkzeuge'],
  ['SCHERE', 'werkzeuge'],
  ['WASSER', 'getraenke'],
  ['BIER', 'getraenke'],
  ['KAFFEE', 'getraenke'],
  ['ROSE', 'pflanzen'],
  ['GRAS', 'pflanzen'],
  ['MATHEMATIK', 'faecher'],
  ['SPORT', 'faecher'],
  ['REGEN', 'wetter'],
  ['WIND', 'wetter'],
  ['SCHNEE', 'wetter'],
  ['TELLER', 'kueche'],
  ['MESSER', 'kueche'],
  ['HERD', 'kueche'],
  ['MOND', 'weltraum'],
  ['STERN', 'weltraum'],
  ['MARS', 'weltraum'],
];

const vermisst = ALLTAG.filter(([wort, kategorie]) => {
  const treffer = INDEX.get(normalisiere(wort));
  return treffer?.kategorie !== kategorie;
}).map(([wort]) => wort);

pruefe('Alltagswörter stehen in der richtigen Kategorie', vermisst, []);

// --------------------------------------------------------------- Rätsel

let unbekannteAchsen = 0;
let falscheZeile = 0;
let falscheSpalte = 0;
let doppeltImGitter = 0;
let zuDuenn = 0;
let vomSpielAbgelehnt = 0;

for (const raetsel of DATEN.raetsel) {
  const zeilen = raetsel.zeilen.map((id) => KATEGORIEN.get(id));
  const spalten = raetsel.spalten.map((id) => EIGENSCHAFTEN.get(id));

  if (zeilen.some((z) => !z) || spalten.some((s) => !s)) {
    unbekannteAchsen++;
    continue;
  }
  if (new Set(raetsel.loesung).size !== FELDER) doppeltImGitter++;

  for (let feld = 0; feld < FELDER; feld++) {
    const zeile = zeilen[Math.floor(feld / SEITE)]!;
    const spalte = spalten[feld % SEITE]!;
    const wort = raetsel.loesung[feld];

    if (!zeile.woerter.includes(wort)) falscheZeile++;
    if (!erfuellt(spalte.regel, wort)) falscheSpalte++;

    const auswahl = zeile.woerter.filter((kandidat) => erfuellt(spalte.regel, kandidat));
    if (auswahl.length < MIND_KANDIDATEN) zuDuenn++;

    // Genau der Weg, den auch das Spiel geht.
    const andere = raetsel.loesung.filter((_, index) => index !== feld);
    const urteil = pruefeEingabe(wort, zeile, spalte, INDEX, DATEN.kategorien, andere);
    if (urteil.art !== 'ok') vomSpielAbgelehnt++;
  }
}

pruefe('Alle Achsen sind in den Daten beschrieben', unbekannteAchsen, 0);
pruefe('Keine Lösung nennt ein Wort zweimal', doppeltImGitter, 0);
pruefe('Jedes Lösungswort gehört zu seiner Zeile', falscheZeile, 0);
pruefe('Jedes Lösungswort erfüllt seine Spalte', falscheSpalte, 0);
pruefe(`Jedes Feld hat mindestens ${MIND_KANDIDATEN} mögliche Wörter`, zuDuenn, 0);
pruefe('Das Spiel nimmt jede mitgelieferte Lösung an', vomSpielAbgelehnt, 0);
pruefe('Es gibt überhaupt Rätsel', DATEN.raetsel.length > 50, true);

// ------------------------------------------------------------- Eingaben

const tiere = KATEGORIEN.get('tiere')!;
const laender = KATEGORIEN.get('laender')!;
const mitS = { id: 'test-s', label: 'beginnt mit S', regel: { art: 'anfang', wert: 'S' } } as const;

pruefe(
  'Kleinschreibung wird angenommen',
  pruefeEingabe('seehund', tiere, mitS, INDEX, DATEN.kategorien, []),
  { art: 'ok', wort: 'SEEHUND' },
);

pruefe(
  'Umlaut darf umschrieben werden',
  pruefeEingabe('moewe', tiere, { ...mitS, regel: { art: 'umlaut' } }, INDEX, DATEN.kategorien, []),
  { art: 'ok', wort: 'MÖWE' },
);

pruefe(
  'Wort aus einer anderen Kategorie fällt auf',
  pruefeEingabe('SPANIEN', tiere, mitS, INDEX, DATEN.kategorien, []).art,
  'andere-kategorie',
);

pruefe(
  'Wort ohne die Eigenschaft wird abgelehnt',
  pruefeEingabe('IGEL', tiere, mitS, INDEX, DATEN.kategorien, []).art,
  'passt-nicht',
);

pruefe(
  'Unbekanntes Wort wird abgelehnt',
  pruefeEingabe('SCHNURPS', tiere, mitS, INDEX, DATEN.kategorien, []).art,
  'unbekannt',
);

pruefe(
  'Ein Wort zählt nur einmal',
  pruefeEingabe('SEEHUND', tiere, mitS, INDEX, DATEN.kategorien, ['SEEHUND']).art,
  'doppelt',
);

pruefe('Leere Eingabe', pruefeEingabe('   ', tiere, mitS, INDEX, DATEN.kategorien, []).art, 'leer');

// ----------------------------------------------------------------- Tipp

pruefe('Tipp nimmt den Vorschlag', wortFuer(laender, mitS, 'SCHWEIZ', []), 'SCHWEIZ');

const ausweich = wortFuer(laender, mitS, 'SCHWEIZ', ['SCHWEIZ']);
pruefe(
  'Tipp weicht aus, wenn der Vorschlag schon steht',
  Boolean(ausweich && ausweich !== 'SCHWEIZ' && ausweich.startsWith('S')),
  true,
);

console.log(
  `\n${DATEN.raetsel.length} Rätsel, ${gesehen.size} Wörter, ` +
    `${DATEN.eigenschaften.length} Eigenschaften geprüft.`,
);
console.log(fehler === 0 ? 'Alle Prüfungen bestanden.' : `${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
