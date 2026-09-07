/**
 * Erzeugt die Rätsel für "Brücken" (Hashiwokakero).
 *
 *   node scripts/build-bridges.mjs
 *
 * Ein Rätsel entsteht rückwärts: Statt Zahlen zu würfeln und zu hoffen, dass
 * ein Netz dazu passt, wächst hier erst das Netz. Von einer Startinsel aus wird
 * immer wieder eine bestehende Insel gegriffen, in eine Richtung weitergebaut
 * und dort eine neue Insel gesetzt – mit einer oder zwei Brücken dazwischen.
 * Die Zahlen fallen am Ende einfach ab: Auf jeder Insel steht, was dort
 * angekommen ist.
 *
 * Damit ist die Lösung von vornherein gültig: Sie kreuzt sich nicht, sie läuft
 * über keine Insel hinweg, und sie hängt zusammen. Offen bleibt die Frage, ob
 * sie die einzige ist. Das prüft derselbe Grenzen-Solver wie im Spiel: Er führt
 * je Verbindung eine Ober- und Untergrenze und schiebt sie zusammen. Fallen am
 * Ende alle Grenzen aufeinander, geht das Rätsel ohne Raten auf; sonst wird es
 * verworfen und das nächste gebaut.
 *
 * Zwei Inseln stehen nie direkt nebeneinander: Zwischen ihnen bliebe kein Platz
 * für eine Brücke, und im Gitter sähen sie aus wie eine.
 */
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../src/games/bridges/raetsel.json', import.meta.url);

/**
 * Die Reihenfolge in der Datei ist die Reihenfolge im Spiel: erst das kleine
 * Gitter, dann das große, und innerhalb einer Größe erst die zahmen.
 */
const PLAN = [
  { n: 7, inseln: 9, anzahl: 40 },
  { n: 7, inseln: 12, anzahl: 30 },
  { n: 9, inseln: 16, anzahl: 50 },
  { n: 9, inseln: 20, anzahl: 30 },
];

/** Fester Startwert: derselbe Lauf ergibt dieselbe Datei. */
const SEED = 20260909;

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
const wuerfel = (hoechstens) => Math.floor(rng() * hoechstens);
const mische = (liste) => {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = wuerfel(i + 1);
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
};

/* ------------------------------------------------------------------ *
 * Regeln – dieselben wie in src/games/bridges/logic.ts                *
 * ------------------------------------------------------------------ */

function kanten(raetsel) {
  const { inseln } = raetsel;
  const liste = [];

  const dazwischen = (a, b, waagerecht) =>
    inseln.some((insel) =>
      waagerecht
        ? insel.r === a.r && insel.c > Math.min(a.c, b.c) && insel.c < Math.max(a.c, b.c)
        : insel.c === a.c && insel.r > Math.min(a.r, b.r) && insel.r < Math.max(a.r, b.r),
    );

  for (let a = 0; a < inseln.length; a++) {
    for (let b = a + 1; b < inseln.length; b++) {
      const eins = inseln[a];
      const zwei = inseln[b];
      if (eins.r === zwei.r && !dazwischen(eins, zwei, true)) {
        liste.push({ a, b, waagerecht: true });
      } else if (eins.c === zwei.c && !dazwischen(eins, zwei, false)) {
        liste.push({ a, b, waagerecht: false });
      }
    }
  }

  return liste;
}

function kreuzen(inseln, eins, zwei) {
  if (eins.waagerecht === zwei.waagerecht) return false;

  const quer = eins.waagerecht ? eins : zwei;
  const hoch = eins.waagerecht ? zwei : eins;

  const zeile = inseln[quer.a].r;
  const spalte = inseln[hoch.a].c;
  const links = Math.min(inseln[quer.a].c, inseln[quer.b].c);
  const rechts = Math.max(inseln[quer.a].c, inseln[quer.b].c);
  const oben = Math.min(inseln[hoch.a].r, inseln[hoch.b].r);
  const unten = Math.max(inseln[hoch.a].r, inseln[hoch.b].r);

  return spalte > links && spalte < rechts && zeile > oben && zeile < unten;
}

function loese(raetsel) {
  const alle = kanten(raetsel);
  const imWeg = alle.map((eins, i) =>
    alle.map((zwei, k) => (k !== i && kreuzen(raetsel.inseln, eins, zwei) ? k : -1)).filter((k) => k >= 0),
  );
  const anInsel = raetsel.inseln.map((_, i) =>
    alle.map((kante, k) => (kante.a === i || kante.b === i ? k : -1)).filter((k) => k >= 0),
  );

  const unten = alle.map(() => 0);
  const oben = alle.map(() => 2);

  let runden = 0;
  for (;;) {
    let geaendert = false;
    runden++;

    for (let insel = 0; insel < raetsel.inseln.length; insel++) {
      const grad = raetsel.inseln[insel].grad;
      const meine = anInsel[insel];

      const summeUnten = meine.reduce((summe, k) => summe + unten[k], 0);
      const summeOben = meine.reduce((summe, k) => summe + oben[k], 0);
      if (summeUnten > grad || summeOben < grad) return { art: 'leer' };

      for (const k of meine) {
        const neuUnten = Math.max(unten[k], grad - (summeOben - oben[k]));
        const neuOben = Math.min(oben[k], grad - (summeUnten - unten[k]));
        if (neuUnten > neuOben) return { art: 'leer' };
        if (neuUnten !== unten[k] || neuOben !== oben[k]) {
          unten[k] = neuUnten;
          oben[k] = neuOben;
          geaendert = true;
        }
      }
    }

    for (let k = 0; k < alle.length; k++) {
      if (unten[k] === 0) continue;
      for (const quer of imWeg[k]) {
        if (oben[quer] === 0) continue;
        if (unten[quer] > 0) return { art: 'leer' };
        oben[quer] = 0;
        geaendert = true;
      }
    }

    if (!geaendert) break;
  }

  if (alle.some((_, k) => unten[k] !== oben[k])) return { art: 'offen' };
  return { art: 'geloest', werte: [...unten], runden, kanten: alle };
}

/* ------------------------------------------------------------------ *
 * Erzeugung                                                           *
 * ------------------------------------------------------------------ */

const RICHTUNGEN = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Lässt ein Netz wachsen und gibt Inseln samt Brücken zurück – oder null, wenn
 * es sich festgefahren hat.
 */
function baueNetz(n, ziel) {
  // Was jede Zelle belegt: 'insel', 'quer' oder 'hoch'. Eine Brücke darf nur
  // über freie Zellen laufen, sonst kreuzte sie etwas.
  const belegt = new Map();
  const schluessel = (r, c) => `${r},${c}`;

  const inseln = [{ r: 1 + wuerfel(n - 2), c: 1 + wuerfel(n - 2), grad: 0 }];
  belegt.set(schluessel(inseln[0].r, inseln[0].c), 'insel');
  const bruecken = [];

  /** Eine neue Insel darf keine direkte Nachbarzelle einer Insel sein. */
  const zuNah = (r, c) =>
    RICHTUNGEN.some(([dr, dc]) => belegt.get(schluessel(r + dr, c + dc)) === 'insel');

  let versuche = 0;
  while (inseln.length < ziel && versuche < ziel * 200) {
    versuche++;

    const von = wuerfel(inseln.length);
    const start = inseln[von];
    const [dr, dc] = RICHTUNGEN[wuerfel(4)];
    const laenge = 2 + wuerfel(3);

    const r = start.r + dr * laenge;
    const c = start.c + dc * laenge;
    if (r < 0 || r >= n || c < 0 || c >= n) continue;
    if (belegt.has(schluessel(r, c)) || zuNah(r, c)) continue;

    // Der Weg dazwischen muss völlig frei sein.
    const weg = [];
    for (let schritt = 1; schritt < laenge; schritt++) {
      weg.push([start.r + dr * schritt, start.c + dc * schritt]);
    }
    if (weg.some(([wr, wc]) => belegt.has(schluessel(wr, wc)))) continue;

    const anzahl = 1 + wuerfel(2);
    if (start.grad + anzahl > 8) continue;

    const neue = { r, c, grad: anzahl };
    inseln.push(neue);
    start.grad += anzahl;

    belegt.set(schluessel(r, c), 'insel');
    for (const [wr, wc] of weg) belegt.set(schluessel(wr, wc), dr === 0 ? 'quer' : 'hoch');
    bruecken.push({ a: von, b: inseln.length - 1, anzahl });
  }

  return inseln.length === ziel ? { inseln, bruecken } : null;
}

/** Die Lösung in der Reihenfolge, die `kanten` liefert. */
function loesungFuer(raetsel, bruecken) {
  const alle = kanten(raetsel);
  return alle.map((kante) => {
    const treffer = bruecken.find(
      (bruecke) =>
        (bruecke.a === kante.a && bruecke.b === kante.b) ||
        (bruecke.a === kante.b && bruecke.b === kante.a),
    );
    return treffer ? treffer.anzahl : 0;
  });
}

/** Erkennungszeichen, damit dasselbe Rätsel nicht zweimal auftaucht. */
const signatur = (raetsel) =>
  `${raetsel.n}|${raetsel.inseln.map((i) => `${i.r}.${i.c}.${i.grad}`).join(' ')}`;

const gesehen = new Set();
const fertige = [];

for (const { n, inseln: ziel, anzahl } of PLAN) {
  const block = [];
  let versuche = 0;

  while (block.length < anzahl && versuche < anzahl * 400) {
    versuche++;

    const netz = baueNetz(n, ziel);
    if (!netz) continue;

    // Inseln von oben links nach unten rechts: so steht die Reihenfolge fest,
    // unabhängig davon, wie das Netz gewachsen ist.
    const sortiert = [...netz.inseln]
      .map((insel, i) => ({ insel, i }))
      .sort((x, y) => x.insel.r - y.insel.r || x.insel.c - y.insel.c);
    const neuerIndex = new Map(sortiert.map(({ i }, platz) => [i, platz]));

    const raetsel = {
      n,
      inseln: sortiert.map(({ insel }) => insel),
      loesung: [],
    };
    const bruecken = netz.bruecken.map((bruecke) => ({
      a: neuerIndex.get(bruecke.a),
      b: neuerIndex.get(bruecke.b),
      anzahl: bruecke.anzahl,
    }));

    const kennung = signatur(raetsel);
    if (gesehen.has(kennung)) continue;

    const stand = loese(raetsel);
    if (stand.art !== 'geloest') continue;

    const soll = loesungFuer(raetsel, bruecken);
    if (stand.werte.join(',') !== soll.join(',')) {
      throw new Error('Der Solver findet eine andere Lösung als die gebaute.');
    }

    gesehen.add(kennung);
    // Verbindungen, die möglich wären, aber in der Lösung leer bleiben. Ohne
    // solche Ablenker ergibt sich jede Brücke von selbst und es bleibt nichts
    // zu entscheiden.
    const ablenker = soll.length - soll.filter(Boolean).length;
    block.push({ ...raetsel, loesung: soll, runden: stand.runden, ablenker });
  }

  if (block.length < anzahl) {
    console.warn(`Nur ${block.length} von ${anzahl} Rätseln (${n}×${n}, ${ziel} Inseln) gefunden.`);
  }

  block.sort((a, b) => a.ablenker - b.ablenker || a.runden - b.runden);
  fertige.push(...block);

  const schnitt = (werte) => (werte.reduce((a, b) => a + b, 0) / werte.length).toFixed(1);
  console.log(
    `${n}×${n} mit ${ziel} Inseln: ${block.length} Rätsel, ` +
      `${schnitt(block.map((e) => e.runden))} Grenzrunden und ` +
      `${schnitt(block.map((e) => e.ablenker))} Ablenker im Schnitt`,
  );
}

const raetsel = fertige.map((eintrag, i) => ({
  id: i + 1,
  n: eintrag.n,
  inseln: eintrag.inseln,
  loesung: eintrag.loesung,
}));

await writeFile(OUT, `${JSON.stringify({ raetsel })}\n`, 'utf8');
console.log(`${raetsel.length} Rätsel geschrieben nach ${OUT.pathname}`);
