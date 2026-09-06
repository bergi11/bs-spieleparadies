/**
 * Erzeugt die Wortlisten für "Wörtchen" neu.
 *
 *   node scripts/build-words.mjs
 *
 * Quellen:
 *  - wordle-de (MIT): kuratierte Lösungswörter, im ausgelieferten Bundle
 *    als Array eingebettet. Wir ziehen die drei Wortgruppen heraus – die
 *    kleinste davon ist die Lösungsliste in ihrer Tagesreihenfolge.
 *  - Wortliste von davidak: ergänzt die erlaubten Rateworte.
 *
 * Die Lösungsliste enthält bewusst keine Umlaute und kein ß. Deshalb
 * beschränken wir auch die Rateworte auf A–Z: die Bildschirmtastatur hat
 * keine Umlauttasten, sonst wären solche Wörter gar nicht eingebbar.
 */
import { writeFile } from 'node:fs/promises';

const BUNDLE = 'https://raw.githubusercontent.com/wordle-de/wordle-de.github.io/main/main.js';
const WORTLISTE = 'https://raw.githubusercontent.com/davidak/wortliste/master/wortliste.txt';
const OUT_DIR = new URL('../src/games/wordle/', import.meta.url);

/**
 * Nur reine A-Z-Wörter mit genau fünf Buchstaben. Die Prüfung läuft bewusst
 * vor dem Großschreiben: toUpperCase() macht aus einem ß zwei S, wodurch ein
 * Wort seine Länge wechseln würde.
 */
const plain = (word) => (/^[A-Za-z]{5}$/.test(word) ? word.toUpperCase() : null);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.text();
}

/** Findet zusammenhängende Ketten kurz aufeinanderfolgender Wort-Literale. */
function extractClusters(source) {
  const tokens = [...source.matchAll(/["']([A-Za-zÄÖÜäöüß]{5})["']/g)].map((match) => ({
    word: match[1],
    at: match.index,
  }));

  const clusters = [];
  let current = [tokens[0]];
  for (let i = 1; i < tokens.length; i++) {
    // In einem Array-Literal liegen die Einträge dicht beieinander; ein
    // größerer Abstand bedeutet, dass hier anderer Code steht.
    if (tokens[i].at - tokens[i - 1].at < 12) current.push(tokens[i]);
    else {
      clusters.push(current);
      current = [tokens[i]];
    }
  }
  clusters.push(current);
  return clusters.filter((cluster) => cluster.length > 100);
}

const bundle = await fetchText(BUNDLE);
const clusters = extractClusters(bundle).sort((a, b) => a.length - b.length);
if (clusters.length < 2) throw new Error('Wortgruppen im Bundle nicht gefunden – Format geändert?');

// Die kleinste Gruppe ist die kuratierte Lösungsliste, die übrigen sind
// die alphabetischen Listen zulässiger Eingaben.
const [solutionCluster, ...validClusters] = clusters;
const solutions = [...new Set(solutionCluster.map((token) => plain(token.word)).filter(Boolean))];

const valid = new Set(solutions);
for (const cluster of validClusters) {
  for (const { word } of cluster) {
    const normalised = plain(word);
    if (normalised) valid.add(normalised);
  }
}

const wortliste = await fetchText(WORTLISTE);
for (const line of wortliste.split(/\r?\n/)) {
  const word = plain(line.trim());
  if (word) valid.add(word);
}

await writeFile(new URL('solutions.json', OUT_DIR), JSON.stringify(solutions));
await writeFile(new URL('valid.json', OUT_DIR), JSON.stringify([...valid].sort()));

console.log(`${solutions.length} Lösungswörter, ${valid.size} erlaubte Rateworte geschrieben.`);
