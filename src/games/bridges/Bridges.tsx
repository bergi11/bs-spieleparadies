import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import {
  TIPPS,
  frei,
  gradVon,
  kanten,
  kreuzungen,
  leereWerte,
  naechsterWert,
  stand,
  type Daten,
  type Kante,
  type Raetsel,
} from './logic';
import raetselJson from './raetsel.json';

const DATEN = raetselJson as Daten;

export interface BridgesStats {
  gespielt: number;
  geloest: number;
  /** Gelöst, ohne einen Tipp zu nehmen. */
  makellos: number;
  serie: number;
  besteSerie: number;
}

export interface BridgesSave {
  /** 1-basierte Nummer des aktuellen Rätsels. */
  raetsel: number;
  /** Je möglicher Verbindung die Anzahl Brücken, in der Reihenfolge von `kanten`. */
  bruecken: number[];
  /** Verbindungen, die ein Tipp gesetzt hat – die bleiben stehen. */
  verraten: number[];
  tipps: number;
  aufgegeben: boolean;
  stats: BridgesStats;
}

const LEERE_STATS: BridgesStats = {
  gespielt: 0,
  geloest: 0,
  makellos: 0,
  serie: 0,
  besteSerie: 0,
};

const EMPTY: BridgesSave = {
  raetsel: 1,
  bruecken: [],
  verraten: [],
  tipps: 0,
  aufgegeben: false,
  stats: LEERE_STATS,
};

function lob(tipps: number): string {
  if (tipps === 0) return 'Alle Inseln verbunden!';
  if (tipps === 1) return 'Fast ohne Hilfe!';
  return 'Geschafft!';
}

function merken(stats: BridgesStats, tipps: number | null): BridgesStats {
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

/** Mitte einer Insel im Koordinatensystem des SVG. */
const mitte = (raetsel: Raetsel, insel: number) => ({
  x: raetsel.inseln[insel].c + 0.5,
  y: raetsel.inseln[insel].r + 0.5,
});

export function Bridges({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<BridgesSave>(
    user.id,
    'bridges',
    EMPTY,
  );

  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [zeigeErgebnis, setZeigeErgebnis] = useState(true);
  const [zeigeStats, setZeigeStats] = useState(false);
  const gedrueckt = useRef<number | null>(null);

  const nummer = Math.min(Math.max(save.raetsel ?? 1, 1), DATEN.raetsel.length);
  const raetsel: Raetsel = DATEN.raetsel[nummer - 1];
  const stats = save.stats ?? LEERE_STATS;

  const alle = useMemo<Kante[]>(() => kanten(raetsel), [raetsel]);
  const imWeg = useMemo(() => kreuzungen(raetsel, alle), [alle, raetsel]);

  /**
   * Ein gespeicherter Stand gehört nur dann zu diesem Rätsel, wenn er genauso
   * viele Verbindungen kennt. Sonst lieber leer anfangen als falsche Brücken
   * zeichnen.
   */
  const werte = useMemo(() => {
    const roh = save.bruecken ?? [];
    if (roh.length !== alle.length) return leereWerte(alle.length);
    return roh.map((wert) => (wert === 1 || wert === 2 ? wert : 0));
  }, [alle.length, save.bruecken]);

  const verraten = useMemo(() => new Set(save.verraten ?? []), [save.verraten]);

  const tipps = save.tipps ?? 0;
  const aufgegeben = save.aufgegeben ?? false;
  const zustand = stand(raetsel, alle, werte, aufgegeben);
  const laeuft = zustand === 'laeuft' && status !== 'laden';

  const grade = useMemo(
    () => raetsel.inseln.map((_, i) => gradVon(alle, werte, i)),
    [alle, raetsel, werte],
  );

  useEffect(() => {
    setZeigeErgebnis(true);
    setGewaehlt(null);
    setMeldung(null);
  }, [nummer]);

  // Die Meldung ist eine kurze Rückmeldung, kein Zustand – sie geht von selbst.
  useEffect(() => {
    if (!meldung) return;
    const zeit = setTimeout(() => setMeldung(null), 1800);
    return () => clearTimeout(zeit);
  }, [meldung]);

  const setzen = useCallback(
    (kante: number, wert: number, perTipp = false) => {
      persist((vorher) => {
        const bestand =
          (vorher.bruecken ?? []).length === alle.length
            ? [...(vorher.bruecken ?? [])]
            : leereWerte(alle.length);
        bestand[kante] = wert;

        // Eine gesetzte Brücke räumt weg, was sie kreuzen würde. Von Hand geht
        // das gar nicht erst, ein Tipp darf es.
        if (wert > 0) for (const quer of imWeg[kante]) bestand[quer] = 0;

        const verratene = [...(vorher.verraten ?? [])];
        if (perTipp && !verratene.includes(kante)) verratene.push(kante);

        const tippZahl = (vorher.tipps ?? 0) + (perTipp ? 1 : 0);
        const fertig = (stellung: number[]) =>
          stand(raetsel, alle, stellung, false) === 'gewonnen';

        return {
          ...vorher,
          bruecken: bestand,
          verraten: verratene,
          tipps: tippZahl,
          stats:
            fertig(bestand) && !fertig(werte) && !(vorher.aufgegeben ?? false)
              ? merken(vorher.stats ?? LEERE_STATS, tippZahl)
              : (vorher.stats ?? LEERE_STATS),
        };
      });
    },
    [alle, imWeg, persist, raetsel, werte],
  );

  /** Die Verbindung zwischen zwei Inseln – falls es überhaupt eine gibt. */
  const kanteZwischen = useCallback(
    (a: number, b: number) =>
      alle.findIndex(
        (kante) => (kante.a === a && kante.b === b) || (kante.a === b && kante.b === a),
      ),
    [alle],
  );

  const verbinden = useCallback(
    (a: number, b: number) => {
      const kante = kanteZwischen(a, b);
      if (kante < 0) {
        setMeldung('Zwischen den beiden geht keine Brücke.');
        return;
      }
      if (verraten.has(kante)) {
        setMeldung('Diese Brücke kam von einem Tipp.');
        return;
      }
      if (werte[kante] === 0 && !frei(imWeg, werte, kante)) {
        setMeldung('Da liegt schon eine Brücke quer.');
        return;
      }
      setzen(kante, naechsterWert(werte[kante]));
    },
    [imWeg, kanteZwischen, setzen, verraten, werte],
  );

  /** Die Insel unter dem Finger, sonst null. */
  const inselUnter = useCallback((x: number, y: number): number | null => {
    const treffer = document.elementFromPoint(x, y)?.closest('[data-insel]');
    const wert = treffer?.getAttribute('data-insel');
    return wert ? Number(wert) : null;
  }, []);

  const beginnen = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!laeuft) return;
      gedrueckt.current = inselUnter(event.clientX, event.clientY);
    },
    [inselUnter, laeuft],
  );

  /**
   * Beide Wege führen zum Ziel: von einer Insel zur anderen ziehen, oder erst
   * die eine und dann die andere antippen. Einhändig ist mal das eine, mal das
   * andere bequemer.
   */
  const loslassen = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!laeuft) return;
      const start = gedrueckt.current;
      gedrueckt.current = null;

      const ziel = inselUnter(event.clientX, event.clientY);
      if (ziel === null) {
        setGewaehlt(null);
        return;
      }

      if (start !== null && start !== ziel) {
        verbinden(start, ziel);
        setGewaehlt(null);
        return;
      }

      if (gewaehlt === null || gewaehlt === ziel) {
        setGewaehlt(gewaehlt === ziel ? null : ziel);
        return;
      }

      verbinden(gewaehlt, ziel);
      setGewaehlt(null);
    },
    [gewaehlt, inselUnter, laeuft, verbinden],
  );

  const tippNehmen = useCallback(() => {
    if (tipps >= TIPPS || !laeuft) return;

    const falsch = werte
      .map((wert, k) => (wert === raetsel.loesung[k] ? -1 : k))
      .filter((k) => k >= 0);
    if (falsch.length === 0) return;

    const kante = falsch[Math.floor(Math.random() * falsch.length)];
    setGewaehlt(null);
    setzen(kante, raetsel.loesung[kante], true);
  }, [laeuft, raetsel, setzen, tipps, werte]);

  const aufgeben = useCallback(() => {
    setZeigeStats(false);
    setGewaehlt(null);
    persist((vorher) => ({
      ...vorher,
      bruecken: [...raetsel.loesung],
      aufgegeben: true,
      stats: merken(vorher.stats ?? LEERE_STATS, null),
    }));
  }, [persist, raetsel]);

  const naechstes = useCallback(() => {
    setZeigeErgebnis(false);
    setZeigeStats(false);
    setGewaehlt(null);

    const folge = nummer >= DATEN.raetsel.length ? 1 : nummer + 1;
    persist((vorher) => ({
      ...vorher,
      raetsel: folge,
      bruecken: [],
      verraten: [],
      tipps: 0,
      aufgegeben: false,
    }));
  }, [nummer, persist]);

  const offen = raetsel.inseln.filter((insel, i) => grade[i] !== insel.grad).length;

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Brücken</strong>
          <span>
            Rätsel {nummer} · {raetsel.inseln.length} Inseln ·{' '}
            {offen === 0 ? 'alle Zahlen stimmen' : `${offen} offen`}
          </span>
        </div>
        <button className="icon-button" onClick={() => setZeigeStats(true)} aria-label="Statistik">
          📊
        </button>
      </header>

      <div className="insel-brett">
        <svg
          className="insel-karte"
          viewBox={`0 0 ${raetsel.n} ${raetsel.n}`}
          onPointerDown={beginnen}
          onPointerUp={loslassen}
          role="presentation"
        >
          {/* Erst die Vorschläge, dann die Brücken, zuletzt die Inseln: so
              deckt nichts das ab, worauf es ankommt. */}
          {gewaehlt !== null &&
            alle.map((kante, k) => {
              if (kante.a !== gewaehlt && kante.b !== gewaehlt) return null;
              if (werte[k] > 0 || !frei(imWeg, werte, k)) return null;
              const von = mitte(raetsel, kante.a);
              const nach = mitte(raetsel, kante.b);
              return (
                <line
                  key={`v-${k}`}
                  className="insel-vorschlag"
                  x1={von.x}
                  y1={von.y}
                  x2={nach.x}
                  y2={nach.y}
                />
              );
            })}

          {alle.map((kante, k) => {
            if (werte[k] === 0) return null;
            const von = mitte(raetsel, kante.a);
            const nach = mitte(raetsel, kante.b);
            const versatz = werte[k] === 2 ? 0.11 : 0;
            const dx = kante.waagerecht ? 0 : versatz;
            const dy = kante.waagerecht ? versatz : 0;
            const klassen = ['insel-bruecke'];
            if (verraten.has(k)) klassen.push('insel-bruecke-verraten');

            return (
              <g key={`b-${k}`} className={klassen.join(' ')}>
                <line x1={von.x - dx} y1={von.y - dy} x2={nach.x - dx} y2={nach.y - dy} />
                {werte[k] === 2 && (
                  <line x1={von.x + dx} y1={von.y + dy} x2={nach.x + dx} y2={nach.y + dy} />
                )}
              </g>
            );
          })}

          {raetsel.inseln.map((insel, i) => {
            const klassen = ['insel'];
            if (grade[i] === insel.grad) klassen.push('insel-fertig');
            else if (grade[i] > insel.grad) klassen.push('insel-zuviel');
            if (gewaehlt === i) klassen.push('insel-gewaehlt');

            return (
              <g key={i} className={klassen.join(' ')} data-insel={i}>
                {/* Der unsichtbare Kreis ist das Ziel für den Daumen; der
                    sichtbare wäre dafür zu klein. */}
                <circle className="insel-griff" cx={insel.c + 0.5} cy={insel.r + 0.5} r={0.5} />
                <circle className="insel-rund" cx={insel.c + 0.5} cy={insel.r + 0.5} r={0.36} />
                <text
                  className="insel-zahl"
                  x={insel.c + 0.5}
                  y={insel.r + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {insel.grad}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="insel-fuss">
        <button
          className="button button-ghost"
          onClick={tippNehmen}
          disabled={tipps >= TIPPS || !laeuft}
        >
          Tipp ({TIPPS - tipps})
        </button>

        <p className={meldung ? 'error' : 'hint'}>
          {meldung ??
            (zustand === 'gewonnen'
              ? 'Ein Netz, keine Insel übrig.'
              : zustand === 'aufgegeben'
                ? 'Aufgelöst.'
                : 'Zwei Inseln verbinden: hinüberziehen oder nacheinander antippen.')}
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
                : 'Auf der Karte steht jetzt die Lösung.'}
            </p>
            <div className="sheet-actions">
              <button className="button" onClick={naechstes}>
                Nächstes Rätsel
              </button>
              <button className="button button-ghost" onClick={() => setZeigeErgebnis(false)}>
                Karte ansehen
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
  stats: BridgesStats;
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
