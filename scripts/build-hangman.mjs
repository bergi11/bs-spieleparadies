/**
 * Erzeugt die Wortliste für "Galgenmännchen".
 *
 *   node scripts/build-hangman.mjs
 *
 * Gesucht sind Hauptwörter, die man ohne Nachdenken kennt und die sich Buchstabe
 * für Buchstabe erraten lassen. Die Liste entsteht aus drei Quellen:
 *
 *  - Wiktionary-Substantive aus gambolputty/german-nouns (MIT, Daten CC BY-SA).
 *    Liefert die Wortart und die Beugung – daran erkennen wir, was wirklich ein
 *    Hauptwort ist und was nur zufällig groß geschrieben wird.
 *  - Wortliste des Wortspiels Tanglet, gespiegelt in kamilmielnik/
 *    scrabble-dictionaries. Sie enthält keine Eigennamen, sortiert also Städte
 *    und Vornamen aus, die in Wiktionary zusätzlich als Substantiv stehen.
 *  - Häufigkeitsliste aus hermitdave/FrequencyWords für die Reihenfolge: nur die
 *    geläufigsten Wörter kommen ins Spiel.
 *
 * Wie bei "Wörtchen" bleiben Umlaute und ß außen vor – die Bildschirmtastatur
 * hat dafür keine Tasten, solche Wörter wären also gar nicht zu erraten.
 */
import { writeFile } from 'node:fs/promises';

const NOUNS = 'https://raw.githubusercontent.com/gambolputty/german-nouns/master/german_nouns/nouns.csv';
const WORDLIST =
  'https://raw.githubusercontent.com/kamilmielnik/scrabble-dictionaries/master/german/german.txt';
const FREQUENCY =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt';

const OUT = new URL('../src/games/hangman/words.json', import.meta.url);

const MIN_LENGTH = 5;
const MAX_LENGTH = 12;
/** So viele Wörter landen im Spiel – die häufigsten zuerst. */
const WORD_COUNT = 2000;

/**
 * Wortarten, die kein Rätselwort abgeben. "adjektivische Deklination" trifft
 * die Fälle wie "die Kleine" oder "der Beste": laut Wiktionary Substantive,
 * gelesen aber als Eigenschaftswort.
 */
const SKIP_POS =
  /Vorname|Nachname|Toponym|Eigenname|Abkürzung|Akronym|Affix|Suffix|Präfix|Gebundenes|Straßenname|adjektivische Deklination/;

/**
 * Was die Filter nicht greifen: Wörter, die zwar als Hauptwort in Wiktionary
 * stehen, im Alltag aber ein Verb, ein Zahlwort oder eine Anrede sind – und
 * derbe Ausdrücke, die hier niemand vor sich sehen will.
 */
const BLOCKLIST = new Set(
  `ETWAS EINER EINEN UNTER NAMEN DENKE WARTE SCHAU BLEIBE SUCHE GLAUBEN TREFFEN
   GEFALLEN GESCHEHEN SCHREIBEN STECKEN STECHEN KEHRE SCHENK WILLEN BISSCHEN
   LEIDER WEISE TOLLE MEINEN WAREN VERGESSEN SPRECHEN VERLANGEN GESAGT
   SOWIESO TOTAL NORMAL PERFEKT ELEGANT ROYAL FLACH BITTER IDEAL SCHADE ERNST
   SECHS SIEBEN DREIZEHN VIERZEHN SECHZEHN SIEBZEHN ACHTZEHN NEUNZEHN ZWANZIG
   HUNDERT TAUSEND
   HALLO DADDY MOMMY MADAME MISTER BUTCH MARINES UNTERTITEL
   ARSCH ARSCHLOCH WICHSER NEGER NUTTE SCHLAMPE FOTZE MUSCHI TITTEN PENNER
   SPASTI KANAKE ZIGEUNER MISSGEBURT DRECKSACK MISTKERL VAGINA PENIS BUSEN
   SCHWUCHTEL TUNTE HUREN BORDELL`
    .split(/\s+/)
    .filter(Boolean),
);

/** Reines A–Z mit passender Länge, erster Buchstabe groß. */
const NOUN_SHAPE = new RegExp(`^[A-Z][a-z]{${MIN_LENGTH - 1},${MAX_LENGTH - 1}}$`);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.text();
}

/** CSV-Zeile in Felder zerlegen; Felder dürfen in Anführungszeichen stehen. */
function splitCsv(line) {
  const fields = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (line[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      fields.push(field);
      field = '';
    } else field += char;
  }

  fields.push(field);
  return fields;
}

const [rawNouns, rawWordlist, rawFrequency] = await Promise.all([
  fetchText(NOUNS),
  fetchText(WORDLIST),
  fetchText(FREQUENCY),
]);

const allowed = new Set(rawWordlist.split(/\r?\n/).map((line) => line.trim().toUpperCase()));

/** Rang in der Häufigkeitsliste; kleiner heißt geläufiger. */
const rank = new Map();
rawFrequency.split(/\r?\n/).forEach((line, index) => {
  const word = line.split(' ')[0];
  if (word && !rank.has(word)) rank.set(word, index);
});

const [header, ...rows] = rawNouns.split(/\r?\n/);
const columns = splitCsv(header);
const columnAt = (name) => {
  const index = columns.indexOf(name);
  if (index < 0) throw new Error(`Spalte "${name}" fehlt – Format der Wiktionary-Daten geändert?`);
  return index;
};

const LEMMA = columnAt('lemma');
const POS = columnAt('pos');
const GENUS = [columnAt('genus'), columnAt('genus 1'), columnAt('genus 2')];
/** Alle Spalten, in denen eine Mehrzahlform stehen kann. */
const PLURAL = columns
  .map((name, index) => (name.startsWith('nominativ plural') ? index : -1))
  .filter((index) => index >= 0);

const found = new Map();

for (const row of rows) {
  if (!row) continue;
  const fields = splitCsv(row);

  const lemma = fields[LEMMA];
  const pos = fields[POS] ?? '';
  if (!pos.includes('Substantiv') || SKIP_POS.test(pos)) continue;
  if (!NOUN_SHAPE.test(lemma)) continue;

  /**
   * Sächlich und ohne Mehrzahl: das sind fast durchweg die substantivierten
   * Verben und Partikeln – "das Gehen", "das Jetzt", "das Nichts". Als
   * Rätselwort taugen sie nicht, weil sie sich wie ein Verb lesen.
   */
  const genus = GENUS.map((index) => fields[index]).filter(Boolean);
  const hasPlural = PLURAL.some((index) => fields[index]);
  if (genus.length === 1 && genus[0] === 'n' && !hasPlural) continue;

  const word = lemma.toUpperCase();
  if (BLOCKLIST.has(word) || found.has(word)) continue;
  // Ohne Eintrag in der Spielwortliste ist es ein Eigenname, ohne Rang in der
  // Häufigkeitsliste kennt es niemand.
  if (!allowed.has(word)) continue;

  const place = rank.get(lemma.toLowerCase());
  if (place === undefined) continue;

  found.set(word, place);
}

const words = [...found.entries()]
  .sort((a, b) => a[1] - b[1])
  .slice(0, WORD_COUNT)
  .map(([word]) => word)
  .sort();

await writeFile(OUT, JSON.stringify(words));

const byLength = {};
for (const word of words) byLength[word.length] = (byLength[word.length] ?? 0) + 1;
console.log(`${words.length} Wörter geschrieben.`);
console.log(
  Object.keys(byLength)
    .sort((a, b) => a - b)
    .map((length) => `${length}: ${byLength[length]}`)
    .join(', '),
);
