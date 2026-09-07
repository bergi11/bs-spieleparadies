import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import {
  LEER,
  STRICH,
  TIPPS,
  VOLL,
  gefuellt,
  hinweise,
  istVoll,
  reiheStimmt,
  stand,
  type Bild,
  type Daten,
  type Feldstand,
} from './logic';
import bilderJson from './bilder.json';

const DATEN = bilderJson as Daten;

export interface NonogramStats {
  gespielt: number;
  geloest: number;
  /** Gelöst, ohne einen Tipp zu nehmen. */
  makellos: number;
  serie: number;
  besteSerie: number;
}

export interface NonogramSave {
  /** 1-basierte Nummer des aktuellen Bildes. */
  bild: number;
  /** Für jedes Feld: 0 leer, 1 gefüllt, 2 gestrichen. */
  zellen: number[];
  /** Felder, die ein Tipp aufgedeckt hat – die bleiben stehen. */
  verraten: number[];
  tipps: number;
  aufgegeben: boolean;
  stats: NonogramStats;
}

const LEERE_STATS: NonogramStats = {
  gespielt: 0,
  geloest: 0,
  makellos: 0,
  serie: 0,
  besteSerie: 0,
};

const EMPTY: NonogramSave = {
  bild: 1,
  zellen: [],
  verraten: [],
  tipps: 0,
  aufgegeben: false,
  stats: LEERE_STATS,
};

function lob(tipps: number): string {
  if (tipps === 0) return 'Ohne einen Blick auf die Lösung!';
  if (tipps === 1) return 'Fast ohne Hilfe!';
  return 'Fertig gemalt!';
}

function merken(stats: NonogramStats, tipps: number | null): NonogramStats {
  const gewonnen = tipps !== null;
  const serie = gewonnen ? stats.serie + 1 : 0;
  return {
    gespielt: stats.gespielt + 1,
    geloest: stats.geloest + (gewonnen ? 1 : 0),
    makellos: stats.makellos + (gewonnen && tipps === 0 ? 1 : 0),
    serie,
    besteSerie: Math.max(stats.besteSerie, serie),
  };
}

/** Die Zahlen an einer Reihe. Erledigte Reihen treten zurück. */
function HinweisSpur({
  zahlen,
  art,
  erledigt,
}: {
  zahlen: number[];
  art: 'zeile' | 'spalte';
  erledigt: boolean;
}) {
  const klassen = [`bild-hinweis`, `bild-hinweis-${art}`];
  if (erledigt) klassen.push('bild-hinweis-erledigt');

  return (
    <div className={klassen.join(' ')}>
      {zahlen.map((zahl, i) => (
        <span key={i}>{zahl}</span>
      ))}
    </div>
  );
}

export function Nonogram({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<NonogramSave>(
    user.id,
    'nonogram',
    EMPTY,
  );

  const [modus, setModus] = useState<typeof VOLL | typeof STRICH>(VOLL);
  const [zeigeErgebnis, setZeigeErgebnis] = useState(true);
  const [zeigeStats, setZeigeStats] = useState(false);
  const malen = useRef<Feldstand | null>(null);

  const nummer = Math.min(Math.max(save.bild ?? 1, 1), DATEN.bilder.length);
  const bild: Bild = DATEN.bilder[nummer - 1];
  const n = bild.n;
  const felder = n * n;
  const stats = save.stats ?? LEERE_STATS;

  const zahlen = useMemo(() => hinweise(bild), [bild]);

  /**
   * Die Starthilfe steht immer richtig im Gitter, egal was gespeichert war:
   * Ohne sie ginge das Bild nicht ohne Raten auf.
   */
  const gitter = useMemo(() => {
    const roh = save.zellen ?? [];
    const felderStand = Array.from({ length: felder }, (_, i) => {
      const wert = roh[i];
      return (wert === VOLL || wert === STRICH ? wert : LEER) as Feldstand;
    });
    for (const feld of bild.starthilfe) {
      if (feld < felder) felderStand[feld] = istVoll(bild, feld) ? VOLL : STRICH;
    }
    return felderStand;
  }, [bild, felder, save.zellen]);

  const gesperrt = useMemo(() => {
    const menge = new Set<number>(bild.starthilfe);
    for (const feld of save.verraten ?? []) menge.add(feld);
    return menge;
  }, [bild.starthilfe, save.verraten]);

  const tipps = save.tipps ?? 0;
  const aufgegeben = save.aufgegeben ?? false;
  const zustand = stand(bild, gitter, aufgegeben);
  const laeuft = zustand === 'laeuft' && status !== 'laden';

  useEffect(() => {
    setZeigeErgebnis(true);
  }, [nummer]);

  const setzen = useCallback(
    (feld: number, wert: Feldstand, perTipp = false) => {
      persist((vorher) => {
        const zellen = Array.from({ length: felder }, (_, i) => {
          const alt = vorher.zellen?.[i];
          return alt === VOLL || alt === STRICH ? alt : LEER;
        });
        for (const gegeben of bild.starthilfe) {
          if (gegeben < felder) zellen[gegeben] = istVoll(bild, gegeben) ? VOLL : STRICH;
        }
        zellen[feld] = wert;

        const verraten = [...(vorher.verraten ?? [])];
        if (perTipp && !verraten.includes(feld)) verraten.push(feld);

        const tippZahl = (vorher.tipps ?? 0) + (perTipp ? 1 : 0);
        const passt = (stand: number[]) =>
          stand.length === felder && stand.every((f, i) => (f === VOLL) === istVoll(bild, i));

        return {
          ...vorher,
          zellen,
          verraten,
          tipps: tippZahl,
          stats:
            passt(zellen) && !passt(vorher.zellen ?? []) && !(vorher.aufgegeben ?? false)
              ? merken(vorher.stats ?? LEERE_STATS, tippZahl)
              : (vorher.stats ?? LEERE_STATS),
        };
      });
    },
    [bild, felder, persist],
  );

  /** Das Feld unter dem Finger – beim Ziehen ist das nicht mehr das Startfeld. */
  const feldUnter = useCallback((x: number, y: number): number | null => {
    const treffer = document.elementFromPoint(x, y)?.closest('[data-feld]');
    const wert = treffer?.getAttribute('data-feld');
    return wert ? Number(wert) : null;
  }, []);

  const beginnen = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!laeuft) return;
      const feld = feldUnter(event.clientX, event.clientY);
      if (feld === null || gesperrt.has(feld)) return;

      // Was der erste Druck macht, machen alle weiteren Felder des Zuges auch:
      // einmal quer über eine Reihe ziehen soll nicht abwechselnd setzen und
      // löschen.
      const ziel = gitter[feld] === modus ? LEER : modus;
      malen.current = ziel;
      event.currentTarget.setPointerCapture(event.pointerId);
      setzen(feld, ziel);
    },
    [feldUnter, gesperrt, gitter, laeuft, modus, setzen],
  );

  const ziehen = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const ziel = malen.current;
      if (ziel === null || !laeuft) return;
      const feld = feldUnter(event.clientX, event.clientY);
      if (feld === null || gesperrt.has(feld) || gitter[feld] === ziel) return;
      setzen(feld, ziel);
    },
    [feldUnter, gesperrt, gitter, laeuft, setzen],
  );

  const beenden = useCallback(() => {
    malen.current = null;
  }, []);

  const tippNehmen = useCallback(() => {
    if (tipps >= TIPPS || !laeuft) return;

    const falsch = gitter
      .map((feld, i) => ((feld === VOLL) === istVoll(bild, i) ? -1 : i))
      .filter((i) => i >= 0);
    if (falsch.length === 0) return;

    const feld = falsch[Math.floor(Math.random() * falsch.length)];
    setzen(feld, istVoll(bild, feld) ? VOLL : STRICH, true);
  }, [bild, gitter, laeuft, setzen, tipps]);

  const aufgeben = useCallback(() => {
    setZeigeStats(false);
    persist((vorher) => ({
      ...vorher,
      zellen: Array.from({ length: felder }, (_, i) => (istVoll(bild, i) ? VOLL : STRICH)),
      aufgegeben: true,
      stats: merken(vorher.stats ?? LEERE_STATS, null),
    }));
  }, [bild, felder, persist]);

  const naechstes = useCallback(() => {
    setZeigeErgebnis(false);
    setZeigeStats(false);
    const folge = nummer >= DATEN.bilder.length ? 1 : nummer + 1;
    persist((vorher) => ({
      ...vorher,
      bild: folge,
      zellen: [],
      verraten: [],
      tipps: 0,
      aufgegeben: false,
    }));
  }, [nummer, persist]);

  const zeilenFertig = useMemo(
    () => zahlen.zeilen.map((z, r) => reiheStimmt(z, gitter, n, 'zeile', r)),
    [gitter, n, zahlen],
  );
  const spaltenFertig = useMemo(
    () => zahlen.spalten.map((z, c) => reiheStimmt(z, gitter, n, 'spalte', c)),
    [gitter, n, zahlen],
  );

  const spur = Math.max(
    ...zahlen.zeilen.map((z) => z.length),
    ...zahlen.spalten.map((z) => z.length),
  );

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Bildgitter</strong>
          <span>
            Bild {nummer} · {n}×{n} · {gefuellt(gitter)} gefüllt
          </span>
        </div>
        <button className="icon-button" onClick={() => setZeigeStats(true)} aria-label="Statistik">
          📊
        </button>
      </header>

      <div className="bild-brett">
        <div
          className="bild-gitter"
          style={{ '--felder': n, '--spur': spur } as React.CSSProperties}
          onPointerDown={beginnen}
          onPointerMove={ziehen}
          onPointerUp={beenden}
          onPointerCancel={beenden}
        >
          <div aria-hidden="true" />
          {zahlen.spalten.map((z, c) => (
            <HinweisSpur key={`s-${c}`} zahlen={z} art="spalte" erledigt={spaltenFertig[c]} />
          ))}

          {Array.from({ length: n }, (_, r) => (
            <Fragment key={`z-${r}`}>
              <HinweisSpur zahlen={zahlen.zeilen[r]} art="zeile" erledigt={zeilenFertig[r]} />

              {Array.from({ length: n }, (_, c) => {
                const feld = r * n + c;
                const wert = gitter[feld];

                const klassen = ['bild-feld'];
                // Nach dem Lösen zählt nur noch das Bild – Striche würden es
                // zerkratzen.
                if (wert === VOLL) klassen.push('bild-feld-voll');
                else if (wert === STRICH && zustand === 'laeuft') klassen.push('bild-feld-strich');
                if (gesperrt.has(feld) && zustand === 'laeuft') klassen.push('bild-feld-gegeben');
                if (c % 5 === 4 && c < n - 1) klassen.push('bild-feld-kante-rechts');
                if (r % 5 === 4 && r < n - 1) klassen.push('bild-feld-kante-unten');

                return (
                  <button
                    key={feld}
                    type="button"
                    data-feld={feld}
                    className={klassen.join(' ')}
                    disabled={!laeuft || gesperrt.has(feld)}
                    aria-label={`Zeile ${r + 1}, Spalte ${c + 1}`}
                  >
                    {wert === STRICH && zustand === 'laeuft' ? '×' : ''}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="bild-fuss">
        <div className="bild-modus">
          <button
            className={`button button-ghost${modus === VOLL ? ' button-an' : ''}`}
            onClick={() => setModus(VOLL)}
            aria-pressed={modus === VOLL}
          >
            ◼︎ Füllen
          </button>
          <button
            className={`button button-ghost${modus === STRICH ? ' button-an' : ''}`}
            onClick={() => setModus(STRICH)}
            aria-pressed={modus === STRICH}
          >
            ✕ Streichen
          </button>
          <button className="button button-ghost" onClick={tippNehmen} disabled={tipps >= TIPPS || !laeuft}>
            Tipp ({TIPPS - tipps})
          </button>
        </div>

        <p className="hint">
          {zustand === 'gewonnen'
            ? `Das war: ${bild.name}.`
            : zustand === 'aufgegeben'
              ? `Es war: ${bild.name}.`
              : 'Die Zahlen sind die Längen der Blöcke – der Reihe nach, mit Lücke dazwischen.'}
        </p>
      </div>

      {status === 'fehler' && (
        <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>
      )}

      {zustand !== 'laeuft' && zeigeErgebnis && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <h2>{zustand === 'gewonnen' ? lob(tipps) : 'Aufgelöst.'}</h2>
            <p className="muted">
              {zustand === 'gewonnen'
                ? `Bild ${nummer} zeigt ${bild.name}.`
                : `Bild ${nummer} war ${bild.name}.`}
            </p>
            <div className="sheet-actions">
              <button className="button" onClick={naechstes}>
                Nächstes Bild
              </button>
              <button className="button button-ghost" onClick={() => setZeigeErgebnis(false)}>
                Bild ansehen
              </button>
              <button className="button button-ghost" onClick={onExit}>
                Zurück zum Launchpad
              </button>
            </div>
          </div>
        </div>
      )}

      {zeigeStats && (
        <StatsSheet
          stats={stats}
          kannAufgeben={zustand === 'laeuft'}
          onAufgeben={aufgeben}
          onClose={() => setZeigeStats(false)}
        />
      )}
    </div>
  );
}

function StatsSheet({
  stats,
  kannAufgeben,
  onAufgeben,
  onClose,
}: {
  stats: NonogramStats;
  kannAufgeben: boolean;
  onAufgeben: () => void;
  onClose: () => void;
}) {
  const [sicher, setSicher] = useState(false);
  const quote = stats.gespielt ? Math.round((stats.geloest / stats.gespielt) * 100) : 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>Statistik</h2>

        <div className="stat-row">
          <Stat label="Gespielt" value={stats.gespielt} />
          <Stat label="Gelöst" value={`${quote}%`} />
          <Stat label="Ohne Tipp" value={stats.makellos} />
          <Stat label="Serie" value={stats.serie} />
        </div>
        <p className="hint">Beste Serie: {stats.besteSerie}</p>

        <div className="sheet-actions">
          {kannAufgeben &&
            (sicher ? (
              <button className="button button-warnung" onClick={onAufgeben}>
                Wirklich auflösen
              </button>
            ) : (
              <button className="button button-ghost" onClick={() => setSicher(true)}>
                Auflösen
              </button>
            ))}
          <button className="button" onClick={onClose}>
            Weiterspielen
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
