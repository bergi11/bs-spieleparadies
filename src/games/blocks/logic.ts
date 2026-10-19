/**
 * Regelkern von "Klötzchen" – Formen auf ein 8×8-Brett legen, volle Reihen
 * und Spalten räumen.
 *
 * Das Vorbild steht im Ruf, die Formen nach dem Brett zu wählen: mal gnädig,
 * damit man dranbleibt, mal gemein, damit man für ein "Weiterspielen" Werbung
 * schaut. Hier gibt es nichts zu verkaufen, also auch keinen Grund dafür.
 * Jede Form wird für sich gezogen, gleich wahrscheinlich aus dem ganzen
 * Katalog, ohne Blick aufs Brett, auf den Punktestand oder auf die übrigen
 * Formen der Hand. Ob drei Formen zusammen noch passen, entscheidet allein
 * der Zufall – das gehört dazu.
 *
 * Als Zufallsquelle dient `crypto.getRandomValues` mit Verwerfen statt
 * Modulo: `Math.random` wäre für ein Spiel gut genug, aber so muss man der
 * Verteilung nicht erst glauben. `npm run check:blocks` zählt nach.
 */

export const GROESSE = 8;

/** Zeile und Spalte, von oben links. */
export type Zelle = readonly [number, number];

export interface Stueck {
  /** Belegte Zellen, nach oben links geschoben. */
  zellen: Zelle[];
  /** 1 bis `FARBEN`; nur fürs Auge. */
  farbe: number;
}

export interface Partie {
  /** `GROESSE²` Felder zeilenweise; 0 ist frei, sonst die Farbe. */
  feld: number[];
  /** Drei Plätze; gelegte Formen werden zu `null`. */
  hand: (Stueck | null)[];
  punkte: number;
  /** Aktueller Faktor fürs Räumen; 0, solange keine Serie läuft. */
  kombo: number;
  /** Gelegte Formen seit dem letzten Räumen. */
  seitRaeumen: number;
  /** Gelegte Formen insgesamt. */
  zuege: number;
  vorbei: boolean;
}

export const FARBEN = 7;
export const HAND = 3;

/**
 * Die Grundformen. Jede kommt in allen Drehungen in den Katalog, gespiegelte
 * Formen stehen eigens da – gedreht wird beim Spielen nicht.
 */
const GRUNDFORMEN = [
  '#',
  '##',
  '###',
  '####',
  '#####',
  '##\n##',
  '###\n###\n###',
  '##\n##\n##',
  '#.\n##',
  '#.\n#.\n##',
  '.#\n.#\n##',
  '#..\n#..\n###',
  '###\n.#.',
  '##.\n.##',
  '.##\n##.',
];

function lesen(muster: string): Zelle[] {
  const zellen: Zelle[] = [];
  muster.split('\n').forEach((zeile, r) =>
    [...zeile].forEach((zeichen, c) => {
      if (zeichen === '#') zellen.push([r, c]);
    }),
  );
  return zellen;
}

/** Nach oben links schieben und sortieren – so lassen sich Formen vergleichen. */
export function normieren(zellen: readonly Zelle[]): Zelle[] {
  const r0 = Math.min(...zellen.map(([r]) => r));
  const c0 = Math.min(...zellen.map(([, c]) => c));
  return zellen
    .map(([r, c]): Zelle => [r - r0, c - c0])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const drehen = (zellen: readonly Zelle[]) => normieren(zellen.map(([r, c]): Zelle => [c, -r]));

const schluessel = (zellen: readonly Zelle[]) => zellen.map(([r, c]) => `${r},${c}`).join(' ');

function katalog(): Zelle[][] {
  const gesehen = new Set<string>();
  const formen: Zelle[][] = [];
  for (const muster of GRUNDFORMEN) {
    let form = normieren(lesen(muster));
    for (let i = 0; i < 4; i++) {
      const k = schluessel(form);
      if (!gesehen.has(k)) {
        gesehen.add(k);
        formen.push(form);
      }
      form = drehen(form);
    }
  }
  return formen;
}

/** Alle Formen in allen Lagen, jede genau einmal. */
export const FORMEN: readonly Zelle[][] = katalog();

/** Ganzzahl in [0, n). */
export type Zufall = (n: number) => number;

/**
 * Gleichverteilt in [0, n). Werte aus dem überzähligen Rest von 2³² werden
 * verworfen, sonst kämen die kleinen Zahlen bei `% n` minimal öfter.
 */
export const sichererZufall: Zufall = (n) => {
  const grenze = Math.floor(0x1_0000_0000 / n) * n;
  const puffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(puffer);
    if (puffer[0] < grenze) return puffer[0] % n;
  }
};

export function ziehen(zufall: Zufall = sichererZufall): Stueck {
  return {
    zellen: FORMEN[zufall(FORMEN.length)].map(([r, c]): Zelle => [r, c]),
    farbe: zufall(FARBEN) + 1,
  };
}

export const neueHand = (zufall: Zufall = sichererZufall): Stueck[] =>
  Array.from({ length: HAND }, () => ziehen(zufall));

export function neuePartie(zufall: Zufall = sichererZufall): Partie {
  return {
    feld: Array<number>(GROESSE * GROESSE).fill(0),
    hand: neueHand(zufall),
    punkte: 0,
    kombo: 0,
    seitRaeumen: 0,
    zuege: 0,
    vorbei: false,
  };
}

export const masse = (zellen: readonly Zelle[]) => ({
  hoehe: Math.max(...zellen.map(([r]) => r)) + 1,
  breite: Math.max(...zellen.map(([, c]) => c)) + 1,
});

export function passt(feld: readonly number[], zellen: readonly Zelle[], r: number, c: number) {
  return zellen.every(([dr, dc]) => {
    const zr = r + dr;
    const zc = c + dc;
    return (
      zr >= 0 && zr < GROESSE && zc >= 0 && zc < GROESSE && feld[zr * GROESSE + zc] === 0
    );
  });
}

export function irgendwoPlatz(feld: readonly number[], zellen: readonly Zelle[]) {
  for (let r = 0; r < GROESSE; r++)
    for (let c = 0; c < GROESSE; c++) if (passt(feld, zellen, r, c)) return true;
  return false;
}

/** Vorbei ist es, wenn keine der noch offenen Formen irgendwo hinpasst. */
export function festgefahren(feld: readonly number[], hand: readonly (Stueck | null)[]) {
  const offen = hand.filter((s): s is Stueck => s !== null);
  return offen.length > 0 && offen.every((s) => !irgendwoPlatz(feld, s.zellen));
}

/** Volle Zeilen und Spalten eines Feldes. */
export function volleLinien(feld: readonly number[]) {
  const zeilen: number[] = [];
  const spalten: number[] = [];
  for (let i = 0; i < GROESSE; i++) {
    let zeileVoll = true;
    let spalteVoll = true;
    for (let k = 0; k < GROESSE; k++) {
      if (feld[i * GROESSE + k] === 0) zeileVoll = false;
      if (feld[k * GROESSE + i] === 0) spalteVoll = false;
    }
    if (zeileVoll) zeilen.push(i);
    if (spalteVoll) spalten.push(i);
  }
  return { zeilen, spalten };
}

/** Felder, die beim Legen an dieser Stelle verschwinden würden. */
export function wuerdeRaeumen(
  feld: readonly number[],
  zellen: readonly Zelle[],
  r: number,
  c: number,
): Set<number> {
  const probe = [...feld];
  for (const [dr, dc] of zellen) probe[(r + dr) * GROESSE + c + dc] = 1;
  return linienFelder(volleLinien(probe));
}

function linienFelder({ zeilen, spalten }: { zeilen: number[]; spalten: number[] }) {
  const felder = new Set<number>();
  for (const z of zeilen) for (let k = 0; k < GROESSE; k++) felder.add(z * GROESSE + k);
  for (const s of spalten) for (let k = 0; k < GROESSE; k++) felder.add(k * GROESSE + s);
  return felder;
}

/**
 * Punkte fürs Räumen. Mehrere Linien auf einmal zählen überproportional
 * (10, 30, 60, 100, …), die Kombo multipliziert das Ganze.
 */
export const raeumPunkte = (linien: number, kombo: number) =>
  ((10 * linien * (linien + 1)) / 2) * Math.max(kombo, 1);

/** Bonus, wenn nach dem Räumen kein einziges Feld mehr belegt ist. */
export const LEER_BONUS = 300;

/** Nach so vielen gelegten Formen ohne Räumen reißt die Kombo ab. */
export const KOMBO_LUFT = 3;

export interface Zug {
  partie: Partie;
  /** Geräumte Felder mit ihrer Farbe davor – für die Animation. */
  geraeumt: { feld: number; farbe: number }[];
  linien: number;
  gewinn: number;
}

/**
 * Legt die Form aus Platz `index` mit ihrer oberen linken Ecke auf (r, c).
 * `null`, wenn sie dort nicht passt.
 */
export function legen(
  partie: Partie,
  index: number,
  r: number,
  c: number,
  zufall: Zufall = sichererZufall,
): Zug | null {
  const stueck = partie.hand[index];
  if (partie.vorbei || !stueck || !passt(partie.feld, stueck.zellen, r, c)) return null;

  const feld = [...partie.feld];
  for (const [dr, dc] of stueck.zellen) feld[(r + dr) * GROESSE + c + dc] = stueck.farbe;

  const voll = volleLinien(feld);
  const linien = voll.zeilen.length + voll.spalten.length;
  const geraeumt = [...linienFelder(voll)].map((f) => ({ feld: f, farbe: feld[f] }));
  for (const { feld: f } of geraeumt) feld[f] = 0;

  let { kombo, seitRaeumen } = partie;
  let gewinn = stueck.zellen.length;
  if (linien > 0) {
    kombo = kombo > 0 && seitRaeumen < KOMBO_LUFT ? kombo + 1 : 1;
    seitRaeumen = 0;
    gewinn += raeumPunkte(linien, kombo);
    if (feld.every((f) => f === 0)) gewinn += LEER_BONUS;
  } else {
    seitRaeumen += 1;
    if (seitRaeumen >= KOMBO_LUFT) kombo = 0;
  }

  let hand = partie.hand.map((s, i) => (i === index ? null : s));
  if (hand.every((s) => s === null)) hand = neueHand(zufall);

  return {
    partie: {
      feld,
      hand,
      punkte: partie.punkte + gewinn,
      kombo,
      seitRaeumen,
      zuege: partie.zuege + 1,
      vorbei: festgefahren(feld, hand),
    },
    geraeumt,
    linien,
    gewinn,
  };
}

/**
 * Prüft einen geladenen Stand. Was nicht passt, gilt als nicht vorhanden –
 * lieber eine neue Partie als ein Brett, auf dem nichts mehr stimmt.
 */
export function gueltig(partie: unknown): partie is Partie {
  const p = partie as Partie | null;
  if (!p || !Array.isArray(p.feld) || p.feld.length !== GROESSE * GROESSE) return false;
  if (!p.feld.every((f) => Number.isInteger(f) && f >= 0 && f <= FARBEN)) return false;
  if (!Array.isArray(p.hand) || p.hand.length !== HAND) return false;
  return p.hand.every(
    (s) =>
      s === null ||
      (Array.isArray(s.zellen) &&
        s.zellen.length > 0 &&
        s.zellen.every(
          (z) => Array.isArray(z) && z.every((n) => Number.isInteger(n) && n >= 0 && n < 5),
        )),
  );
}
