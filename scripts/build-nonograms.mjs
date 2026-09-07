/**
 * Erzeugt die Bilder für "Bildgitter" (Nonogramm).
 *
 *   node scripts/build-nonograms.mjs
 *
 * Anders als bei den übrigen Spielen wird hier nichts gewürfelt: Die Bilder
 * sind von Hand gezeichnet und stehen weiter unten als Zeichenraster. Ein
 * zufälliges Muster wäre am Ende auch nur ein zufälliges Muster – der Reiz
 * liegt darin, dass nach dem letzten Feld etwas dasteht, das man erkennt.
 *
 * Neue Bilder kommen einfach in die Liste. Das Skript prüft dann selbst:
 *
 *   1. Sind es n Zeilen mit je n Zeichen?
 *   2. Geht das Bild allein mit Zeilenlogik auf, ohne zu raten?
 *
 * Für Schritt 2 läuft derselbe Solver wie im Spiel: Er zählt für jede Reihe
 * alle Muster auf, die zu ihren Zahlen passen, siebt die aus, die dem schon
 * Bekannten widersprechen, und übernimmt, was in allen übrigen gleich ist.
 *
 * Bleibt danach etwas unklar, wird das Bild nicht verworfen – es bekommt eine
 * Starthilfe: So lange einzelne Felder aufgedeckt, bis der Solver durchkommt.
 * Sonst müsste man beim Zeichnen ständig gegen den Solver arbeiten, statt ein
 * Bild zu zeichnen.
 */
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../src/games/nonogram/bilder.json', import.meta.url);

/* ------------------------------------------------------------------ *
 * Die Bilder. '#' ist gefüllt, '.' ist leer.                          *
 * ------------------------------------------------------------------ */

const BILDER = [
  // ---------------------------------------------------------- 5×5
  {
    name: 'Herz',
    zeilen: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  },
  {
    name: 'Kreuz',
    zeilen: ['..#..', '..#..', '#####', '..#..', '..#..'],
  },
  {
    name: 'Raute',
    zeilen: ['..#..', '.###.', '#####', '.###.', '..#..'],
  },
  {
    name: 'Baum',
    zeilen: ['..#..', '.###.', '#####', '..#..', '..#..'],
  },
  {
    name: 'Haus',
    zeilen: ['..#..', '.###.', '#####', '#...#', '#.#.#'],
  },
  {
    name: 'Pfeil',
    zeilen: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  },
  {
    name: 'Stern',
    zeilen: ['..#..', '#####', '.###.', '.#.#.', '#...#'],
  },
  {
    name: 'Mond',
    zeilen: ['.###.', '##...', '##...', '##...', '.###.'],
  },
  {
    name: 'Glas',
    zeilen: ['#####', '#####', '.###.', '.###.', '..#..'],
  },
  {
    name: 'Anker',
    zeilen: ['..#..', '.#.#.', '..#..', '#.#.#', '.###.'],
  },
  {
    name: 'Schachbrett',
    zeilen: ['#.#.#', '.#.#.', '#.#.#', '.#.#.', '#.#.#'],
  },
  {
    name: 'Blitz',
    zeilen: ['...##', '..##.', '.####', '.##..', '##...'],
  },

  // ---------------------------------------------------------- 8×8
  {
    name: 'Segelboot',
    zeilen: [
      '...#....',
      '...##...',
      '...###..',
      '...####.',
      '...#####',
      '........',
      '########',
      '.######.',
    ],
  },
  {
    name: 'Herz',
    zeilen: [
      '........',
      '.##..##.',
      '########',
      '########',
      '########',
      '.######.',
      '..####..',
      '...##...',
    ],
  },
  {
    name: 'Regenschirm',
    zeilen: [
      '...##...',
      '.######.',
      '########',
      '##.##.##',
      '...##...',
      '...##...',
      '...##...',
      '...##...',
    ],
  },
  {
    name: 'Kerze',
    zeilen: [
      '....#...',
      '...##...',
      '..####..',
      '..####..',
      '..####..',
      '..####..',
      '..####..',
      '.######.',
    ],
  },
  {
    name: 'Stern',
    zeilen: [
      '...##...',
      '...##...',
      '########',
      '.######.',
      '..####..',
      '.######.',
      '.##..##.',
      '##....##',
    ],
  },
  {
    name: 'Pilz',
    zeilen: [
      '..####..',
      '.######.',
      '########',
      '########',
      '..####..',
      '...##...',
      '...##...',
      '..####..',
    ],
  },
  {
    name: 'Haus',
    zeilen: [
      '...##...',
      '..####..',
      '.######.',
      '########',
      '#......#',
      '#.####.#',
      '#.#..#.#',
      '#.#..#.#',
    ],
  },
  {
    name: 'Baum',
    zeilen: [
      '...##...',
      '..####..',
      '.######.',
      '########',
      '.######.',
      '..####..',
      '...##...',
      '...##...',
    ],
  },
  {
    name: 'Anker',
    zeilen: [
      '...##...',
      '..#..#..',
      '...##...',
      '.######.',
      '...##...',
      '#..##..#',
      '#.####.#',
      '.######.',
    ],
  },
  {
    name: 'Tasse',
    zeilen: [
      '........',
      '######..',
      '#....#..',
      '#....###',
      '#....#.#',
      '#....###',
      '######..',
      '........',
    ],
  },
  {
    name: 'Krone',
    zeilen: [
      '........',
      '#..##..#',
      '#.####.#',
      '########',
      '########',
      '########',
      '.######.',
      '........',
    ],
  },
  {
    name: 'Smiley',
    zeilen: [
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '#.####.#',
      '##....##',
      '.######.',
      '..####..',
    ],
  },

  // -------------------------------------------------------- 10×10
  {
    name: 'Schneemann',
    zeilen: [
      '...####...',
      '..#....#..',
      '..#.##.#..',
      '..#....#..',
      '...####...',
      '..######..',
      '.##....##.',
      '.#......#.',
      '.#......#.',
      '..######..',
    ],
  },
  {
    name: 'Rakete',
    zeilen: [
      '....##....',
      '...####...',
      '...####...',
      '...####...',
      '..######..',
      '.########.',
      '.##.##.##.',
      '....##....',
      '...####...',
      '....##....',
    ],
  },
  {
    name: 'Segelboot',
    zeilen: [
      '....#.....',
      '....##....',
      '....###...',
      '....####..',
      '....#####.',
      '....######',
      '..........',
      '##########',
      '.########.',
      '..######..',
    ],
  },
  {
    name: 'Herz',
    zeilen: [
      '..........',
      '.##....##.',
      '####..####',
      '##########',
      '##########',
      '##########',
      '.########.',
      '..######..',
      '...####...',
      '....##....',
    ],
  },
  {
    name: 'Tannenbaum',
    zeilen: [
      '....##....',
      '...####...',
      '..######..',
      '.########.',
      '..######..',
      '.########.',
      '##########',
      '....##....',
      '....##....',
      '..######..',
    ],
  },
  {
    name: 'Blume',
    zeilen: [
      '...####...',
      '..######..',
      '.###..###.',
      '.##.##.##.',
      '.###..###.',
      '..######..',
      '...####...',
      '....##....',
      '...####...',
      '....##....',
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Regeln – dieselben wie in src/games/nonogram/logic.ts               *
 * ------------------------------------------------------------------ */

function blockLaengen(reihe) {
  const laengen = [];
  let lauf = 0;
  for (const gefuellt of reihe) {
    if (gefuellt) lauf++;
    else if (lauf > 0) {
      laengen.push(lauf);
      lauf = 0;
    }
  }
  if (lauf > 0) laengen.push(lauf);
  return laengen.length > 0 ? laengen : [0];
}

function hinweise(zellen, n) {
  const voll = (r, c) => zellen[r * n + c] === '1';
  return {
    zeilen: Array.from({ length: n }, (_, r) =>
      blockLaengen(Array.from({ length: n }, (_, c) => voll(r, c))),
    ),
    spalten: Array.from({ length: n }, (_, c) =>
      blockLaengen(Array.from({ length: n }, (_, r) => voll(r, c))),
    ),
  };
}

function muster(zahlen, laenge) {
  const bloecke = zahlen.filter((zahl) => zahl > 0);
  const alle = [];

  const legen = (rest, ab, bisher) => {
    if (rest.length === 0) {
      alle.push([...bisher, ...Array(laenge - bisher.length).fill(false)]);
      return;
    }

    const [block, ...weitere] = rest;
    const platz = weitere.reduce((summe, zahl) => summe + zahl + 1, 0);

    for (let start = ab; start + block + platz <= laenge; start++) {
      const zeile = [...bisher];
      while (zeile.length < start) zeile.push(false);
      for (let i = 0; i < block; i++) zeile.push(true);
      if (weitere.length > 0) zeile.push(false);
      legen(weitere, zeile.length, zeile);
    }
  };

  legen(bloecke, 0, []);
  return alle;
}

/** Löst allein mit Zeilenlogik. Siehe Kopf der Datei. */
function loese(zellen, n, vorgabe) {
  const zahlen = hinweise(zellen, n);

  const wissen = Array(n * n).fill(-1);
  for (const feld of vorgabe) wissen[feld] = zellen[feld] === '1' ? 1 : 0;

  const zeilenMuster = zahlen.zeilen.map((z) => muster(z, n));
  const spaltenMuster = zahlen.spalten.map((z) => muster(z, n));

  const felderVon = (art, i) =>
    Array.from({ length: n }, (_, k) => (art === 'zeile' ? i * n + k : k * n + i));

  let runden = 0;
  for (;;) {
    let geaendert = false;
    runden++;

    for (const art of ['zeile', 'spalte']) {
      const alle = art === 'zeile' ? zeilenMuster : spaltenMuster;

      for (let i = 0; i < n; i++) {
        const felder = felderVon(art, i);
        const passend = alle[i].filter((kandidat) =>
          kandidat.every((gefuellt, k) => {
            const bekannt = wissen[felder[k]];
            return bekannt === -1 || bekannt === (gefuellt ? 1 : 0);
          }),
        );
        alle[i] = passend;

        for (let k = 0; k < n; k++) {
          if (wissen[felder[k]] !== -1) continue;
          const erstes = passend[0]?.[k];
          if (erstes === undefined) continue;
          if (passend.every((kandidat) => kandidat[k] === erstes)) {
            wissen[felder[k]] = erstes ? 1 : 0;
            geaendert = true;
          }
        }
      }
    }

    if (!geaendert) break;
  }

  const unklar = wissen.map((wert, feld) => (wert === -1 ? feld : -1)).filter((feld) => feld >= 0);
  return { unklar, runden };
}

/* ------------------------------------------------------------------ *
 * Erzeugung                                                           *
 * ------------------------------------------------------------------ */

const bilder = [];

for (const [i, entwurf] of BILDER.entries()) {
  const n = entwurf.zeilen.length;

  const schief = entwurf.zeilen.filter((zeile) => zeile.length !== n);
  if (schief.length > 0) {
    throw new Error(
      `Bild ${i + 1} (${entwurf.name}): ${n} Zeilen, aber eine davon hat ` +
        `${schief[0].length} Zeichen statt ${n}.`,
    );
  }

  const erlaubt = entwurf.zeilen.join('').replace(/[#.]/g, '');
  if (erlaubt.length > 0) {
    throw new Error(`Bild ${i + 1} (${entwurf.name}): "${erlaubt[0]}" ist kein # und kein .`);
  }

  const zellen = entwurf.zeilen.join('').replace(/#/g, '1').replace(/\./g, '0');
  if (!zellen.includes('1')) {
    throw new Error(`Bild ${i + 1} (${entwurf.name}): kein einziges gefülltes Feld.`);
  }

  // So wenig Starthilfe wie möglich: immer nur das erste unklare Feld
  // aufdecken und dann neu schauen, was sich daraus ergibt.
  let starthilfe = [];
  let stand = loese(zellen, n, starthilfe);
  while (stand.unklar.length > 0) {
    starthilfe.push(stand.unklar[0]);
    stand = loese(zellen, n, starthilfe);
  }

  // Ein später aufgedecktes Feld kann ein früheres überflüssig machen. Was sich
  // wieder wegnehmen lässt, wird weggenommen – jedes geschenkte Feld ist eines
  // weniger zum Denken.
  for (const feld of [...starthilfe]) {
    const ohne = starthilfe.filter((anderes) => anderes !== feld);
    if (loese(zellen, n, ohne).unklar.length === 0) starthilfe = ohne;
  }

  bilder.push({ id: bilder.length + 1, name: entwurf.name, n, zellen, starthilfe });
}

// Kleine Gitter zuerst; innerhalb einer Größe bleibt die Reihenfolge von oben.
bilder.sort((a, b) => a.n - b.n);
bilder.forEach((bild, i) => {
  bild.id = i + 1;
});

await writeFile(OUT, `${JSON.stringify({ bilder })}\n`, 'utf8');

const groessen = [...new Set(bilder.map((bild) => bild.n))];
for (const n of groessen) {
  const block = bilder.filter((bild) => bild.n === n);
  const mitHilfe = block.filter((bild) => bild.starthilfe.length > 0);
  console.log(
    `${n}×${n}: ${block.length} Bilder, ${mitHilfe.length} mit Starthilfe` +
      (mitHilfe.length > 0
        ? ` (${mitHilfe.map((bild) => `${bild.name} ${bild.starthilfe.length}`).join(', ')})`
        : ''),
  );
}
console.log(`${bilder.length} Bilder geschrieben nach ${OUT.pathname}`);
