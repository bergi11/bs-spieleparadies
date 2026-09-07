import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import { ANSICHTEN } from './bereiche';
import { eintragen, fuchsQuellen, leeresBlatt, werten, type Blatt, type Wertung } from './logic';
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
  polierbar,
  polieren,
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
  polieren: { frei: number; benutzt: number };
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

const neueAktionen = (): Aktionen => ({
  neuwurf: { frei: 0, benutzt: 0 },
  extra: { frei: 0, benutzt: 0 },
  polieren: { frei: 0, benutzt: 0 },
});

/** Ältere Spielstände kennen die Polierleiste noch nicht. */
const mitPolieren = (a: Aktionen): Aktionen => ({ ...a, polieren: a.polieren ?? { frei: 0, benutzt: 0 } });

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
  /** Die Aktion „Silber polieren" verändert einen Würfel um ±1. */
  const [polierModus, setPolierModus] = useState(false);
  /**
   * Der Wurf läuft in vier Schritten ab: `bereit` wartet auf den Tipp,
   * `rollt` zeigt die taumelnden Würfel groß, `landet` schiebt sie nach unten,
   * `fertig` blendet die Bühne aus. Ohne den Tipp fühlt es sich an, als hätte
   * das Spiel gewürfelt und nicht der Spieler.
   */
  const [wurfPhase, setWurfPhase] = useState<'bereit' | 'rollt' | 'landet' | 'fertig'>('fertig');
  const [joker, setJoker] = useState<string[] | null>(null);
  const uhren = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => uhren.current.forEach(clearTimeout), []);

  /**
   * In der Warteschlange dürfen nur Boni stehen, die sich auch abfragen
   * lassen. Alles andere gehört auf eine Aktionsleiste – landet es doch dort,
   * bliebe die Abfrage ohne wählbare Zahl stehen und das Spiel hinge fest.
   * Deshalb wird beim Einlesen aufgeräumt; das rettet auch ältere Spielstände.
   */
  const laufend = useMemo<Laufend | null>(() => {
    const l = save.laufend;
    if (!l) return null;
    const gerade = { ...l, aktionen: mitPolieren(l.aktionen) };
    const boni = gerade.boni ?? [];
    if (boni.every((b) => b.art === 'frage')) return gerade;
    return boni.reduce(bonusEinsortieren, { ...gerade, boni: [] });
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

  /**
   * Was auf der Würfelbühne gezeigt wird. In der aktiven Phase sind das die
   * eben geworfenen, in der passiven alle sechs – dort wird ja komplett neu
   * geworfen und erst danach aufgeteilt.
   */
  const buehnenWuerfel: Wuerfel[] = !laufend
    ? []
    : laufend.stand.phase === 'passiv'
      ? [...laufend.stand.tablett, ...laufend.stand.passivFelder]
      : laufend.stand.offen;

  /** Ziele für den gerade gewählten Würfel oder den offenen Bonus. */
  const ziele: Ziel[] = useMemo(() => {
    if (!laufend) return [];

    // In der Warteschlange stehen nur noch ?-Boni; alles andere füllt eine
    // Aktionsleiste und wird nicht abgefragt.
    const bonus = laufend.boni[0];
    if (bonus) {
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

  /**
   * In der passiven Phase liegen zwar alle sechs Würfel offen, genommen werden
   * darf aber nur vom Tablett – und nur wenn dort gar nichts passt, von den
   * Würfeln des aktiven Spielers.
   */
  const darfWaehlen = (w: Wuerfel): boolean => {
    if (!laufend || laufend.stand.phase !== 'passiv' || extraModus) return true;
    return passivWaehlbar(laufend.stand, laufend.blatt).includes(w);
  };

  const wuerfelAntippen = (index: number) => {
    if (!laufend) return;
    const w = (extraModus ? alleWuerfel(laufend.stand) : waehlbareWuerfel(laufend))[index];
    const moeglich = moeglicheZiele(laufend.blatt, w, weiss);

    if (moeglich.length === 0) {
      zeige('Dieser Würfel passt nirgendwo.');
      return;
    }
    if (!darfWaehlen(w)) {
      zeige('Erst vom Silbertablett nehmen.');
      return;
    }

    // Auch bei nur einem möglichen Ziel wird nicht sofort eingetragen: beim
    // Spielen ist sonst nicht nachvollziehbar, wo der Würfel gelandet ist.
    // Der Zug wird immer im Blatt bestätigt.
    setGewaehlt(index);
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
   * Ein freigeschalteter Joker darf nicht untergehen – ohne deutlichen Hinweis
   * merkt man gar nicht, dass das Platzieren gerade etwas ausgelöst hat.
   */
  const meldeNeueBoni = (vorher: Laufend, nachher: Laufend) => {
    const neue: string[] = [];
    if (nachher.aktionen.neuwurf.frei > vorher.aktionen.neuwurf.frei) neue.push('Neuwurf');
    if (nachher.aktionen.extra.frei > vorher.aktionen.extra.frei) neue.push('Extrawürfel');
    if (nachher.aktionen.polieren.frei > vorher.aktionen.polieren.frei) neue.push('Silber polieren');
    if (nachher.blatt.fuechse > vorher.blatt.fuechse) neue.push('Fuchs');
    for (const b of nachher.boni.slice(vorher.boni.length)) neue.push(bonusName(b));
    if (!neue.length) return;

    setJoker(neue);
    uhren.current.push(setTimeout(() => setJoker(null), 2400));
  };

  // ------------------------------------------------------- Würfeln

  /** Nach jedem Wurf wartet die Bühne auf den Tipp des Spielers. */
  useEffect(() => {
    if (wurfNr === 0) return;
    setWurfPhase(buehnenWuerfel.length > 0 ? 'bereit' : 'fertig');
    // Nur der Wurf selbst soll das auslösen, nicht jede Zustandsänderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wurfNr]);

  const wuerfeln = () => {
    setWurfPhase('rollt');
    uhren.current.push(setTimeout(() => setWurfPhase('landet'), 900));
    uhren.current.push(setTimeout(() => setWurfPhase('fertig'), 1280));
  };

  const polierEinsetzen = (farbe: Wuerfel['farbe'], richtung: 1 | -1) => {
    if (!laufend) return;
    const stand = polieren(laufend.stand, farbe, richtung);
    const aktionen = {
      ...laufend.aktionen,
      polieren: { ...laufend.aktionen.polieren, benutzt: laufend.aktionen.polieren.benutzt + 1 },
    };
    persist((v) => ({ ...v, laufend: { ...laufend, stand, aktionen } }));
    setPolierModus(false);
    setGewaehlt(null);
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

  /** Ein Würfel zum Antippen. Blass, wenn er nirgends passt oder gesperrt ist. */
  const wuerfelKnopf = (w: Wuerfel, i: number) => {
    const nutzbar = moeglicheZiele(blatt, w, weiss).length > 0 && darfWaehlen(w);
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
  };

  if (stand.phase === 'spielende') {
    return <Ende blatt={blatt} onFertig={() => beenden(blatt)} onExit={onExit} />;
  }

  return (
    <div className="game">
      <Kopf runde={stand.runde} phase={stand.phase} wurf={stand.wurf} onExit={onExit} />

      <FuchsLeiste blatt={blatt} />

      {meldung && <div className="toast">{meldung}</div>}

      <div className="clever-buehne">
        <div className="clever-blatt">
          <Ansicht blatt={blatt} ziele={ziele} onZiel={zielGewaehlt} />
        </div>

        {/* Offene Boni kommen vor dem nächsten Wurf. Läge die Bühne davor,
            müsste man erst würfeln und danach den Bonus einlösen – das ist
            genau verkehrt herum und verwirrt beim Spielen. */}
        {wurfPhase !== 'fertig' && !bonus && (
          <WurfBuehne wuerfel={buehnenWuerfel} phase={wurfPhase} onWuerfeln={wuerfeln} />
        )}
      </div>

      <Tisch stand={stand} verdeckt={wurfPhase !== 'fertig'} />

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
          {wurfPhase === 'fertig' && (
          <AktionsLeiste
            aktionen={aktionen}
            phase={stand.phase}
            hatOffen={stand.offen.length > 0}
            hatWuerfel={waehlbar.length > 0}
            onNeuwurf={neuwurfEinsetzen}
            onExtra={extraEinsetzen}
            onPolieren={() => {
              setPolierModus(true);
              setGewaehlt(null);
            }}
          />
          )}

          {extraModus && (
            <div className="bonus-hinweis">
              Extrawürfel: einen der sechs Würfel dieser Runde wählen – mit seinem Wert.
            </div>
          )}
          {polierModus && (
            <div className="bonus-hinweis">Silber polieren: einen Würfel um 1 verändern.</div>
          )}

          {/* Solange die Bühne läuft, bleiben die Werte verdeckt – sonst
              stünde das Ergebnis schon unten, bevor gewürfelt wurde. */}
          {wurfPhase !== 'fertig' ? (
            <div className="wuerfel-reihe">
              {buehnenWuerfel.map((_, i) => (
                <span key={i} className="wuerfel wuerfel-verdeckt" />
              ))}
            </div>
          ) : polierModus ? (
            <div className="wuerfel-reihe">
              {waehlbar.map((w, i) => (
                <div className="polier-paar" key={`${w.farbe}-${i}`}>
                  <span className={`wuerfel wuerfel-${w.farbe}`}>{w.wert}</span>
                  <div className="polier-knoepfe">
                    <button
                      className="polier"
                      disabled={!polierbar(w, -1)}
                      onClick={() => polierEinsetzen(w.farbe, -1)}
                    >
                      −
                    </button>
                    <button
                      className="polier"
                      disabled={!polierbar(w, 1)}
                      onClick={() => polierEinsetzen(w.farbe, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : stand.phase === 'passiv' ? (
            // Beide Gruppen zeigen, damit klar ist was ausliegt und woher man
            // nehmen darf.
            <div className="wuerfel-gruppen">
              <div className="wuerfel-gruppe">
                <span className="tisch-name">Silbertablett</span>
                <div className="wuerfel-reihe">
                  {waehlbar.slice(0, stand.tablett.length).map((w, i) => wuerfelKnopf(w, i))}
                </div>
              </div>
              <div className="wuerfel-gruppe">
                <span className="tisch-name">Aktiver Spieler</span>
                <div className="wuerfel-reihe">
                  {waehlbar
                    .slice(stand.tablett.length)
                    .map((w, i) => wuerfelKnopf(w, stand.tablett.length + i))}
                </div>
              </div>
            </div>
          ) : (
            <div className="wuerfel-reihe">
              {waehlbar.map((w, i) => wuerfelKnopf(w, i))}
              {waehlbar.length === 0 && <span className="muted">Keine Würfel übrig.</span>}
            </div>
          )}

          <div className="clever-knoepfe">
            {polierModus && (
              <button className="button button-ghost" onClick={() => setPolierModus(false)}>
                Abbrechen
              </button>
            )}
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

      {joker && <JokerPopup namen={joker} onSchliessen={() => setJoker(null)} />}

      {status === 'fehler' && <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>}
    </div>
  );
}

/**
 * Die angezeigten Würfel. In der passiven Phase sind das **alle sechs** –
 * erst das Tablett, dann die drei beim gedachten aktiven Spieler. Sonst wäre
 * nicht zu sehen, was überhaupt ausliegt; welche davon genommen werden dürfen,
 * entscheidet `passivWaehlbar`.
 */
function waehlbareWuerfel(l: Laufend): Wuerfel[] {
  return l.stand.phase === 'passiv'
    ? [...l.stand.tablett, ...l.stand.passivFelder]
    : l.stand.offen;
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
    // Das Kreissymbol auf dem Blatt ist "Silber polieren". Die Sorte "weiss"
    // steckt nur noch in alten Spielständen und meint dasselbe.
    case 'polieren':
    case 'weiss':
      return {
        ...l,
        aktionen: { ...l.aktionen, polieren: { ...l.aktionen.polieren, frei: l.aktionen.polieren.frei + 1 } },
      };
    case 'fuchs':
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
 * Die Füchse. Jeder zählt am Ende so viel wie der schwächste Bereich, deshalb
 * lohnt sich der Blick darauf während der Partie. Noch offene Füchse stehen als
 * Umriss in der Farbe ihres Bereichs da – so sieht man, wo noch etwas zu holen
 * ist.
 */
function FuchsLeiste({ blatt }: { blatt: Blatt }) {
  const quellen = fuchsQuellen(blatt);
  const geholt = quellen.filter((q) => q.erreicht).length;

  return (
    <div className="fuchs-leiste">
      {quellen.map((q, i) => (
        <span
          key={i}
          className={`fuchs bereich-${q.bereich}${
            q.schattierung ? ` fuchs-schatten-${q.schattierung}` : ''
          }${q.erreicht ? ' fuchs-da' : ''}`}
          title={`${BEREICH_NAME[q.bereich]}${q.schattierung ? ` (${q.schattierung})` : ''}`}
        >
          {/* Das Symbol trägt die Ausgrauung, nicht der Kreis – sonst würde
              der farbige Umriss mit entfärbt. */}
          <span className="fuchs-bild">🦊</span>
        </span>
      ))}
      <span className="fuchs-zahl">
        {geholt}/{quellen.length}
      </span>
    </div>
  );
}

/**
 * Würfelfelder und Tablett. Beides gehört zum Spielstand: die Felder zeigen,
 * wie viele Würfe noch kommen, und in der passiven Phase wird vom Tablett
 * gewählt.
 */
function Tisch({ stand, verdeckt }: { stand: Zugstand; verdeckt: boolean }) {
  const felder = [0, 1, 2].map((i) => stand.felder[i]);
  // In der passiven Phase stehen Tablett und fremde Würfel schon in der
  // Würfelzeile – hier bliebe nur eine Dopplung.
  const tablett = stand.phase === 'passiv' ? [] : stand.tablett;

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

      {stand.phase !== 'passiv' && (
      <div className="tisch-teil">
        <span className="tisch-name">Tablett</span>
        <div className="tisch-wuerfel">
          {tablett.length === 0 && <span className="mini mini-frei" />}
          {/* Während des Wurfs verdeckt: das Tablett gehört bei der passiven
              Phase zum frischen Wurf und würde ihn sonst vorwegnehmen. */}
          {tablett.map((w, i) =>
            verdeckt ? (
              <span key={i} className="mini mini-frei" />
            ) : (
              <span key={i} className={`mini wuerfel-${w.farbe}`}>
                {w.wert}
              </span>
            ),
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Die Würfelbühne über dem Blatt. Erst wartet sie auf den Tipp, dann taumeln
 * die Würfel groß über die Fläche, zuletzt rutschen sie nach unten zu ihrem
 * Platz. Ohne den Tipp fühlt es sich an, als hätte das Spiel gewürfelt.
 */
function WurfBuehne({
  wuerfel,
  phase,
  onWuerfeln,
}: {
  wuerfel: Wuerfel[];
  phase: 'bereit' | 'rollt' | 'landet';
  onWuerfeln: () => void;
}) {
  if (phase === 'bereit') {
    return (
      <button className="wurf-buehne wurf-bereit" onClick={onWuerfeln}>
        <span className="wurf-symbol">🎲</span>
        <span className="wurf-text">Tippen zum Würfeln</span>
      </button>
    );
  }

  return (
    <div className={`wurf-buehne ${phase === 'landet' ? 'wurf-landet' : 'wurf-rollt'}`}>
      <div className="wurf-wolke">
        {wuerfel.map((w, i) => (
          <span
            key={`${w.farbe}-${i}`}
            className={`wuerfel wuerfel-gross wuerfel-${w.farbe}`}
            // Leicht versetzt, damit die Würfel nicht im Gleichschritt fallen.
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {w.wert}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kurzer, deutlicher Hinweis auf einen freigeschalteten Joker. */
function JokerPopup({ namen, onSchliessen }: { namen: string[]; onSchliessen: () => void }) {
  return (
    <div className="joker-hof" onClick={onSchliessen}>
      <div className="joker-karte">
        <div className="joker-stern">✦</div>
        <strong>{namen.length > 1 ? 'Joker erhalten' : 'Joker erhalten'}</strong>
        <span className="joker-namen">{namen.join(' · ')}</span>
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
  hatWuerfel,
  onNeuwurf,
  onExtra,
  onPolieren,
}: {
  aktionen: Aktionen;
  phase: string;
  hatOffen: boolean;
  hatWuerfel: boolean;
  onNeuwurf: () => void;
  onExtra: () => void;
  onPolieren: () => void;
}) {
  const neuwurfFrei = aktionen.neuwurf.frei - aktionen.neuwurf.benutzt;
  const extraFrei = aktionen.extra.frei - aktionen.extra.benutzt;
  const polierFrei = aktionen.polieren.frei - aktionen.polieren.benutzt;

  const neuwurfGeht = neuwurfFrei > 0 && phase === 'aktiv' && hatOffen;
  const extraGeht = extraFrei > 0;
  // Poliert wird meist als passiver Spieler am Tablett – deshalb nicht an
  // die aktive Phase gebunden, sondern an die gerade wählbaren Würfel.
  const polierGeht = polierFrei > 0 && hatWuerfel;

  if (!neuwurfGeht && !extraGeht && !polierGeht) return null;

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
      {polierGeht && (
        <button className="aktion" onClick={onPolieren}>
          ±1 Polieren <span className="aktion-zahl">{polierFrei}</span>
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
