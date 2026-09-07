import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import { ANSICHTEN } from './bereiche';
import { eintragen, leeresBlatt, werten, type Blatt, type Wertung } from './logic';
import { BEREICHE, BEREICH_NAME, RUNDEN, RUNDEN_BONI, type Bereich, type Bonus } from './sheet';
import {
  moeglicheZiele,
  nachWahl,
  naechsteRunde,
  neueRunde,
  passivWaehlbar,
  startePassiv,
  verzichten,
  alleWuerfel,
  weisserWert,
  werfen,
  type Wuerfel,
  type Ziel,
  type Zugstand,
} from './wuerfel';

/** Freigeschaltete und schon verbrauchte Felder je Aktionsleiste. */
export interface Aktionen {
  neuwurf: { frei: number; benutzt: number };
  extra: { frei: number; benutzt: number };
}

export interface Laufend {
  blatt: Blatt;
  stand: Zugstand;
  aktionen: Aktionen;
  /** Noch einzulösende Boni. Sie können sich gegenseitig auslösen. */
  boni: Bonus[];
}

export interface CleverSave {
  version: 1;
  laufend: Laufend | null;
  letzte: Wertung | null;
  beste: number;
  partien: number;
}

const LEER: CleverSave = { version: 1, laufend: null, letzte: null, beste: 0, partien: 0 };

const wuerfel = () => Math.random();

const neueAktionen = (): Aktionen => ({ neuwurf: { frei: 0, benutzt: 0 }, extra: { frei: 0, benutzt: 0 } });

export function Clever({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<CleverSave>(user.id, 'clever', LEER);

  const [bereich, setBereich] = useState<Bereich>('gelb');
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [bonusWert, setBonusWert] = useState<number | null>(null);
  const [bonusFarbe, setBonusFarbe] = useState<Bereich | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  /**
   * Ein Schritt zurück. Der Wurf danach wird mitgespeichert: wählt man
   * denselben Würfel erneut, kommen dieselben Würfel wieder – sonst könnte man
   * sich durch Zurücknehmen einen besseren Wurf erschleichen.
   */
  const [zurueck, setZurueck] = useState<{ vorher: Laufend; index: number; nachher: Zugstand } | null>(
    null,
  );
  /**
   * Zählt jeden Wurf. Die Würfel bekommen die Nummer in ihren React-Key, damit
   * sie bei einem neuen Wurf neu aufgebaut werden und die Animation anläuft –
   * sonst wechselt nur lautlos die Zahl.
   */
  const [wurfNr, setWurfNr] = useState(0);
  const gewuerfelt = () => setWurfNr((n) => n + 1);
  /** Die Aktion „Extrawürfel" lässt einen der sechs Würfel der Runde nehmen. */
  const [extraModus, setExtraModus] = useState(false);

  /**
   * In der Warteschlange dürfen nur Boni stehen, die sich auch abfragen
   * lassen. Alles andere gehört auf eine Aktionsleiste – landet es doch dort,
   * bliebe die Abfrage ohne wählbare Zahl stehen und das Spiel hinge fest.
   * Deshalb wird beim Einlesen aufgeräumt; das rettet auch ältere Spielstände.
   */
  const laufend = useMemo<Laufend | null>(() => {
    const l = save.laufend;
    if (!l) return null;
    const boni = l.boni ?? [];
    if (boni.every((b) => b.art === 'frage' || b.art === 'weiss')) return l;
    return boni.reduce(bonusEinsortieren, { ...l, boni: [] });
  }, [save.laufend]);

  const zeige = useCallback((text: string) => {
    setMeldung(text);
    setTimeout(() => setMeldung((m) => (m === text ? null : m)), 2200);
  }, []);

  // ------------------------------------------------------------- Partie

  const starten = () => {
    const leer: Laufend = {
      blatt: leeresBlatt(),
      stand: neueRunde(1, wuerfel),
      aktionen: neueAktionen(),
      boni: [],
    };
    const rundenBonus = RUNDEN_BONI[0];
    const start = rundenBonus ? bonusEinsortieren(leer, rundenBonus) : leer;
    persist((v) => ({ ...v, laufend: start }));
    setGewaehlt(null);
    setZurueck(null);
    setExtraModus(false);
    gewuerfelt();
  };

  const beenden = (blatt: Blatt) => {
    const wertung = werten(blatt);
    persist((v) => ({
      version: 1,
      laufend: null,
      letzte: wertung,
      beste: Math.max(v.beste ?? 0, wertung.gesamt),
      partien: (v.partien ?? 0) + 1,
    }));
  };

  // -------------------------------------------------------- Eintragen

  /** Trägt ein Ziel ein und verteilt die dadurch ausgelösten Boni. */
  const anwenden = useCallback((l: Laufend, ziel: Ziel, restBoni: Bonus[]): Laufend => {
    const { blatt, boni } = eintragen(l.blatt, ziel);
    return boni.reduce(bonusEinsortieren, { ...l, blatt, boni: restBoni });
  }, []);

  const weiss = laufend ? weisserWert(laufend.stand) : null;

  /** Ziele für den gerade gewählten Würfel oder den offenen Bonus. */
  const ziele: Ziel[] = useMemo(() => {
    if (!laufend) return [];

    const bonus = laufend.boni[0];
    if (bonus) {
      // Der weiße Würfel behält seinen gewürfelten Wert – frei wählbar ist nur
      // der Bereich. Eine Zahl darf man sich ausschließlich beim ? aussuchen.
      if (bonus.art === 'weiss') {
        return weiss === null ? [] : moeglicheZiele(laufend.blatt, { farbe: 'weiss', wert: weiss }, weiss);
      }
      if (bonusWert === null) return [];
      if (bonus.art === 'frage') {
        const farbe = bonus.farbe === 'schwarz' ? bonusFarbe : bonus.farbe;
        if (!farbe) return [];
        // Beim blauen ? darf jedes freie Feld angekreuzt werden.
        if (farbe === 'blau') {
          const frei: Ziel[] = [];
          laufend.blatt.blau.forEach((zeile, r) =>
            zeile.forEach((gekreuzt, c) => {
              if (!gekreuzt) {
                frei.push({ bereich: 'blau', wert: bonusWert, ziel: [r, c], beschreibung: `Zeile ${r + 1}, Spalte ${c + 1}` });
              }
            }),
          );
          return frei;
        }
        return moeglicheZiele(laufend.blatt, { farbe, wert: bonusWert }, weiss);
      }
      return [];
    }

    if (gewaehlt === null) return [];
    const w = (extraModus ? alleWuerfel(laufend.stand) : waehlbareWuerfel(laufend))[gewaehlt];
    return w ? moeglicheZiele(laufend.blatt, w, weiss) : [];
  }, [laufend, gewaehlt, bonusWert, bonusFarbe, weiss, extraModus]);

  /**
   * Es wird immer nur ein Bereich gezeigt. Liegen die möglichen Ziele in einem
   * anderen, muss die Ansicht dorthin springen – sonst wären sie unerreichbar,
   * etwa wenn ein Bonus in eine ganz andere Farbe führt.
   */
  useEffect(() => {
    if (ziele.length === 0) return;
    if (ziele.some((z) => z.bereich === bereich)) return;
    setBereich(ziele[0].bereich);
  }, [ziele, bereich]);

  /** Ein Ziel im Blatt antippen – entweder für den offenen Bonus oder für den gewählten Würfel. */
  const zielGewaehlt = (ziel: Ziel) => {
    if (!laufend) return;

    if (laufend.boni[0]) {
      persist((v) => ({ ...v, laufend: anwenden(laufend, ziel, laufend.boni.slice(1)) }));
      setBonusWert(null);
      setBonusFarbe(null);
      return;
    }

    if (gewaehlt !== null) zielGewaehltMit(gewaehlt, ziel);
  };

  /** Zu Beginn der Runden 1 bis 4 gibt es einen Bonus obendrauf. */
  const rundenBonusAnhaengen = (l: Laufend, alteRunde: number): Laufend => {
    if (l.stand.phase === 'spielende') return l;
    // RUNDEN_BONI ist 0-basiert, `alteRunde` 1-basiert: das ist der Index der
    // neuen Runde.
    const bonus = RUNDEN_BONI[alteRunde];
    return bonus ? bonusEinsortieren(l, bonus) : l;
  };

  // ---------------------------------------------------------- Würfelwahl

  const wuerfelAntippen = (index: number) => {
    if (!laufend) return;
    const w = (extraModus ? alleWuerfel(laufend.stand) : waehlbareWuerfel(laufend))[index];
    const moeglich = moeglicheZiele(laufend.blatt, w, weiss);

    if (moeglich.length === 0) {
      zeige('Dieser Würfel passt nirgendwo.');
      return;
    }

    setGewaehlt(index);

    // Gibt es nur ein Ziel, wird sofort eingetragen.
    if (moeglich.length === 1) {
      setBereich(moeglich[0].bereich);
      zielGewaehltMit(index, moeglich[0]);
      return;
    }
    setBereich(moeglich[0].bereich);
  };

  /** Kernweg: Ziel eintragen und den Würfelzustand weiterdrehen. */
  const zielGewaehltMit = (index: number, ziel: Ziel) => {
    if (!laufend) return;
    const vorher = laufend;
    const zwischen = anwenden(laufend, ziel, laufend.boni);
    meldeNeueBoni(laufend, zwischen);

    // Ein Extrawürfel hängt nur am Zug dran: er verbraucht kein Würfelfeld und
    // dreht den Wurf nicht weiter.
    if (extraModus) {
      persist((v) => ({ ...v, laufend: zwischen }));
      setExtraModus(false);
      setGewaehlt(null);
      return;
    }

    if (laufend.stand.phase === 'aktiv') {
      const wiederholt = zurueck && zurueck.index === index && zurueck.vorher.stand === vorher.stand;
      const stand = wiederholt ? zurueck.nachher : nachWahl(laufend.stand, index, wuerfel);
      persist((v) => ({ ...v, laufend: { ...zwischen, stand } }));
      setZurueck({ vorher, index, nachher: stand });
    } else {
      const nach = { ...zwischen, stand: naechsteRunde(laufend.stand, wuerfel) };
      persist((v) => ({ ...v, laufend: rundenBonusAnhaengen(nach, laufend.stand.runde) }));
      setZurueck(null);
    }
    gewuerfelt();
    setGewaehlt(null);
  };

  /**
   * Ein freigeschalteter Bonus darf nicht untergehen – ohne Hinweis merkt man
   * gar nicht, dass das Platzieren gerade etwas ausgelöst hat.
   */
  const meldeNeueBoni = (vorher: Laufend, nachher: Laufend) => {
    const neue: string[] = [];
    if (nachher.aktionen.neuwurf.frei > vorher.aktionen.neuwurf.frei) neue.push('Neuwurf');
    if (nachher.aktionen.extra.frei > vorher.aktionen.extra.frei) neue.push('Extrawürfel');
    if (nachher.blatt.fuechse > vorher.blatt.fuechse) neue.push('Fuchs');
    for (const b of nachher.boni.slice(vorher.boni.length)) neue.push(bonusName(b));
    if (neue.length) zeige(`Erhalten: ${neue.join(', ')}`);
  };

  const zurueckNehmen = () => {
    if (!zurueck) return;
    persist((v) => ({ ...v, laufend: zurueck.vorher }));
    setGewaehlt(null);
    zeige('Zug zurückgenommen.');
  };

  // ------------------------------------------------------------ Aktionen

  const neuwurfEinsetzen = () => {
    if (!laufend) return;
    const stand = {
      ...laufend.stand,
      offen: werfen(laufend.stand.offen.map((w) => w.farbe), wuerfel),
    };
    const aktionen = {
      ...laufend.aktionen,
      neuwurf: { ...laufend.aktionen.neuwurf, benutzt: laufend.aktionen.neuwurf.benutzt + 1 },
    };
    persist((v) => ({ ...v, laufend: { ...laufend, stand, aktionen } }));
    setGewaehlt(null);
    setZurueck(null);
    gewuerfelt();
  };

  const extraEinsetzen = () => {
    if (!laufend) return;
    // Ein zusätzlicher Würfel am Zugende. Gewählt wird einer der sechs Würfel
    // dieser Runde mit seinem gewürfelten Wert, nicht eine freie Zahl.
    const aktionen = {
      ...laufend.aktionen,
      extra: { ...laufend.aktionen.extra, benutzt: laufend.aktionen.extra.benutzt + 1 },
    };
    persist((v) => ({ ...v, laufend: { ...laufend, aktionen } }));
    setExtraModus(true);
    setGewaehlt(null);
    zeige(`Extrawürfel: einen der sechs Würfel dieser Runde wählen.`);
  };

  // ------------------------------------------------------------- Anzeige

  if (status === 'laden') return <div className="splash">…</div>;

  if (!laufend) {
    return (
      <div className="game">
        <Kopf runde={null} onExit={onExit} />
        <div className="centered">
          <div className="card">
            <h1>Clever 4Ever</h1>
            <p className="muted">
              Sechs Runden würfeln, fünf Bereiche füllen. Wer zu früh einen hohen Würfel nimmt,
              hat für die nächsten Würfe nichts mehr übrig.
            </p>
            {save.letzte && (
              <div className="stat-row">
                <div className="stat">
                  <strong>{save.letzte.gesamt}</strong>
                  <span>zuletzt</span>
                </div>
                <div className="stat">
                  <strong>{save.beste}</strong>
                  <span>beste</span>
                </div>
                <div className="stat">
                  <strong>{save.partien}</strong>
                  <span>Partien</span>
                </div>
              </div>
            )}
            {save.letzte && <p className="hint">„{save.letzte.titel}"</p>}
            <button className="button" onClick={starten}>
              {save.partien ? 'Neue Partie' : 'Losspielen'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { blatt, stand, aktionen, boni } = laufend;
  const bonus = boni[0];
  const waehlbar = extraModus ? alleWuerfel(stand) : waehlbareWuerfel(laufend);
  const phaseFertig = stand.phase === 'aktiv' && stand.offen.length === 0;
  const Ansicht = ANSICHTEN[bereich];

  if (stand.phase === 'spielende') {
    return <Ende blatt={blatt} onFertig={() => beenden(blatt)} onExit={onExit} />;
  }

  return (
    <div className="game">
      <Kopf runde={stand.runde} phase={stand.phase} wurf={stand.wurf} onExit={onExit} />

      {meldung && <div className="toast">{meldung}</div>}

      <div className="clever-blatt">
        <Ansicht blatt={blatt} ziele={ziele} onZiel={zielGewaehlt} />
      </div>

      <Tisch stand={stand} />

      <BereichsLeiste
        aktiv={bereich}
        ziele={ziele}
        blatt={blatt}
        onWahl={setBereich}
      />

      {bonus ? (
        <BonusWahl
          bonus={bonus}
          blatt={blatt}
          weiss={weiss}
          wert={bonusWert}
          farbe={bonusFarbe}
          onFarbe={setBonusFarbe}
          onWert={setBonusWert}
          onVerfallen={() => {
            persist((v) => ({ ...v, laufend: { ...laufend, boni: boni.slice(1) } }));
            setBonusWert(null);
            setBonusFarbe(null);
            zeige('Bonus verfällt – kein Platz dafür.');
          }}
        />
      ) : (
        <div className="clever-zug">
          <AktionsLeiste
            aktionen={aktionen}
            phase={stand.phase}
            hatOffen={stand.offen.length > 0}
            onNeuwurf={neuwurfEinsetzen}
            onExtra={extraEinsetzen}
          />

          {extraModus && (
            <div className="bonus-hinweis">
              Extrawürfel: einen der sechs Würfel dieser Runde wählen – mit seinem Wert.
            </div>
          )}

          <div className="wuerfel-reihe">
            {waehlbar.map((w, i) => {
              const nutzbar = moeglicheZiele(blatt, w, weiss).length > 0;
              return (
                <button
                  key={`${wurfNr}-${w.farbe}-${i}`}
                  className={[
                    'wuerfel',
                    'wuerfel-neu',
                    `wuerfel-${w.farbe}`,
                    gewaehlt === i ? 'wuerfel-gewaehlt' : '',
                    nutzbar ? '' : 'wuerfel-blass',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => wuerfelAntippen(i)}
                >
                  {w.wert}
                </button>
              );
            })}
            {waehlbar.length === 0 && <span className="muted">Keine Würfel übrig.</span>}
          </div>

          <div className="clever-knoepfe">
            {extraModus && (
              <button className="button button-ghost" onClick={() => setExtraModus(false)}>
                Doch keinen
              </button>
            )}
            {!extraModus && zurueck && (
              <button className="button button-ghost" onClick={zurueckNehmen}>
                Zurücknehmen
              </button>
            )}
            {stand.phase === 'aktiv' && !phaseFertig && (
              <button
                className="button button-ghost"
                onClick={() => {
                  persist((v) => ({ ...v, laufend: { ...laufend, stand: verzichten(stand, wuerfel) } }));
                  setGewaehlt(null);
                  setZurueck(null);
                  gewuerfelt();
                }}
              >
                Verzichten
              </button>
            )}
            {phaseFertig && (
              <button
                className="button"
                onClick={() => {
                  persist((v) => ({ ...v, laufend: { ...laufend, stand: startePassiv(stand, wuerfel) } }));
                  setGewaehlt(null);
                  setZurueck(null);
                  gewuerfelt();
                }}
              >
                Weiter: Tablett
              </button>
            )}
            {stand.phase === 'passiv' && waehlbar.length === 0 && (
              <button
                className="button"
                onClick={() => {
                  const nach = { ...laufend, stand: naechsteRunde(stand, wuerfel) };
                  persist((v) => ({ ...v, laufend: rundenBonusAnhaengen(nach, stand.runde) }));
                  setZurueck(null);
                  gewuerfelt();
                }}
              >
                Runde beenden
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'fehler' && <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>}
    </div>
  );
}

/** In der aktiven Phase die geworfenen, in der passiven die vom Tablett. */
function waehlbareWuerfel(l: Laufend): Wuerfel[] {
  return l.stand.phase === 'passiv' ? passivWaehlbar(l.stand, l.blatt) : l.stand.offen;
}

/** Lesbarer Name eines Bonus für Hinweise. */
function bonusName(bonus: Bonus): string {
  switch (bonus.art) {
    case 'frage':
      return bonus.farbe === 'schwarz' ? 'schwarzes ?' : `${BEREICH_NAME[bonus.farbe]}-?`;
    case 'weiss':
      return 'weißer Würfel';
    case 'plus1':
    case 'extra':
      return 'Extrawürfel';
    case 'neuwurf':
      return 'Neuwurf';
    case 'fuchs':
      return 'Fuchs';
    case 'polieren':
      return 'Silber polieren';
  }
}

/**
 * Ein Bonus landet entweder auf einer Aktionsleiste oder in der Warteschlange
 * der sofort einzulösenden Boni. Füchse sind schon in `logic.ts` gezählt.
 */
function bonusEinsortieren(l: Laufend, bonus: Bonus): Laufend {
  switch (bonus.art) {
    case 'neuwurf':
      return {
        ...l,
        aktionen: { ...l.aktionen, neuwurf: { ...l.aktionen.neuwurf, frei: l.aktionen.neuwurf.frei + 1 } },
      };
    // Das "+1" auf dem Blatt füllt die Extrawürfel-Leiste.
    case 'plus1':
    case 'extra':
      return {
        ...l,
        aktionen: { ...l.aktionen, extra: { ...l.aktionen.extra, frei: l.aktionen.extra.frei + 1 } },
      };
    case 'fuchs':
    case 'polieren':
      return l;
    default:
      return { ...l, boni: [...l.boni, bonus] };
  }
}

// ------------------------------------------------------------- Bausteine

function Kopf({
  runde,
  phase,
  wurf,
  onExit,
}: {
  runde: number | null;
  phase?: string;
  wurf?: number;
  onExit: () => void;
}) {
  return (
    <header className="game-bar">
      <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
        ←
      </button>
      <div className="game-bar-title">
        <strong>Clever 4Ever</strong>
        {runde !== null && (
          <span>
            Runde {runde}/{RUNDEN}
            {phase === 'aktiv' ? ` · Wurf ${wurf}` : phase === 'passiv' ? ' · Tablett' : ''}
          </span>
        )}
      </div>
      <div style={{ width: '2.75rem' }} />
    </header>
  );
}

/**
 * Würfelfelder und Tablett. Beides gehört zum Spielstand: die Felder zeigen,
 * wie viele Würfe noch kommen, und in der passiven Phase wird vom Tablett
 * gewählt.
 */
function Tisch({ stand }: { stand: Zugstand }) {
  const felder = [0, 1, 2].map((i) => stand.felder[i]);
  const tablett = stand.phase === 'passiv' ? stand.passivFelder : stand.tablett;

  return (
    <div className="tisch">
      <div className="tisch-teil">
        <span className="tisch-name">Felder</span>
        <div className="tisch-wuerfel">
          {felder.map((w, i) =>
            w === undefined ? (
              <span key={i} className="mini mini-frei" />
            ) : w === null ? (
              <span key={i} className="mini mini-leer">
                –
              </span>
            ) : (
              <span key={i} className={`mini wuerfel-${w.farbe}`}>
                {w.wert}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="tisch-teil">
        <span className="tisch-name">{stand.phase === 'passiv' ? 'Genommen' : 'Tablett'}</span>
        <div className="tisch-wuerfel">
          {tablett.length === 0 && <span className="mini mini-frei" />}
          {tablett.map((w, i) => (
            <span key={i} className={`mini wuerfel-${w.farbe}`}>
              {w.wert}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BereichsLeiste({
  aktiv,
  ziele,
  blatt,
  onWahl,
}: {
  aktiv: Bereich;
  ziele: Ziel[];
  blatt: Blatt;
  onWahl: (b: Bereich) => void;
}) {
  const punkte = werten(blatt);
  return (
    <div className="bereichs-leiste">
      {BEREICHE.map((b) => (
        <button
          key={b}
          className={[
            'bereichs-knopf',
            `bereich-${b}`,
            b === aktiv ? 'bereichs-knopf-aktiv' : '',
            ziele.some((z) => z.bereich === b) ? 'bereichs-knopf-moeglich' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onWahl(b)}
        >
          <span className="bereichs-name">{BEREICH_NAME[b]}</span>
          <span className="bereichs-punkte">{punkte[b]}</span>
        </button>
      ))}
    </div>
  );
}

function AktionsLeiste({
  aktionen,
  phase,
  hatOffen,
  onNeuwurf,
  onExtra,
}: {
  aktionen: Aktionen;
  phase: string;
  hatOffen: boolean;
  onNeuwurf: () => void;
  onExtra: () => void;
}) {
  const neuwurfFrei = aktionen.neuwurf.frei - aktionen.neuwurf.benutzt;
  const extraFrei = aktionen.extra.frei - aktionen.extra.benutzt;
  const neuwurfGeht = neuwurfFrei > 0 && phase === 'aktiv' && hatOffen;
  const extraGeht = extraFrei > 0;

  if (!neuwurfGeht && !extraGeht) return null;

  return (
    <div className="aktions-leiste">
      {neuwurfGeht && (
        <button className="aktion" onClick={onNeuwurf}>
          ↻ Neuwurf <span className="aktion-zahl">{neuwurfFrei}</span>
        </button>
      )}
      {extraGeht && (
        <button className="aktion" onClick={onExtra}>
          +1 Extrawürfel <span className="aktion-zahl">{extraFrei}</span>
        </button>
      )}
    </div>
  );
}

function BonusWahl({
  bonus,
  blatt,
  weiss,
  wert,
  farbe,
  onWert,
  onFarbe,
  onVerfallen,
}: {
  bonus: Bonus;
  blatt: Blatt;
  weiss: number | null;
  wert: number | null;
  farbe: Bereich | null;
  onWert: (w: number | null) => void;
  onFarbe: (f: Bereich) => void;
  onVerfallen: () => void;
}) {
  const schwarz = bonus.art === 'frage' && bonus.farbe === 'schwarz';
  const zielFarbe: Bereich | 'weiss' | null =
    bonus.art === 'weiss'
      ? 'weiss'
      : bonus.art === 'frage'
        ? bonus.farbe === 'schwarz'
          ? farbe
          : bonus.farbe
        : null;

  const zahlGeht = (zahl: number) => {
    if (zielFarbe === null) return false;
    if (zielFarbe === 'weiss') return moeglicheZiele(blatt, { farbe: 'weiss', wert: zahl }, weiss).length > 0;
    if (zielFarbe === 'blau') return blatt.blau.some((z) => z.some((f) => !f));
    return moeglicheZiele(blatt, { farbe: zielFarbe, wert: zahl }, weiss).length > 0;
  };

  const zahlen = [1, 2, 3, 4, 5, 6];
  const nichtsMoeglich = zielFarbe !== null && zahlen.every((z) => !zahlGeht(z));

  // Beim weißen Würfel steht die Zahl schon fest – gewürfelt ist gewürfelt.
  // Frei wählen darf man nur den Bereich, deshalb entfällt hier die Zahlwahl.
  if (bonus.art === 'weiss') {
    return (
      <div className="clever-zug bonus-zug">
        <div className="bonus-kopf">Weißer Würfel: {weiss ?? '–'}</div>
        <div className="bonus-hinweis">
          {weiss === null
            ? 'Kein weißer Würfel in dieser Runde.'
            : 'Bereich im Blatt antippen – nicht für Blau.'}
        </div>
        {(weiss === null || moeglicheZiele(blatt, { farbe: 'weiss', wert: weiss }, weiss).length === 0) && (
          <div className="clever-knoepfe">
            <button className="button" onClick={onVerfallen}>
              Kein Platz – Bonus verfällt
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="clever-zug bonus-zug">
      <div className="bonus-kopf">
        {schwarz && !farbe
          ? 'Schwarzer Bonus: Farbe wählen'
          : `Bonus ${zielFarbe && zielFarbe !== 'weiss' ? BEREICH_NAME[zielFarbe] : ''}: Zahl wählen`}
      </div>

      {schwarz && !farbe ? (
        <div className="wuerfel-reihe">
          {BEREICHE.map((b) => (
            <button key={b} className={`wuerfel wuerfel-${b}`} onClick={() => onFarbe(b)}>
              {BEREICH_NAME[b][0]}
            </button>
          ))}
        </div>
      ) : nichtsMoeglich ? (
        <div className="clever-knoepfe">
          <button className="button" onClick={onVerfallen}>
            Kein Platz – Bonus verfällt
          </button>
        </div>
      ) : (
        <div className="wuerfel-reihe">
          {zahlen.map((zahl) => (
            <button
              key={zahl}
              className={`wuerfel wuerfel-bonus${wert === zahl ? ' wuerfel-gewaehlt' : ''}${zahlGeht(zahl) ? '' : ' wuerfel-blass'}`}
              onClick={() => zahlGeht(zahl) && onWert(zahl)}
            >
              {zahl}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Ende({ blatt, onFertig, onExit }: { blatt: Blatt; onFertig: () => void; onExit: () => void }) {
  const w = werten(blatt);
  return (
    <div className="game">
      <Kopf runde={null} onExit={onExit} />
      <div className="centered">
        <div className="card">
          <h1>{w.gesamt} Punkte</h1>
          <p className="hint">„{w.titel}"</p>
          <div className="stat-row">
            {BEREICHE.map((b) => (
              <div className="stat" key={b}>
                <strong>{w[b]}</strong>
                <span>{BEREICH_NAME[b]}</span>
              </div>
            ))}
          </div>
          <p className="muted">Füchse: {w.fuechse} Punkte</p>
          <button className="button" onClick={onFertig}>
            Ergebnis speichern
          </button>
        </div>
      </div>
    </div>
  );
}
