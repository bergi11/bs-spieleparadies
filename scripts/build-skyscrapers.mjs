/**
 * Erzeugt die Rätsel für "Wolkenkratzer".
 *
 *   node scripts/build-skyscrapers.mjs
 *
 * Ein Rätsel ist ein n×n-Gitter mit den Höhen 1..n in jeder Zeile und Spalte.
 * Am Rand steht, wie viele Häuser man von dort aus sieht.
 *
 * Der Weg zu einem Rätsel ist immer derselbe:
 *
 *   1. ein zufälliges lateinisches Quadrat – das ist die Lösung
 *   2. alle 4n Hinweise daraus ableiten
 *   3. Hinweise wieder wegnehmen, solange das Rätsel ohne Raten lösbar bleibt
 *
 * Schritt 3 ist der wichtige. Geprüft wird mit einem Solver, der nur
 * ausschließt und nie probiert: Für jede Zeile und jede Spalte stehen die
 * Anordnungen zur Auswahl, die zu ihren Hinweisen passen; was die eine Richtung
 * für ein Feld ausschließt, fällt in der anderen ebenfalls weg. Bleibt am Ende
 * überall genau eine Höhe übrig, kommt auch ein Mensch ohne Raten dorthin.
 * Bleibt mehr übrig, war die Wegnahme zu viel und wird zurückgenommen.
 *
 * Derselbe Solver steckt im Spiel (`src/games/skyscrapers/logic.ts`);
 * `npm run check:skyscrapers` lässt ihn über die fertige Datei laufen. Änderungen
 * an den Regeln gehören also in beide Dateien – sonst schlägt die Prüfung an.
 */
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../src/games/skyscrapers/raetsel.json', import.meta.url);

/**
 * Die Reihenfolge in der Datei ist die Reihenfolge im Spiel: erst die kleinen
 * Gitter, dann die großen, und innerhalb jeder Größe erst die zahmen.
 *
 * `behalten` bremst das Ausdünnen: ein Rätsel gibt keine Hinweise mehr her,
 * sobald nur noch so viele übrig sind. Ohne die Bremse fällt jedes Rätsel so
 * knapp aus, wie es gerade noch lösbar ist – als Einstieg wäre das zu viel.
 */
const PLAN = [
  { n: 4, anzahl: 10, behalten: 8 },
  { n: 4, anzahl: 20, behalten: 0 },
  { n: 5, anzahl: 20, behalten: 11 },
  { n: 5, anzahl: 90, behalten: 0 },
  { n: 6, anzahl: 20, behalten: 14 },
  { n: 6, anzahl: 40, behalten: 0 },
];

/**
 * Fester Startwert: derselbe Lauf ergibt dieselbe Datei. Sonst verschöben sich
 * unter bestehenden Spielständen die Rätselnummern.
 */
const SEED = 20260908;

/** Kleiner, wiederholbarer Zufallsgenerator (mulberry32). */
function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = zufall(SEED);

const mische = (liste) => {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
};

/* ------------------------------------------------------------------ *
 * Regeln – dieselben wie in src/games/skyscrapers/logic.ts            *
 * ------------------------------------------------------------------ */

function sichtbar(reihe) {
  let hoechstes = 0;
  let anzahl = 0;
  for (const haus of reihe) {
    if (haus > hoechstes) {
      hoechstes = haus;
      anzahl++;
    }
  }
  return anzahl;
}

const permCache = new Map();

function permutationen(n) {
  const gemerkt = permCache.get(n);
  if (gemerkt) return gemerkt;

  const alle = [];
  const bauen = (rest, bisher) => {
    if (rest.length === 0) {
      alle.push(bisher);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      bauen([...rest.slice(0, i), ...rest.slice(i + 1)], [...bisher, rest[i]]);
    }
  };
  bauen(
    Array.from({ length: n }, (_, i) => i + 1),
    [],
  );

  permCache.set(n, alle);
  return alle;
}

const passt = (reihe, vorne, hinten) =>
  (vorne === 0 || sichtbar(reihe) === vorne) &&
  (hinten === 0 || sichtbar([...reihe].reverse()) === hinten);

const bitVon = (wert) => 1 << (wert - 1);

function masken(kandidaten, n) {
  const maske = Array(n).fill(0);
  for (const anordnung of kandidaten) {
    for (let i = 0; i < n; i++) maske[i] |= bitVon(anordnung[i]);
  }
  return maske;
}

/** Löst durch Ausschluss. Siehe Kopf der Datei. */
function loese(raetsel) {
  const { n } = raetsel;
  const alle = permutationen(n);

  let zeilen = Array.from({ length: n }, (_, r) =>
    alle.filter((p) => passt(p, raetsel.links[r], raetsel.rechts[r])),
  );
  let spalten = Array.from({ length: n }, (_, c) =>
    alle.filter((p) => passt(p, raetsel.oben[c], raetsel.unten[c])),
  );

  const summe = () =>
    zeilen.reduce((a, k) => a + k.length, 0) + spalten.reduce((a, k) => a + k.length, 0);

  let runden = 0;
  for (;;) {
    const vorher = summe();

    const spaltenMaske = spalten.map((k) => masken(k, n));
    zeilen = zeilen.map((kandidaten, r) =>
      kandidaten.filter((p) => p.every((wert, c) => (spaltenMaske[c][r] & bitVon(wert)) !== 0)),
    );
    if (zeilen.some((k) => k.length === 0)) return { art: 'leer' };

    const zeilenMaske = zeilen.map((k) => masken(k, n));
    spalten = spalten.map((kandidaten, c) =>
      kandidaten.filter((p) => p.every((wert, r) => (zeilenMaske[r][c] & bitVon(wert)) !== 0)),
    );
    if (spalten.some((k) => k.length === 0)) return { art: 'leer' };

    runden++;
    if (summe() === vorher) break;
  }

  if (zeilen.some((k) => k.length > 1)) return { art: 'offen' };
  return { art: 'geloest', gitter: zeilen.flatMap((k) => k[0]), runden };
}

/* ------------------------------------------------------------------ *
 * Erzeugung                                                           *
 * ------------------------------------------------------------------ */

/**
 * Ein zufälliges lateinisches Quadrat. Zeile für Zeile wird eine Anordnung
 * gesucht, die mit den schon gesetzten Spalten verträglich ist; geht keine
 * mehr, wird die vorige Zeile neu gezogen.
 */
function lateinischesQuadrat(n) {
  const alle = permutationen(n);
  const zeilen = [];

  const passtZuSpalten = (kandidat) =>
    zeilen.every((zeile) => zeile.every((wert, c) => wert !== kandidat[c]));

  const setzen = (tiefe) => {
    if (tiefe === n) return true;
    for (const kandidat of mische(alle)) {
      if (!passtZuSpalten(kandidat)) continue;
      zeilen.push(kandidat);
      if (setzen(tiefe + 1)) return true;
      zeilen.pop();
    }
    return false;
  };

  setzen(0);
  return zeilen.flat();
}

/** Alle 4n Hinweise zu einer Lösung. */
function hinweiseZu(gitter, n) {
  const zeile = (r) => gitter.slice(r * n, r * n + n);
  const spalte = (c) => Array.from({ length: n }, (_, r) => gitter[r * n + c]);

  return {
    oben: Array.from({ length: n }, (_, c) => sichtbar(spalte(c))),
    unten: Array.from({ length: n }, (_, c) => sichtbar([...spalte(c)].reverse())),
    links: Array.from({ length: n }, (_, r) => sichtbar(zeile(r))),
    rechts: Array.from({ length: n }, (_, r) => sichtbar([...zeile(r)].reverse())),
  };
}

const SEITEN = ['oben', 'unten', 'links', 'rechts'];

/**
 * Nimmt so lange Hinweise weg, wie das Rätsel ohne Raten lösbar bleibt. Die
 * Reihenfolge der Versuche ist zufällig – dieselbe Lösung ergibt so
 * unterschiedlich aussehende Rätsel.
 */
function ausduennen(loesung, n, behalten) {
  const raetsel = { n, ...hinweiseZu(loesung, n), loesung };
  let offen = 4 * n;

  const stellen = mische(SEITEN.flatMap((seite) => Array.from({ length: n }, (_, i) => [seite, i])));

  for (const [seite, i] of stellen) {
    if (offen <= behalten) break;

    const gemerkt = raetsel[seite][i];
    raetsel[seite][i] = 0;
    if (loese(raetsel).art === 'geloest') offen--;
    else raetsel[seite][i] = gemerkt;
  }

  return raetsel;
}

/** Erkennungszeichen eines Rätsels, damit dasselbe nicht zweimal auftaucht. */
const signatur = (raetsel) =>
  `${raetsel.n}|${SEITEN.map((seite) => raetsel[seite].join(',')).join('|')}`;

const gesehen = new Set();
const fertige = [];

for (const { n, anzahl, behalten } of PLAN) {
  const block = [];
  let versuche = 0;

  while (block.length < anzahl && versuche < anzahl * 40) {
    versuche++;

    const raetsel = ausduennen(lateinischesQuadrat(n), n, behalten);
    const kennung = signatur(raetsel);
    if (gesehen.has(kennung)) continue;

    const stand = loese(raetsel);
    if (stand.art !== 'geloest') continue;

    gesehen.add(kennung);
    const hinweise = SEITEN.reduce(
      (summe, seite) => summe + raetsel[seite].filter(Boolean).length,
      0,
    );
    block.push({ ...raetsel, runden: stand.runden, hinweise });
  }

  if (block.length < anzahl) {
    console.warn(`Nur ${block.length} von ${anzahl} Rätseln der Größe ${n}×${n} gefunden.`);
  }

  // Innerhalb einer Größe zuerst die zahmen: wenige Ausschlussrunden und viele
  // Hinweise heißt, dass sich die Felder fast von selbst ergeben.
  block.sort((a, b) => a.runden - b.runden || b.hinweise - a.hinweise);
  fertige.push(...block);

  const schnitt = (werte) => (werte.reduce((a, b) => a + b, 0) / werte.length).toFixed(1);
  console.log(
    `${n}×${n}${behalten ? ' (mit Bremse)' : ''}: ${block.length} Rätsel, im Schnitt ` +
      `${schnitt(block.map((e) => e.hinweise))} von ${4 * n} Hinweisen, ` +
      `${schnitt(block.map((e) => e.runden))} Ausschlussrunden`,
  );
}

const raetsel = fertige.map((eintrag, i) => ({
  id: i + 1,
  n: eintrag.n,
  oben: eintrag.oben,
  unten: eintrag.unten,
  links: eintrag.links,
  rechts: eintrag.rechts,
  loesung: eintrag.loesung,
}));

await writeFile(OUT, `${JSON.stringify({ raetsel })}\n`, 'utf8');

console.log(`${raetsel.length} Rätsel geschrieben nach ${OUT.pathname}`);
