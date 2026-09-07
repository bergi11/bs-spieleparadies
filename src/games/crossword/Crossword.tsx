import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import {
  FELDER,
  LEER,
  SEITE,
  TIPPS,
  ersteLuecke,
  felderVon,
  frageAn,
  gefuellt,
  istSchwarz,
  leereEingabe,
  naechstesFeld,
  nummern,
  reihenfolge,
  richtungFuer,
  schreibe,
  stand,
  voll,
  vorigesFeld,
  wortStimmt,
  type Daten,
  type Frage,
  type Raetsel,
} from './logic';
import raetselJson from './raetsel.json';

const DATEN = raetselJson as Daten;

const TASTEN = ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'];

export interface CrosswordStats {
  gespielt: number;
  geloest: number;
  /** Gelöst, ohne einen Buchstaben verraten zu bekommen. */
  makellos: number;
  serie: number;
  besteSerie: number;
}

export interface CrosswordSave {
  /** 1-basierte Nummer des aktuellen Rätsels. */
  raetsel: number;
  /** 25 Zeichen: Buchstabe, '.' für leer, '#' für schwarz. */
  eingabe: string;
  /** Felder, die ein Tipp gefüllt hat – die bleiben stehen. */
  verraten: number[];
  tipps: number;
  aufgegeben: boolean;
  stats: CrosswordStats;
}

const LEERE_STATS: CrosswordStats = {
  gespielt: 0,
  geloest: 0,
  makellos: 0,
  serie: 0,
  besteSerie: 0,
};

const EMPTY: CrosswordSave = {
  raetsel: 1,
  eingabe: '',
  verraten: [],
  tipps: 0,
  aufgegeben: false,
  stats: LEERE_STATS,
};

function lob(tipps: number): string {
  if (tipps === 0) return 'Alle Wörter selbst gefunden!';
  if (tipps === 1) return 'Fast ohne Hilfe!';
  return 'Gitter voll!';
}

function merken(stats: CrosswordStats, tipps: number | null): CrosswordStats {
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

export function Crossword({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<CrosswordSave>(
    user.id,
    'crossword',
    EMPTY,
  );

  const [feld, setFeld] = useState(0);
  const [waagerecht, setWaagerecht] = useState(true);
  const [zeigeErgebnis, setZeigeErgebnis] = useState(true);
  const [zeigeStats, setZeigeStats] = useState(false);
  const [zeigeFragen, setZeigeFragen] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const nummer = Math.min(Math.max(save.raetsel ?? 1, 1), DATEN.raetsel.length);
  const raetsel: Raetsel = DATEN.raetsel[nummer - 1];
  const stats = save.stats ?? LEERE_STATS;

  /**
   * Ein gespeicherter Stand gehört nur dann zu diesem Rätsel, wenn seine
   * schwarzen Felder an derselben Stelle sitzen. Sonst lieber leer anfangen.
   */
  const eingabe = useMemo(() => {
    const roh = save.eingabe ?? '';
    if (roh.length !== FELDER) return leereEingabe(raetsel);
    const passt = roh
      .split('')
      .every((zeichen, i) => (zeichen === '#') === istSchwarz(raetsel, i));
    if (!passt) return leereEingabe(raetsel);
    return roh
      .split('')
      .map((zeichen, i) =>
        istSchwarz(raetsel, i) ? '#' : /^[A-Z]$/.test(zeichen) ? zeichen : LEER,
      )
      .join('');
  }, [raetsel, save.eingabe]);

  const verraten = useMemo(() => new Set(save.verraten ?? []), [save.verraten]);
  const marken = useMemo(() => nummern(raetsel), [raetsel]);

  const tipps = save.tipps ?? 0;
  const aufgegeben = save.aufgegeben ?? false;
  const zustand = stand(raetsel, eingabe, aufgegeben);
  const laeuft = zustand === 'laeuft' && status !== 'laden';

  const frage: Frage | undefined = frageAn(raetsel, feld, waagerecht);
  const imWort = useMemo(() => (frage ? felderVon(frage) : []), [frage]);

  // Beim Rätselwechsel auf das erste weiße Feld, damit die Auswahl nicht auf
  // einem schwarzen Feld hängen bleibt.
  useEffect(() => {
    const erstes = raetsel.fragen.find((f) => f.waagerecht) ?? raetsel.fragen[0];
    setFeld(erstes.start);
    setWaagerecht(erstes.waagerecht);
    setZeigeErgebnis(true);
    setMeldung(null);
  }, [raetsel]);

  useEffect(() => {
    if (!meldung) return;
    const zeit = setTimeout(() => setMeldung(null), 2200);
    return () => clearTimeout(zeit);
  }, [meldung]);

  const merkeStand = useCallback(
    (neu: string, perTipp: boolean, verratenesFeld?: number) => {
      persist((vorher) => {
        const verratene = [...(vorher.verraten ?? [])];
        if (perTipp && verratenesFeld !== undefined && !verratene.includes(verratenesFeld)) {
          verratene.push(verratenesFeld);
        }
        const tippZahl = (vorher.tipps ?? 0) + (perTipp ? 1 : 0);
        const vorherStimmt = raetsel.fragen.every((f) => wortStimmt(f, vorher.eingabe ?? ''));
        const jetztStimmt = raetsel.fragen.every((f) => wortStimmt(f, neu));

        return {
          ...vorher,
          eingabe: neu,
          verraten: verratene,
          tipps: tippZahl,
          stats:
            jetztStimmt && !vorherStimmt && !(vorher.aufgegeben ?? false)
              ? merken(vorher.stats ?? LEERE_STATS, tippZahl)
              : (vorher.stats ?? LEERE_STATS),
        };
      });
    },
    [persist, raetsel],
  );

  const buchstabe = useCallback(
    (zeichen: string) => {
      if (!laeuft || !frage || verraten.has(feld)) return;

      const neu = schreibe(eingabe, feld, zeichen);
      merkeStand(neu, false);

      const weiter = naechstesFeld(frage, feld);
      if (weiter !== null) setFeld(weiter);

      if (voll(raetsel, neu) && !raetsel.fragen.every((f) => wortStimmt(f, neu))) {
        setMeldung('Das Gitter ist voll, aber irgendwo steckt noch ein Fehler.');
      }
    },
    [eingabe, feld, frage, laeuft, merkeStand, raetsel, verraten],
  );

  const loeschen = useCallback(() => {
    if (!laeuft || !frage) return;

    if (eingabe[feld] !== LEER && !verraten.has(feld)) {
      merkeStand(schreibe(eingabe, feld, LEER), false);
      return;
    }

    // Ist das Feld schon leer, geht es rückwärts weiter – so wie man es von
    // jeder Tastatur kennt.
    const zurueck = vorigesFeld(frage, feld);
    if (zurueck === null) return;
    setFeld(zurueck);
    if (!verraten.has(zurueck)) merkeStand(schreibe(eingabe, zurueck, LEER), false);
  }, [eingabe, feld, frage, laeuft, merkeStand, verraten]);

  const waehle = useCallback(
    (ziel: number) => {
      if (istSchwarz(raetsel, ziel)) return;

      if (ziel === feld) {
        const andere = richtungFuer(raetsel, ziel, !waagerecht);
        if (andere !== null) setWaagerecht(andere);
        return;
      }

      const richtung = richtungFuer(raetsel, ziel, waagerecht);
      if (richtung === null) return;
      setWaagerecht(richtung);
      setFeld(ziel);
    },
    [feld, raetsel, waagerecht],
  );

  /** Zur nächsten oder vorigen Frage springen. */
  const blaettern = useCallback(
    (schritt: number) => {
      const liste = reihenfolge(raetsel);
      const platz = frage ? liste.findIndex((f) => f === frage) : 0;
      const naechste = liste[(platz + schritt + liste.length) % liste.length];
      setWaagerecht(naechste.waagerecht);
      setFeld(ersteLuecke(naechste, eingabe));
    },
    [eingabe, frage, raetsel],
  );

  const tippNehmen = useCallback(() => {
    if (tipps >= TIPPS || !laeuft) return;

    const richtig = raetsel.gitter;
    const falsch: number[] = [];
    for (let i = 0; i < FELDER; i++) {
      if (istSchwarz(raetsel, i)) continue;
      if (eingabe[i] !== richtig[i]) falsch.push(i);
    }
    if (falsch.length === 0) return;

    // Am liebsten im gerade gewählten Wort: dort hilft ein Buchstabe am meisten.
    const imBlick = falsch.filter((i) => imWort.includes(i));
    const auswahl = imBlick.length > 0 ? imBlick : falsch;
    const ziel = auswahl[Math.floor(Math.random() * auswahl.length)];

    merkeStand(schreibe(eingabe, ziel, richtig[ziel]), true, ziel);
  }, [eingabe, imWort, laeuft, merkeStand, raetsel, tipps]);

  const aufgeben = useCallback(() => {
    setZeigeStats(false);
    persist((vorher) => ({
      ...vorher,
      eingabe: raetsel.gitter,
      aufgegeben: true,
      stats: merken(vorher.stats ?? LEERE_STATS, null),
    }));
  }, [persist, raetsel]);

  const naechstes = useCallback(() => {
    setZeigeErgebnis(false);
    setZeigeStats(false);
    setZeigeFragen(false);

    const folge = nummer >= DATEN.raetsel.length ? 1 : nummer + 1;
    persist((vorher) => ({
      ...vorher,
      raetsel: folge,
      eingabe: leereEingabe(DATEN.raetsel[folge - 1]),
      verraten: [],
      tipps: 0,
      aufgegeben: false,
    }));
  }, [nummer, persist]);

  // Am Rechner tippt man auf der richtigen Tastatur.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (zeigeStats || zeigeFragen || (zustand !== 'laeuft' && zeigeErgebnis)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Backspace') {
        event.preventDefault();
        loeschen();
      } else if (event.key === ' ') {
        event.preventDefault();
        waehle(feld);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        blaettern(event.shiftKey ? -1 : 1);
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        buchstabe(event.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blaettern, buchstabe, feld, loeschen, waehle, zeigeErgebnis, zeigeFragen, zeigeStats, zustand]);

  const offen = raetsel.fragen.filter((f) => !wortStimmt(f, eingabe)).length;

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Kreuzchen</strong>
          <span>
            Rätsel {nummer} · {gefuellt(raetsel, eingabe)} Buchstaben
          </span>
        </div>
        <button className="icon-button" onClick={() => setZeigeStats(true)} aria-label="Statistik">
          📊
        </button>
      </header>

      <div className="kreuzchen-brett">
        <div className="kreuzchen-gitter">
          {Array.from({ length: FELDER }, (_, i) => {
            if (istSchwarz(raetsel, i)) {
              return <div key={i} className="kreuzchen-feld kreuzchen-feld-schwarz" />;
            }

            const klassen = ['kreuzchen-feld'];
            if (i === feld) klassen.push('kreuzchen-feld-gewaehlt');
            else if (imWort.includes(i)) klassen.push('kreuzchen-feld-wort');
            if (verraten.has(i)) klassen.push('kreuzchen-feld-verraten');

            return (
              <button
                key={i}
                className={klassen.join(' ')}
                onClick={() => waehle(i)}
                disabled={!laeuft}
                aria-label={`Zeile ${Math.floor(i / SEITE) + 1}, Spalte ${(i % SEITE) + 1}`}
              >
                {marken.has(i) && <span className="kreuzchen-nr">{marken.get(i)}</span>}
                <span className="kreuzchen-buchstabe">
                  {eingabe[i] === LEER ? '' : eingabe[i]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="kreuzchen-frage">
        <button className="icon-button" onClick={() => blaettern(-1)} aria-label="Vorige Frage">
          ‹
        </button>
        <button className="kreuzchen-text" onClick={() => setZeigeFragen(true)}>
          {frage ? (
            <>
              <span className="kreuzchen-marke">
                {frage.nr} {frage.waagerecht ? 'waagerecht' : 'senkrecht'}
              </span>
              <span>{frage.hinweis}</span>
            </>
          ) : (
            <span>Kein Wort gewählt.</span>
          )}
        </button>
        <button className="icon-button" onClick={() => blaettern(1)} aria-label="Nächste Frage">
          ›
        </button>
      </div>

      {meldung ? (
        <p className="error kreuzchen-meldung">{meldung}</p>
      ) : (
        <p className="hint kreuzchen-meldung">
          {zustand === 'gewonnen'
            ? 'Alles richtig.'
            : zustand === 'aufgegeben'
              ? 'Aufgelöst.'
              : `Noch ${offen} ${offen === 1 ? 'Wort' : 'Wörter'} offen · Feld noch einmal antippen dreht die Richtung.`}
        </p>
      )}

      <div className="keyboard">
        {TASTEN.map((reihe, index) => (
          <div className="keyboard-row" key={reihe}>
            {index === 2 && (
              <button
                className="key key-wide"
                onClick={tippNehmen}
                disabled={tipps >= TIPPS || !laeuft}
              >
                Tipp {TIPPS - tipps}
              </button>
            )}
            {reihe.split('').map((zeichen) => (
              <button
                key={zeichen}
                className="key"
                onClick={() => buchstabe(zeichen)}
                disabled={!laeuft}
              >
                {zeichen}
              </button>
            ))}
            {index === 2 && (
              <button
                className="key key-wide"
                onClick={loeschen}
                disabled={!laeuft}
                aria-label="Löschen"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      {status === 'fehler' && (
        <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>
      )}

      {zeigeFragen && (
        <FragenSheet
          raetsel={raetsel}
          eingabe={eingabe}
          onWaehlen={(gewaehlt) => {
            setWaagerecht(gewaehlt.waagerecht);
            setFeld(ersteLuecke(gewaehlt, eingabe));
            setZeigeFragen(false);
          }}
          onClose={() => setZeigeFragen(false)}
        />
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

function FragenSheet({
  raetsel,
  eingabe,
  onWaehlen,
  onClose,
}: {
  raetsel: Raetsel;
  eingabe: string;
  onWaehlen: (frage: Frage) => void;
  onClose: () => void;
}) {
  const liste = reihenfolge(raetsel);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>Alle Fragen</h2>

        {[true, false].map((richtung) => (
          <div key={String(richtung)}>
            <h3>{richtung ? 'Waagerecht' : 'Senkrecht'}</h3>
            <ul className="kreuzchen-liste">
              {liste
                .filter((frage) => frage.waagerecht === richtung)
                .map((frage) => (
                  <li key={`${frage.nr}-${String(frage.waagerecht)}`}>
                    <button
                      className={wortStimmt(frage, eingabe) ? 'kreuzchen-fertig' : undefined}
                      onClick={() => onWaehlen(frage)}
                    >
                      <strong>{frage.nr}</strong> {frage.hinweis}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}

        <div className="sheet-actions">
          <button className="button" onClick={onClose}>
            Weiterspielen
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsSheet({
  stats,
  kannAufgeben,
  onAufgeben,
  onClose,
}: {
  stats: CrosswordStats;
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
