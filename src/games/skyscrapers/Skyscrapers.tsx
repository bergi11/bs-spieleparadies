import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import {
  TIPPS,
  doppelte,
  gefuellt,
  hinweisFehler,
  leereMarken,
  leereNotizen,
  leeresGitter,
  notizGesetzt,
  notizLoeschen,
  notizUmschalten,
  spalteVon,
  stand,
  zeileVon,
  type Daten,
  type Raetsel,
} from './logic';
import raetselJson from './raetsel.json';

const DATEN = raetselJson as Daten;

export interface SkyscrapersStats {
  gespielt: number;
  geloest: number;
  /** Gelöst, ohne einen Tipp zu nehmen. */
  makellos: number;
  serie: number;
  besteSerie: number;
}

export interface SkyscrapersSave {
  /** 1-basierte Nummer des aktuellen Rätsels. */
  raetsel: number;
  /** Eingetragene Höhen, zeilenweise. 0 heißt leer. */
  zellen: number[];
  /** Notizen je Feld als Bitmaske: Bit 0 steht für die Höhe 1. */
  notizen: number[];
  /** Welche Felder ein Tipp gefüllt hat – die bleiben stehen. */
  verraten: boolean[];
  tipps: number;
  aufgegeben: boolean;
  stats: SkyscrapersStats;
}

const LEERE_STATS: SkyscrapersStats = {
  gespielt: 0,
  geloest: 0,
  makellos: 0,
  serie: 0,
  besteSerie: 0,
};

const EMPTY: SkyscrapersSave = {
  raetsel: 1,
  zellen: [],
  notizen: [],
  verraten: [],
  tipps: 0,
  aufgegeben: false,
  stats: LEERE_STATS,
};

function lob(tipps: number): string {
  if (tipps === 0) return 'Alles selbst ausgeknobelt!';
  if (tipps === 1) return 'Fast ohne Hilfe!';
  return 'Geschafft!';
}

function merken(stats: SkyscrapersStats, tipps: number | null): SkyscrapersStats {
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

/** Ein Hinweis am Rand; die 0 steht für "kein Hinweis" und bleibt leer. */
function Hinweis({ wert, fehler }: { wert: number; fehler: boolean }) {
  const klassen = ['turm-hinweis'];
  if (fehler) klassen.push('turm-hinweis-fehler');
  return (
    <div className={klassen.join(' ')} aria-hidden={wert === 0}>
      {wert > 0 ? wert : ''}
    </div>
  );
}

export function Skyscrapers({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<SkyscrapersSave>(
    user.id,
    'skyscrapers',
    EMPTY,
  );

  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [notizModus, setNotizModus] = useState(false);
  const [zeigeErgebnis, setZeigeErgebnis] = useState(true);
  const [zeigeStats, setZeigeStats] = useState(false);

  const nummer = Math.min(Math.max(save.raetsel ?? 1, 1), DATEN.raetsel.length);
  const raetsel: Raetsel = DATEN.raetsel[nummer - 1];
  const n = raetsel.n;
  const felder = n * n;
  const stats = save.stats ?? LEERE_STATS;

  /**
   * Nach neu erzeugten Daten kann unter derselben Nummer ein anderes Gitter
   * stehen – womöglich sogar ein größeres. Werte, die dort nicht hineinpassen,
   * gelten als leer, statt Unsinn anzuzeigen.
   */
  const gitter = useMemo(() => {
    const roh = save.zellen ?? [];
    return Array.from({ length: felder }, (_, feld) => {
      const wert = roh[feld];
      return typeof wert === 'number' && wert >= 1 && wert <= n ? wert : 0;
    });
  }, [felder, n, save.zellen]);

  const notizen = useMemo(() => {
    const roh = save.notizen ?? [];
    const alle = (1 << n) - 1;
    return Array.from({ length: felder }, (_, feld) => (roh[feld] ?? 0) & alle);
  }, [felder, n, save.notizen]);

  const verraten = useMemo(() => {
    const roh = save.verraten ?? [];
    return Array.from({ length: felder }, (_, feld) => Boolean(roh[feld]) && gitter[feld] > 0);
  }, [felder, gitter, save.verraten]);

  const tipps = save.tipps ?? 0;
  const aufgegeben = save.aufgegeben ?? false;
  const zustand = stand(raetsel, gitter, aufgegeben);
  const laeuft = zustand === 'laeuft' && status !== 'laden';
  const fertig = gefuellt(gitter);

  const fehlerFelder = useMemo(() => doppelte(gitter, n), [gitter, n]);
  const fehlerRand = useMemo(() => hinweisFehler(raetsel, gitter), [gitter, raetsel]);

  // Nach einem Rätselwechsel soll das Ergebnisblatt wieder erscheinen dürfen.
  useEffect(() => {
    setZeigeErgebnis(true);
    setGewaehlt(null);
  }, [nummer]);

  /** Schreibt eine Höhe ins Feld und räumt die Notizen der Reihe mit auf. */
  const setzen = useCallback(
    (feld: number, wert: number, perTipp = false) => {
      persist((vorher) => {
        const zellen = Array.from({ length: felder }, (_, i) => vorher.zellen?.[i] ?? 0);
        const merkzettel = Array.from({ length: felder }, (_, i) => vorher.notizen?.[i] ?? 0);
        const marken = Array.from({ length: felder }, (_, i) => Boolean(vorher.verraten?.[i]));

        zellen[feld] = wert;
        merkzettel[feld] = 0;
        marken[feld] = perTipp;

        // Was gesetzt ist, muss man in Zeile und Spalte nicht mehr durchdenken.
        if (wert > 0) {
          const r = zeileVon(feld, n);
          const c = spalteVon(feld, n);
          for (let i = 0; i < n; i++) {
            merkzettel[r * n + i] = notizLoeschen(merkzettel[r * n + i], wert);
            merkzettel[i * n + c] = notizLoeschen(merkzettel[i * n + c], wert);
          }
        }

        const tippZahl = (vorher.tipps ?? 0) + (perTipp ? 1 : 0);
        const jetztGeloest = zellen.every((hoehe, i) => hoehe === raetsel.loesung[i]);
        const vorherGeloest = raetsel.loesung.every((hoehe, i) => (vorher.zellen?.[i] ?? 0) === hoehe);

        return {
          ...vorher,
          zellen,
          notizen: merkzettel,
          verraten: marken,
          tipps: tippZahl,
          stats:
            jetztGeloest && !vorherGeloest && !(vorher.aufgegeben ?? false)
              ? merken(vorher.stats ?? LEERE_STATS, tippZahl)
              : (vorher.stats ?? LEERE_STATS),
        };
      });
    },
    [felder, n, persist, raetsel],
  );

  const notieren = useCallback(
    (feld: number, wert: number) => {
      persist((vorher) => {
        const merkzettel = Array.from({ length: felder }, (_, i) => vorher.notizen?.[i] ?? 0);
        merkzettel[feld] = notizUmschalten(merkzettel[feld], wert);
        return { ...vorher, notizen: merkzettel };
      });
    },
    [felder, persist],
  );

  const taste = useCallback(
    (wert: number) => {
      if (gewaehlt === null || !laeuft || verraten[gewaehlt]) return;

      if (notizModus && gitter[gewaehlt] === 0) {
        notieren(gewaehlt, wert);
        return;
      }

      // Dieselbe Höhe noch einmal heißt: wieder weg.
      setzen(gewaehlt, gitter[gewaehlt] === wert ? 0 : wert);
    },
    [gewaehlt, gitter, laeuft, notieren, notizModus, setzen, verraten],
  );

  const leeren = useCallback(() => {
    if (gewaehlt === null || !laeuft || verraten[gewaehlt]) return;
    if (gitter[gewaehlt] > 0) {
      setzen(gewaehlt, 0);
      return;
    }
    persist((vorher) => {
      const merkzettel = Array.from({ length: felder }, (_, i) => vorher.notizen?.[i] ?? 0);
      merkzettel[gewaehlt] = 0;
      return { ...vorher, notizen: merkzettel };
    });
  }, [felder, gewaehlt, gitter, laeuft, persist, setzen, verraten]);

  const tippNehmen = useCallback(() => {
    if (tipps >= TIPPS || !laeuft) return;

    // Ein Feld, das noch leer oder falsch ist – ein Tipp auf ein richtiges
    // Feld wäre verschenkt.
    const offen = gitter
      .map((wert, feld) => (wert === raetsel.loesung[feld] ? -1 : feld))
      .filter((feld) => feld >= 0);
    if (offen.length === 0) return;

    // Die Auswahl wandert nicht mit: ein verratenes Feld lässt sich nicht mehr
    // ändern, die Zifferntasten stünden also grau daneben.
    const feld = offen[Math.floor(Math.random() * offen.length)];
    setGewaehlt(null);
    setzen(feld, raetsel.loesung[feld], true);
  }, [gitter, laeuft, raetsel, setzen, tipps]);

  const aufgeben = useCallback(() => {
    setZeigeStats(false);
    setGewaehlt(null);

    persist((vorher) => ({
      ...vorher,
      zellen: [...raetsel.loesung],
      notizen: leereNotizen(n),
      verraten: raetsel.loesung.map((hoehe, feld) => (vorher.zellen?.[feld] ?? 0) !== hoehe),
      aufgegeben: true,
      stats: merken(vorher.stats ?? LEERE_STATS, null),
    }));
  }, [n, persist, raetsel]);

  const naechstes = useCallback(() => {
    setZeigeErgebnis(false);
    setZeigeStats(false);
    setGewaehlt(null);

    const folge = nummer >= DATEN.raetsel.length ? 1 : nummer + 1;
    const groesse = DATEN.raetsel[folge - 1].n;
    persist((vorher) => ({
      ...vorher,
      raetsel: folge,
      zellen: leeresGitter(groesse),
      notizen: leereNotizen(groesse),
      verraten: leereMarken(groesse),
      tipps: 0,
      aufgegeben: false,
    }));
  }, [nummer, persist]);

  const gewaehlteZeile = gewaehlt === null ? -1 : zeileVon(gewaehlt, n);
  const gewaehlteSpalte = gewaehlt === null ? -1 : spalteVon(gewaehlt, n);

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Wolkenkratzer</strong>
          <span>
            Rätsel {nummer} · {n}×{n} · {fertig}/{felder}
          </span>
        </div>
        <button className="icon-button" onClick={() => setZeigeStats(true)} aria-label="Statistik">
          📊
        </button>
      </header>

      <div className="turm-brett">
        <div className="turm-gitter" style={{ '--felder': n } as React.CSSProperties}>
          <div aria-hidden="true" />
          {raetsel.oben.map((wert, c) => (
            <Hinweis key={`oben-${c}`} wert={wert} fehler={fehlerRand.oben[c]} />
          ))}
          <div aria-hidden="true" />

          {Array.from({ length: n }, (_, r) => (
            <Fragment key={`zeile-${r}`}>
              <Hinweis wert={raetsel.links[r]} fehler={fehlerRand.links[r]} />

              {Array.from({ length: n }, (_, c) => {
                const feld = r * n + c;
                const wert = gitter[feld];

                const klassen = ['turm-feld'];
                if (gewaehlt === feld) klassen.push('turm-feld-gewaehlt');
                else if (r === gewaehlteZeile || c === gewaehlteSpalte) {
                  klassen.push('turm-feld-linie');
                }
                if (verraten[feld]) klassen.push('turm-feld-verraten');
                if (fehlerFelder[feld]) klassen.push('turm-feld-fehler');

                return (
                  <button
                    key={feld}
                    className={klassen.join(' ')}
                    onClick={() => setGewaehlt(feld)}
                    disabled={!laeuft || verraten[feld]}
                    aria-label={`Zeile ${r + 1}, Spalte ${c + 1}${wert ? `: Höhe ${wert}` : ' – leer'}`}
                  >
                    {wert > 0 ? (
                      <span className="turm-hoehe">{wert}</span>
                    ) : notizen[feld] > 0 ? (
                      <span
                        className="turm-notizen"
                        style={{ '--spalten': n <= 4 ? 2 : 3 } as React.CSSProperties}
                      >
                        {Array.from({ length: n }, (_, i) => (
                          <span key={i}>{notizGesetzt(notizen[feld], i + 1) ? i + 1 : ''}</span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              <Hinweis wert={raetsel.rechts[r]} fehler={fehlerRand.rechts[r]} />
            </Fragment>
          ))}

          <div aria-hidden="true" />
          {raetsel.unten.map((wert, c) => (
            <Hinweis key={`unten-${c}`} wert={wert} fehler={fehlerRand.unten[c]} />
          ))}
          <div aria-hidden="true" />
        </div>
      </div>

      <div className="turm-fuss">
        <div className="turm-tasten">
          {Array.from({ length: n }, (_, i) => i + 1).map((wert) => (
            <button
              key={wert}
              className={`turm-taste${
                gewaehlt !== null && gitter[gewaehlt] === wert ? ' turm-taste-aktiv' : ''
              }`}
              onClick={() => taste(wert)}
              disabled={gewaehlt === null || !laeuft || verraten[gewaehlt]}
            >
              {wert}
            </button>
          ))}
          <button
            className="turm-taste turm-taste-weg"
            onClick={leeren}
            disabled={gewaehlt === null || !laeuft || verraten[gewaehlt]}
            aria-label="Feld leeren"
          >
            ⌫
          </button>
        </div>

        <div className="turm-leiste">
          <button
            className={`button button-ghost${notizModus ? ' button-an' : ''}`}
            onClick={() => setNotizModus((an) => !an)}
            aria-pressed={notizModus}
          >
            ✏️ Notizen
          </button>
          <button className="button button-ghost" onClick={tippNehmen} disabled={tipps >= TIPPS || !laeuft}>
            Tipp ({TIPPS - tipps})
          </button>
        </div>

        <p className="hint">
          {zustand === 'gewonnen'
            ? 'Die Stadt steht.'
            : zustand === 'aufgegeben'
              ? 'Aufgelöst.'
              : notizModus
                ? 'Notizen: die Zahl merkt sich das Feld nur vor.'
                : 'Am Rand steht, wie viele Häuser man von dort aus sieht.'}
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
                ? tipps === 0
                  ? `Rätsel ${nummer} ohne Tipp gelöst.`
                  : `Rätsel ${nummer} mit ${tipps} ${tipps === 1 ? 'Tipp' : 'Tipps'} gelöst.`
                : 'Im Gitter steht jetzt die Lösung.'}
            </p>
            <div className="sheet-actions">
              <button className="button" onClick={naechstes}>
                Nächstes Rätsel
              </button>
              <button className="button button-ghost" onClick={() => setZeigeErgebnis(false)}>
                Gitter ansehen
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
  stats: SkyscrapersStats;
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
