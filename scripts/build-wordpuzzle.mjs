/**
 * Erzeugt die Level für "Wortsalat".
 *
 *   node scripts/build-wordpuzzle.mjs
 *
 * Ein Level besteht aus einem Grundwort, dessen Buchstaben gemischt auf dem
 * Rad liegen, und einem Kreuzworträtsel aus Wörtern, die sich daraus legen
 * lassen. Alles wird hier zur Bauzeit erzeugt: so ist jedes Level garantiert
 * lösbar, das Gitter passt aufs Handy, und beide Spieler bekommen dieselben
 * Rätsel.
 *
 * Quellen:
 *  - Wortliste des Wortspiels Tanglet, gespiegelt in kamilmielnik/
 *    scrabble-dictionaries. Sehr großzügig – taugt zum Akzeptieren von
 *    Eingaben, nicht zum Anzeigen.
 *  - Häufigkeitsliste aus hermitdave/FrequencyWords, um daraus die Wörter zu
 *    ziehen, die man tatsächlich kennt. Nur diese landen im Gitter.
 */
import { writeFile } from 'node:fs/promises';

const WORDLIST =
  'https://raw.githubusercontent.com/kamilmielnik/scrabble-dictionaries/master/german/german.txt';
const FREQUENCY =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt';

const OUT = new URL('../src/games/wordpuzzle/levels.json', import.meta.url);

const MIN_WORD = 3;
const MAX_WORD = 6;
/** So viele der häufigsten Wörter dürfen im Gitter erscheinen. */
const DISPLAY_POOL = 6000;
const LEVEL_COUNT = 120;

/**
 * Wörter, die zwar häufig vorkommen, aber in einem deutschen Worträtsel
 * nichts verloren haben: Vornamen und englische Einsprengsel aus den
 * Untertiteln, aus denen die Häufigkeitsliste stammt.
 */
const BLOCKLIST = new Set(
  `ADAM ALEX ANNA BEN BILL BOB CARL CHRIS DAVE DAVID EMMA ERIC FRANK HANS HARRY
   JACK JAKE JANE JIM JOE JOHN JOSH KAREN KATE LISA LUCY MARIA MARK MAX MIKE
   NICK OTTO PAUL PETER RICK ROSE SAM SARA SARAH SUE TED TOM TONY WILL
   ADIOS BABY BACK BAD BEST BIG BOY BYE CALL CASE CITY CLUB COOL COP COPS DAY
   DEAL DEAR DOG DOWN EASY END EVER EYE FACE FAIR FAST FBI FEEL FINE FIRE FUN
   GAME GIRL GOD GOOD GUY HAPPY HARD HEAD HEART HELL HELP HERO HIT HOME HOPE
   HOT JOB JOKE KID KILL KING KISS LADY LATE LIFE LIKE LINE LIVE LONG LOOK LOSE
   LOST LOVE LUCK MAN MEAN MIND MISS MONEY MORE MOVE NEWS NICE NIGHT NOW OKAY
   ONE OPEN OUT OVER OWN PARTY PLAY POOR POWER PUSH REAL RIGHT ROCK ROOM SAFE
   SHOP SHOW SIR SLOW SOFT SONG SORRY SOUL STAR STAY STOP SUMMER SURE TAKE TEAM
   TIME TOP TOUR TOWN TRUE TRY UP USE VERY WAIT WALK WAR WATCH WAY WEEK WELL
   WEST WILD WIN WISH WORK YEAH YES YOUNG ZERO
   AIDS MISTER MYLADY POINT SORRY OKAY`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Artikel, Pronomen, Präpositionen und Hilfsverben. Sie stehen ganz oben in
 * jeder Häufigkeitsliste, ergeben aber öde Rätsel – ein Gitter aus DIE, DER
 * und DEN macht keinen Spaß. Als Bonuswort zählen sie weiterhin, sie kommen
 * nur nicht ins Gitter und nie als Grundwort infrage.
 */
const FUNCTION_WORDS = new Set(
  `DER DIE DAS DEN DEM DES EIN EINE EINEN EINEM EINER EINES KEIN KEINE KEINEN
   ICH DU ER SIE ES WIR IHR MICH DICH SICH UNS EUCH MIR DIR IHM IHN IHNEN
   IHRE IHREN IHREM IHRER MEIN MEINE MEINEN MEINEM DEIN DEINE DEINEN DEINEM
   SEIN SEINE SEINEN SEINEM UNSER EUER DIESE DIESEN DIESEM DIESER
   UND ODER ABER DENN DOCH WEIL DASS WENN ALS WIE WAS WER WEM WEN WO WOHER
   AUF AUS BEI MIT NACH SEIT VON ZU ZUR ZUM IN AN AM IM VOR NEBEN ÜBER UNTER
   DURCH FÜR OHNE UM GEGEN BIS BEIM VOM ANS INS
   IST SIND WAR WAREN BIN BIST SEID HAT HABE HAST HABEN HATTE HATTEN HATTE
   WIRD WERDE WIRST WERDEN WURDE WURDEN KANN KANNST MUSS MUSST SOLL SOLLTE
   WILL WILLST WOLLTE MAG MÖCHTE DARF
   NICHT NUR AUCH NOCH SCHON DANN DA HIER DORT JA NEIN SEHR MEHR SO NUN
   ETWA ALLE ALLES ALLEN MAN ES DENEN DERER
   LES DES AMI ARE PER RAN VIA`
    .split(/\s+/)
    .filter(Boolean),
);

const LETTERS = /^[A-ZÄÖÜ]+$/;

/** Deterministischer Zufall, damit dieselbe Liste dieselben Level ergibt. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

async function fetchLines(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return (await response.text()).split(/\r?\n/);
}

/** Buchstabenvorrat eines Wortes als Zähl-Objekt. */
function letterCounts(word) {
  const counts = {};
  for (const ch of word) counts[ch] = (counts[ch] ?? 0) + 1;
  return counts;
}

/** Lässt sich `word` aus dem Vorrat von `base` legen? */
function fitsInto(word, baseCounts) {
  const need = letterCounts(word);
  for (const ch of Object.keys(need)) {
    if ((baseCounts[ch] ?? 0) < need[ch]) return false;
  }
  return true;
}

// ---------------------------------------------------------------- Gitterbau

/**
 * Prüft, ob `word` an (row, col) in Richtung `dir` liegen darf, und zählt die
 * Kreuzungen. Regeln wie beim klassischen Kreuzworträtsel: gleiche Buchstaben
 * an Kreuzungen, keine parallel anliegenden Wörter, und vor und hinter dem
 * Wort muss Platz sein, damit keine ungewollten längeren Wörter entstehen.
 */
function tryPlace(cells, word, row, col, dir) {
  const dr = dir === 'v' ? 1 : 0;
  const dc = dir === 'h' ? 1 : 0;
  let crossings = 0;

  // Direkt vor und hinter dem Wort muss frei sein.
  if (cells.has(`${row - dr},${col - dc}`)) return null;
  if (cells.has(`${row + dr * word.length},${col + dc * word.length}`)) return null;

  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = cells.get(`${r},${c}`);

    if (existing) {
      if (existing !== word[i]) return null;
      crossings++;
      continue;
    }

    // Seitliche Nachbarn müssen frei sein, sonst stünden zwei Wörter
    // aneinandergeklebt nebeneinander.
    const sideA = dir === 'h' ? `${r - 1},${c}` : `${r},${c - 1}`;
    const sideB = dir === 'h' ? `${r + 1},${c}` : `${r},${c + 1}`;
    if (cells.has(sideA) || cells.has(sideB)) return null;
  }

  return crossings;
}

function place(cells, word, row, col, dir) {
  const dr = dir === 'v' ? 1 : 0;
  const dc = dir === 'h' ? 1 : 0;
  for (let i = 0; i < word.length; i++) {
    cells.set(`${row + dr * i},${col + dc * i}`, word[i]);
  }
}

/**
 * Baut ein Kreuzworträtsel aus `words`. Das erste Wort liegt waagerecht in
 * der Mitte, jedes weitere muss ein bereits liegendes kreuzen. Von allen
 * erlaubten Positionen gewinnt die mit der kleinsten Fläche – so bleibt das
 * Gitter kompakt genug für ein Handydisplay.
 */
function buildCrossword(words) {
  const cells = new Map();
  const placed = [];

  place(cells, words[0], 0, 0, 'h');
  placed.push({ word: words[0], row: 0, col: 0, dir: 'h' });

  for (const word of words.slice(1)) {
    let best = null;

    for (const anchor of placed) {
      for (let ai = 0; ai < anchor.word.length; ai++) {
        for (let wi = 0; wi < word.length; wi++) {
          if (anchor.word[ai] !== word[wi]) continue;

          // Kreuzende Wörter laufen quer zum Ankerwort.
          const dir = anchor.dir === 'h' ? 'v' : 'h';
          const anchorRow = anchor.row + (anchor.dir === 'v' ? ai : 0);
          const anchorCol = anchor.col + (anchor.dir === 'h' ? ai : 0);
          const row = anchorRow - (dir === 'v' ? wi : 0);
          const col = anchorCol - (dir === 'h' ? wi : 0);

          const crossings = tryPlace(cells, word, row, col, dir);
          if (crossings === null || crossings === 0) continue;

          const rows = [...cells.keys()].map((k) => Number(k.split(',')[0]));
          const cols = [...cells.keys()].map((k) => Number(k.split(',')[1]));
          const height =
            Math.max(...rows, row + (dir === 'v' ? word.length - 1 : 0)) -
            Math.min(...rows, row) +
            1;
          const width =
            Math.max(...cols, col + (dir === 'h' ? word.length - 1 : 0)) -
            Math.min(...cols, col) +
            1;
          const score = Math.max(width, height) * 100 + width * height - crossings;

          if (!best || score < best.score) best = { row, col, dir, score };
        }
      }
    }

    if (!best) return null;
    place(cells, word, best.row, best.col, best.dir);
    placed.push({ word, row: best.row, col: best.col, dir: best.dir });
  }

  // Auf den Ursprung schieben, damit die Koordinaten bei 0 beginnen.
  const rows = [...cells.keys()].map((k) => Number(k.split(',')[0]));
  const cols = [...cells.keys()].map((k) => Number(k.split(',')[1]));
  const minRow = Math.min(...rows);
  const minCol = Math.min(...cols);

  return {
    width: Math.max(...cols) - minCol + 1,
    height: Math.max(...rows) - minRow + 1,
    words: placed.map((p) => ({
      word: p.word,
      row: p.row - minRow,
      col: p.col - minCol,
      dir: p.dir,
    })),
  };
}

// ------------------------------------------------------------------- Ablauf

const [rawWords, rawFrequency] = await Promise.all([fetchLines(WORDLIST), fetchLines(FREQUENCY)]);

const accept = new Set();
for (const line of rawWords) {
  const word = line.trim().toUpperCase();
  if (word.length >= MIN_WORD && word.length <= MAX_WORD && LETTERS.test(word)) accept.add(word);
}

/** Häufige Wörter in absteigender Häufigkeit – nur diese kommen ins Gitter. */
const display = [];
const displaySet = new Set();
for (const line of rawFrequency) {
  const word = (line.split(' ')[0] ?? '').trim().toUpperCase();
  if (!accept.has(word) || displaySet.has(word)) continue;
  if (BLOCKLIST.has(word) || FUNCTION_WORDS.has(word)) continue;
  display.push(word);
  displaySet.add(word);
  if (display.length >= DISPLAY_POOL) break;
}

const rank = new Map(display.map((word, index) => [word, index]));

console.log(`Akzeptiert: ${accept.size} Wörter, Anzeigepool: ${display.length}`);

/**
 * Grundwörter: möglichst gängige Wörter, die genug Teilwörter hergeben.
 * Zu viele Teilwörter machen das Gitter unübersichtlich, zu wenige langweilig.
 */
const GRID_CAP = { 3: 3, 4: 5, 5: 7, 6: 8 };

function buildLevel(base) {
  const baseCounts = letterCounts(base);

  const candidates = display.filter(
    (word) => word.length >= MIN_WORD && word.length <= base.length && fitsInto(word, baseCounts),
  );
  if (candidates.length < 3) return null;

  // Ins Gitter kommen das Grundwort und die gängigsten Teilwörter, lange
  // zuerst – lange Wörter kreuzen sich leichter.
  const rest = candidates
    .filter((word) => word !== base)
    .sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9))
    .slice(0, GRID_CAP[base.length] - 1)
    .sort((a, b) => b.length - a.length);

  const grid = buildCrossword([base, ...rest]);
  if (!grid) return null;
  // Auf dem Handy soll das Gitter ohne Scrollen lesbar bleiben.
  if (grid.width > 9 || grid.height > 9) return null;

  const gridWords = new Set(grid.words.map((w) => w.word));

  // Alles Übrige, was sich legen lässt, zählt als Bonuswort. Dafür darf die
  // großzügige Liste ran – gefunden werden darf mehr, als angezeigt wird.
  const bonus = [...accept].filter(
    (word) =>
      word.length >= MIN_WORD &&
      word.length <= base.length &&
      !gridWords.has(word) &&
      fitsInto(word, baseCounts),
  );

  return { letters: base, width: grid.width, height: grid.height, words: grid.words, bonus };
}

/**
 * Schwierigkeit steigt: kurze Grundwörter zuerst, später sechs Buchstaben.
 * Bei drei Buchstaben fängt es nicht an – dafür bräuchte es Grundwörter mit
 * mehreren Anagrammen (TOR/ORT/ROT), und davon gibt es zu wenige.
 */
function lengthForLevel(index) {
  if (index < 12) return 4;
  if (index < 45) return 5;
  return 6;
}

const random = makeRandom(20260906);
const levels = [];
const used = new Set();

// Aus den häufigsten Wörtern je Länge ziehen, leicht durchmischt, damit nicht
// alle Level mit denselben Buchstaben anfangen.
const poolByLength = {};
for (const length of [3, 4, 5, 6]) {
  const pool = display.filter((word) => word.length === length).slice(0, 1200);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  poolByLength[length] = pool;
}

const cursor = { 3: 0, 4: 0, 5: 0, 6: 0 };

while (levels.length < LEVEL_COUNT) {
  const length = lengthForLevel(levels.length);
  const pool = poolByLength[length];
  if (cursor[length] >= pool.length) {
    console.warn(`Keine Grundwörter mehr für Länge ${length}, bei Level ${levels.length + 1}.`);
    break;
  }

  const base = pool[cursor[length]++];
  if (used.has(base)) continue;

  const level = buildLevel(base);
  if (!level) continue;

  used.add(base);
  levels.push({ id: levels.length + 1, ...level });
}

await writeFile(OUT, JSON.stringify(levels));

const sizes = levels.map((l) => l.words.length);
const bonuses = levels.map((l) => l.bonus.length);
console.log(
  `${levels.length} Level geschrieben. ` +
    `Gitterwörter ${Math.min(...sizes)}–${Math.max(...sizes)}, ` +
    `Bonuswörter ${Math.min(...bonuses)}–${Math.max(...bonuses)}.`,
);
