/**
 * Erzeugt die Rätsel für "Kreuzchen" (Mini-Kreuzworträtsel, 5x5).
 *
 *   node scripts/build-crossword.mjs
 *
 * Das Herz dieses Skripts ist keine Rechnerei, sondern die Wortliste weiter
 * unten: Jedes Wort bringt seinen Hinweis mit. Automatisch beschaffte
 * Definitionen (Wiktionary und Ähnliches) klingen entweder wie ein Lehrbuch
 * oder verraten das Wort im ersten Halbsatz – bei einem Rätsel mit zehn
 * Wörtern fällt das sofort auf. Also stehen die Hinweise hier, von Hand.
 *
 * Der Rest ist Suche: Aus den Wörtern werden Gitter gefüllt, in denen jede
 * Zeile und jede Spalte ein Wort ergibt. Gefüllt wird mit Rückverfolgung –
 * immer zuerst die Stelle, für die am wenigsten Wörter übrig sind. Findet
 * sich nichts mehr, geht es einen Schritt zurück.
 *
 * Neue Wörter kommen einfach in die Liste; je länger sie wird, desto mehr
 * Gitter findet die Suche. Wörter tragen nur A–Z: Die Bildschirmtastatur hat
 * keine Umlauttasten, sonst wären sie gar nicht einzugeben. Die Hinweise
 * dürfen selbstverständlich Umlaute haben.
 */
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../src/games/crossword/raetsel.json', import.meta.url);

/** So viele Rätsel sollen entstehen. */
const ANZAHL = 120;

/** Fester Startwert: derselbe Lauf ergibt dieselbe Datei. */
const SEED = 20260910;

/**
 * Die Gittermuster. '#' ist ein schwarzes Feld, '.' gehört zum Rätsel.
 *
 * Nicht jeder Buchstabe steht in zwei Wörtern – so wie im Schwedenrätsel auch.
 * Ein Gitter, in dem jedes Feld von beiden Seiten bestimmt ist, lässt sich mit
 * einer von Hand gepflegten Wortliste schlicht nicht füllen: Dafür bräuchte es
 * ein Wörterbuch mit Zehntausenden Einträgen, und dann stünden dort Wörter, zu
 * denen niemand einen brauchbaren Hinweis schreiben kann.
 */
const MUSTER = [
  // Fenster: drei Fünfer quer, drei Fünfer hoch.
  ['.....', '.#.#.', '.....', '.#.#.', '.....'],
  // Dasselbe mit abgeschnittenen Ecken: Vierer außen, Fünfer in der Mitte.
  ['....#', '.#.#.', '.....', '.#.#.', '#....'],
  ['#....', '.#.#.', '.....', '.#.#.', '....#'],
  // Kurz außen: Dreier quer, Vierer hoch.
  ['...##', '.#.#.', '.....', '.#.#.', '##...'],
  ['##...', '.#.#.', '.....', '.#.#.', '...##'],
  // Liegend: zwei Fünfer quer, drei Fünfer hoch.
  ['.#.#.', '.....', '.#.#.', '.....', '.#.#.'],
];

/* ------------------------------------------------------------------ *
 * Die Wörter. Ein Wort je Zeile: WORT | Hinweis                       *
 * ------------------------------------------------------------------ */

const LISTE = `
AAL   | Schlangenförmiger Fisch
AKT   | Abschnitt im Theaterstück
ALT   | Nicht mehr jung
AMT   | Behörde mit Schaltern
ARM   | Zwischen Schulter und Hand
ART   | Sorte oder Weise
AST   | Zweig am Baum
BAD   | Raum mit Wanne
BAR   | Tresen mit Hockern
BIT   | Kleinste Einheit im Rechner
BOB   | Schlitten auf der Eisbahn
BUS   | Hält an der Haltestelle
DOM   | Große Bischofskirche
DUO   | Zwei Musiker zusammen
EHE   | Bund fürs Leben
EID   | Feierliches Versprechen
EIS   | Gefrorenes Wasser
ELF   | Zahl nach der Zehn
EMU   | Großer Laufvogel
ERZ   | Gestein mit Metall darin
FAN   | Begeisterter Anhänger
FEE   | Zauberwesen im Märchen
FIX   | Schnell erledigt
GAS   | Kommt aus der Leitung
GEL   | Festiger für die Haare
GIN   | Klarer Schnaps mit Wacholder
HAI   | Raubfisch im Meer
HOF   | Haus mit Stall und Feldern
HUF   | Fuß des Pferdes
HUT   | Kopfbedeckung mit Krempe
JOB   | Bezahlte Arbeit
JOD   | Zusatz im Speisesalz
KAP   | Landspitze am Meer
KOI   | Bunter Teichfisch
KUH   | Liefert Milch
LID   | Deckel über dem Auge
LOK   | Zieht die Waggons
MAI   | Monat vor dem Juni
MUT   | Wer ihn hat, traut sich
NEU   | Gerade erst gekauft
NIL   | Fluss durch Ägypten
OHR   | Damit hört man
OMA   | Mutter der Mutter
OPA   | Vater des Vaters
ORT   | Stadt oder Dorf
OST   | Richtung des Sonnenaufgangs
POL   | Nord- oder Südende der Erde
PUR   | Ganz ohne Zusatz
RAD   | Dreht sich unter dem Wagen
REH   | Scheues Waldtier
ROM   | Hauptstadt Italiens
ROT   | Farbe der Tomate
RUM   | Schnaps aus Zuckerrohr
SAU   | Weibliches Schwein
SEE   | Stilles Gewässer im Land
SET   | Zusammengehörige Teile
SKI   | Brett für den Schnee
TAG   | Vierundzwanzig Stunden
TAL   | Senke zwischen Bergen
TAU   | Feuchte am frühen Morgen
TEE   | Heißes Getränk aus Blättern
TON   | Klang oder Töpfermasse
TOR   | Treffer beim Fußball
UHR   | Zeigt die Zeit
UHU   | Größte heimische Eule
VAN   | Auto mit viel Platz
WAL   | Riesiges Meeressäugetier
WEG   | Schmaler Pfad
WEH   | Tut es, wenn man sich stößt
WUT   | Großer Zorn
ZAR   | Herrscher im alten Russland
ZEH   | Vorne am Fuß, fünf pro Seite
ZOO   | Park mit Tieren
ZUG   | Fährt auf Schienen

ADER  | Leitet das Blut
AKKU  | Batterie zum Aufladen
ALGE  | Pflanze im Wasser
ARZT  | Behandelt Kranke
AUGE  | Damit sieht man
BAUM  | Hat Stamm und Krone
BEET  | Stück Erde im Garten
BEIN  | Trägt den Körper
BERG  | Erhebung im Gelände
BILD  | Hängt an der Wand
BLAU  | Farbe des Himmels
BOOT  | Kleines Wasserfahrzeug
BROT  | Kommt aus dem Backofen
BUCH  | Hat Seiten und einen Deckel
BURG  | Wehrhaftes Bauwerk
CHOR  | Gruppe von Sängern
DACH  | Deckt das Haus
DAME  | Höfliche Anrede für eine Frau
DECK  | Ebene auf dem Schiff
DIEB  | Nimmt fremdes Gut
DORF  | Kleiner Ort auf dem Land
DUFT  | Angenehmer Geruch
EBBE  | Niedriger Wasserstand
ECHO  | Zurückgeworfener Schall
EILE  | Große Hast
ENTE  | Schwimmvogel im Teich
ERBE  | Was nach dem Tod bleibt
ERDE  | Planet unter unseren Füßen
ESEL  | Störrisches Grautier
EULE  | Vogel der Nacht
FELD  | Acker des Bauern
FEST  | Feier mit Gästen
FILM  | Läuft im Kino
FLUR  | Gang in der Wohnung
FOTO  | Bild aus der Kamera
GABE  | Geschenk oder Talent
GANS  | Großer Wasservogel
GARN  | Faden zum Nähen
GAST  | Wer eingeladen ist
GELD  | Steckt im Portemonnaie
GLAS  | Daraus trinkt man
GOLD  | Gelb glänzendes Edelmetall
GRAS  | Wächst auf der Wiese
HAAR  | Wächst auf dem Kopf
HAND  | Hat fünf Finger
HASE  | Hoppelndes Langohr
HAUS  | Darin wohnt man
HEFT  | Dünnes Schulbuch
HEMD  | Oberteil mit Knöpfen
HERD  | Zum Kochen in der Küche
HOLZ  | Kommt vom Baum
HOSE  | Kleidung für die Beine
HUHN  | Legt die Eier
IGEL  | Stacheliges Gartentier
JAHR  | Zwölf Monate
KALB  | Junges Rind
KERN  | Innerstes der Frucht
KIND  | Noch nicht erwachsen
KINO  | Dort läuft der Film
KLEE  | Vierblättrig bringt er Glück
KOCH  | Wer in der Küche arbeitet
KORB  | Geflochtener Behälter
KRAN  | Hebt schwere Lasten
LAUB  | Fällt im Herbst
LEIM  | Klebt Holz zusammen
LIED  | Wird gesungen
LOCH  | Öffnung im Stoff
LUFT  | Wird geatmet
MAUS  | Kleiner Nager
MEER  | Salziges Gewässer
MEHL  | Grundstoff des Brotes
MOND  | Leuchtet in der Nacht
MOOS  | Weicher Waldbewuchs
MUND  | Damit spricht man
NEST  | Heim der Vögel
NETZ  | Fängt die Fische
OBST  | Äpfel und Birnen
OFEN  | Wärmt die Stube
OPER  | Gesungenes Bühnenstück
PARK  | Grünanlage in der Stadt
PECH  | Ärgerliches Missgeschick
PILZ  | Wächst nach dem Regen
POST  | Bringt die Briefe
RAUM  | Zimmer oder Weltall
REIS  | Korn aus Asien
RING  | Schmuck am Finger
ROSE  | Blume mit Dornen
SAAL  | Großer Raum für Feiern
SALZ  | Würzt die Suppe
SAND  | Am Strand unter den Füßen
SEIL  | Dickes Tau
SOFA  | Sitzmöbel im Wohnzimmer
STAR  | Berühmter Mensch
TEIG  | Wird zu Brot geknetet
TIER  | Lebewesen, kein Mensch
TURM  | Hohes schmales Bauwerk
WALD  | Viele Bäume beieinander
WAND  | Senkrecht im Zimmer
WEIN  | Getränk aus Trauben
WIND  | Bewegte Luft
WOLF  | Vorfahr des Hundes
ZAUN  | Grenzt das Grundstück ab
ZEIT  | Läuft immer weiter
ZELT  | Unterkunft beim Campen
ZIEL  | Ende des Rennens

ANKER | Hält das Schiff fest
APFEL | Frucht vom Baum
ASCHE | Rest nach dem Feuer
BADEN | Ins Wasser gehen
BAUER | Arbeitet auf dem Feld
BESEN | Kehrt den Boden
BIENE | Sammelt Nektar
BIRNE | Frucht oder Lampe
BLATT | Am Baum oder aus Papier
BLUME | Steht in der Vase
BODEN | Unter den Füßen
BRIEF | Kommt mit der Post
DACHS | Nachttier mit gestreiftem Kopf
DECKE | Wärmt im Bett
EIMER | Fasst zehn Liter
ERBSE | Kleine grüne Hülsenfrucht
ESSEN | Warme Mahlzeit
FADEN | Läuft durchs Nadelöhr
FEDER | Vom Vogel oder zum Schreiben
FISCH | Schwimmt im Wasser
FLOSS | Einfaches Wasserfahrzeug
FROST | Kälte unter null
FUCHS | Schlaues rotes Tier
GABEL | Besteck mit Zinken
GEIGE | Instrument mit Bogen
HAFEN | Liegeplatz der Schiffe
HONIG | Süßes von den Bienen
INSEL | Ringsum von Wasser umgeben
JACKE | Zieht man über das Hemd
KAKAO | Warmes Schokoladengetränk
KATZE | Miaut auf dem Sofa
KERZE | Brennt mit einem Docht
KETTE | Glied an Glied
KLEID | Einteiler für festliche Anlässe
KRONE | Sitzt auf dem Königskopf
LAMPE | Spendet Licht
LEDER | Haut als Werkstoff
LICHT | Macht den Raum hell
MAGEN | Verdaut das Essen
MAUER | Wand aus Stein
MEISE | Kleiner Gartenvogel
MILCH | Weißes Getränk
MOTOR | Treibt das Auto an
NACHT | Zeit der Dunkelheit
NADEL | Hat ein Öhr
NEBEL | Trübt die Sicht
NUDEL | Kommt in kochendes Wasser
OSTEN | Dort geht die Sonne auf
PFERD | Wird geritten
PILOT | Fliegt das Flugzeug
PLATZ | Freie Fläche im Ort
PUPPE | Spielzeug im Kinderzimmer
RATTE | Großer grauer Nager
REGEN | Fällt aus den Wolken
RIESE | Sehr großer Kerl
ROMAN | Langes erzählendes Buch
SALAT | Grünes Blattgemüse
SCHAF | Liefert die Wolle
SCHUH | Wird am Fuß getragen
SEGEL | Fängt den Wind
SEIFE | Schäumt beim Waschen
SPIEL | Zeitvertreib mit Regeln
STADT | Größer als ein Dorf
STEIN | Hart und schwer
STERN | Funkelt am Himmel
STUHL | Möbel zum Sitzen
TAFEL | Hängt im Klassenzimmer
TASSE | Gefäß mit Henkel
TISCH | Steht auf vier Beinen
TOAST | Geröstetes Brot
TRAUM | Bild im Schlaf
TULPE | Blume aus Holland
VOGEL | Hat Federn und Flügel
WAGEN | Fährt auf vier Rädern
WIESE | Grüne Fläche mit Gras
WOLKE | Zieht am Himmel
WURST | Kommt vom Metzger
ZANGE | Werkzeug zum Greifen
ZEBRA | Gestreiftes Steppentier
ZIEGE | Meckert im Stall
ZWERG | Klein und bärtig
`;

/* ------------------------------------------------------------------ *
 * Wortliste einlesen                                                  *
 * ------------------------------------------------------------------ */

const woerter = new Map();

for (const zeile of LISTE.split('\n')) {
  const inhalt = zeile.trim();
  if (!inhalt) continue;

  const [rohWort, ...rest] = inhalt.split('|');
  const wort = rohWort.trim();
  const hinweis = rest.join('|').trim();

  if (!/^[A-Z]{3,5}$/.test(wort)) {
    throw new Error(`"${wort}" ist kein Wort aus drei bis fünf Buchstaben A–Z.`);
  }
  if (!hinweis) throw new Error(`"${wort}" hat keinen Hinweis.`);
  if (woerter.has(wort)) throw new Error(`"${wort}" steht zweimal in der Liste.`);
  if (hinweis.toUpperCase().includes(wort)) {
    throw new Error(`Der Hinweis zu "${wort}" enthält das Wort selbst.`);
  }

  woerter.set(wort, hinweis);
}

/** Wörter nach Länge, damit die Suche nicht jedes Mal filtert. */
const nachLaenge = new Map();
for (const wort of woerter.keys()) {
  const liste = nachLaenge.get(wort.length) ?? [];
  liste.push(wort);
  nachLaenge.set(wort.length, liste);
}

/* ------------------------------------------------------------------ *
 * Zufall                                                              *
 * ------------------------------------------------------------------ */

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
 * Gitter füllen                                                       *
 * ------------------------------------------------------------------ */

const SEITE = 5;

/** Die Wortfelder eines Musters: wo ein Wort anfängt, wie lang, welche Felder. */
function stellen(muster) {
  const schwarz = (r, c) => muster[r][c] === '#';
  const liste = [];

  for (let r = 0; r < SEITE; r++) {
    for (let c = 0; c < SEITE; c++) {
      if (schwarz(r, c)) continue;

      if (c === 0 || schwarz(r, c - 1)) {
        const felder = [];
        for (let k = c; k < SEITE && !schwarz(r, k); k++) felder.push(r * SEITE + k);
        if (felder.length > 1) liste.push({ waagerecht: true, felder });
      }
      if (r === 0 || schwarz(r - 1, c)) {
        const felder = [];
        for (let k = r; k < SEITE && !schwarz(k, c); k++) felder.push(k * SEITE + c);
        if (felder.length > 1) liste.push({ waagerecht: false, felder });
      }
    }
  }

  return liste;
}

/**
 * Füllt ein Muster. Gearbeitet wird immer an der Stelle mit den wenigsten
 * Möglichkeiten: Wo es eng wird, zeigt sich am schnellsten, ob der bisherige
 * Weg überhaupt aufgeht.
 */
function fuelle(plaetze, gitter, benutzt, tiefe = 0) {
  if (tiefe > 400) return null;

  const offen = plaetze.filter((platz) => platz.felder.some((feld) => !gitter[feld]));
  if (offen.length === 0) return [...gitter];

  let bester = null;
  for (const platz of offen) {
    const kandidaten = (nachLaenge.get(platz.felder.length) ?? []).filter(
      (wort) =>
        !benutzt.has(wort) &&
        platz.felder.every((feld, i) => !gitter[feld] || gitter[feld] === wort[i]),
    );
    if (kandidaten.length === 0) return null;
    if (!bester || kandidaten.length < bester.kandidaten.length) {
      bester = { platz, kandidaten };
    }
  }

  for (const wort of mische(bester.kandidaten)) {
    const vorher = bester.platz.felder.map((feld) => gitter[feld]);
    bester.platz.felder.forEach((feld, i) => {
      gitter[feld] = wort[i];
    });
    benutzt.add(wort);

    const fertig = fuelle(plaetze, gitter, benutzt, tiefe + 1);
    if (fertig) return fertig;

    benutzt.delete(wort);
    bester.platz.felder.forEach((feld, i) => {
      gitter[feld] = vorher[i];
    });
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Erzeugung                                                           *
 * ------------------------------------------------------------------ */

const gesehen = new Set();
const raetsel = [];

let versuche = 0;
while (raetsel.length < ANZAHL && versuche < ANZAHL * 60) {
  versuche++;

  const muster = MUSTER[Math.floor(rng() * MUSTER.length)];
  const plaetze = stellen(muster);

  const leer = Array(SEITE * SEITE).fill('');
  const gefuellt = fuelle(plaetze, leer, new Set());
  if (!gefuellt) continue;

  const gitter = gefuellt
    .map((zeichen, feld) => (muster[Math.floor(feld / SEITE)][feld % SEITE] === '#' ? '#' : zeichen))
    .join('');
  if (gesehen.has(gitter)) continue;
  gesehen.add(gitter);

  // Nummeriert wird wie im Kreuzworträtsel: in Leserichtung bekommt jedes
  // Feld eine Nummer, an dem ein Wort anfängt – waagerecht und senkrecht
  // teilen sich diese Nummer.
  const anfaenge = [...new Set(plaetze.map((platz) => platz.felder[0]))].sort((a, b) => a - b);
  const nummern = new Map(anfaenge.map((feld, i) => [feld, i + 1]));

  const fragen = plaetze
    .map((platz) => {
      const wort = platz.felder.map((feld) => gitter[feld]).join('');
      return {
        nr: nummern.get(platz.felder[0]),
        waagerecht: platz.waagerecht,
        start: platz.felder[0],
        laenge: platz.felder.length,
        wort,
        hinweis: woerter.get(wort),
      };
    })
    .sort((a, b) => Number(b.waagerecht) - Number(a.waagerecht) || a.nr - b.nr);

  raetsel.push({ id: raetsel.length + 1, gitter, fragen });
}

if (raetsel.length < ANZAHL) {
  console.warn(`Nur ${raetsel.length} von ${ANZAHL} Rätseln gefunden.`);
}

await writeFile(OUT, `${JSON.stringify({ raetsel })}\n`, 'utf8');

const benutzt = new Set(raetsel.flatMap((r) => r.fragen.map((f) => f.wort)));
console.log(
  `${woerter.size} Wörter in der Liste, ${benutzt.size} davon kommen vor ` +
    `(${woerter.size - benutzt.size} bisher ungenutzt).`,
);
console.log(`${raetsel.length} Rätsel geschrieben nach ${OUT.pathname}`);
