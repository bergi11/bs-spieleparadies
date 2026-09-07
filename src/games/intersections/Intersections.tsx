import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import {
  FELDER,
  SEITE,
  TIPPS,
  baueIndex,
  erfuellt,
  gefuellt,
  leereEingaben,
  leereTipps,
  normalisiere,
  pruefeEingabe,
  rueckmeldung,
  stand,
  wortFuer,
  type Daten,
  type Eigenschaft,
  type Kategorie,
  type Raetsel,
} from './logic';
import datenJson from './daten.json';

const DATEN = datenJson as Daten;
const KATEGORIEN = new Map(DATEN.kategorien.map((k) => [k.id, k]));
const EIGENSCHAFTEN = new Map(DATEN.eigenschaften.map((e) => [e.id, e]));
const INDEX = baueIndex(DATEN.kategorien);

export interface IntersectionsStats {
  gespielt: number;
  geloest: number;
  /** Gelöst, ohne einen Tipp zu nehmen. */
  makellos: number;
  serie: number;
  besteSerie: number;
}

export interface IntersectionsSave {
  /** 1-basierte Nummer des aktuellen Rätsels. */
  raetsel: number;
  /** Für jedes der 16 Felder das eingetragene Wort, sonst leer. */
  eingaben: string[];
  /** Welche Felder ein Tipp gefüllt hat. */
  verraten: boolean[];
  tipps: number;
  aufgegeben: boolean;
  stats: IntersectionsStats;
}

const LEERE_STATS: IntersectionsStats = {
  gespielt: 0,
  geloest: 0,
  makellos: 0,
  serie: 0,
  besteSerie: 0,
};

const EMPTY: IntersectionsSave = {
  raetsel: 1,
  eingaben: [],
  verraten: [],
  tipps: 0,
  aufgegeben: false,
  stats: LEERE_STATS,
};

/** Lange Wörter müssen kleiner werden, sonst sprengen sie die Zelle. */
function schriftKlasse(wort: string): string {
  if (wort.length <= 6) return 'kreuz-wort kreuz-wort-kurz';
  if (wort.length <= 9) return 'kreuz-wort kreuz-wort-mittel';
  if (wort.length <= 13) return 'kreuz-wort kreuz-wort-lang';
  return 'kreuz-wort kreuz-wort-winzig';
}

function lob(tipps: number): string {
  if (tipps === 0) return 'Alles selbst gefunden!';
  if (tipps === 1) return 'Fast ohne Hilfe!';
  return 'Geschafft!';
}

function merken(stats: IntersectionsStats, tipps: number | null): IntersectionsStats {
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

export function Intersections({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<IntersectionsSave>(
    user.id,
    'intersections',
    EMPTY,
  );

  const [offenesFeld, setOffenesFeld] = useState<number | null>(null);
  const [zeigeErgebnis, setZeigeErgebnis] = useState(true);
  const [zeigeStats, setZeigeStats] = useState(false);

  const nummer = Math.min(Math.max(save.raetsel ?? 1, 1), DATEN.raetsel.length);
  const raetsel: Raetsel = DATEN.raetsel[nummer - 1];
  const stats = save.stats ?? LEERE_STATS;

  const zeilen = useMemo(
    () => raetsel.zeilen.map((id) => KATEGORIEN.get(id)!),
    [raetsel],
  );
  const spalten = useMemo(
    () => raetsel.spalten.map((id) => EIGENSCHAFTEN.get(id)!),
    [raetsel],
  );

  /**
   * Nach neu erzeugten Daten könnten im Spielstand Wörter stehen, die zu diesem
   * Gitter nicht mehr passen. Solche Felder gelten als leer, statt eine falsche
   * Lösung stehen zu lassen.
   */
  const eingaben = useMemo(() => {
    const roh = save.eingaben ?? [];
    return Array.from({ length: FELDER }, (_, feld) => {
      const wort = roh[feld] ?? '';
      if (!wort) return '';
      const treffer = INDEX.get(normalisiere(wort));
      const zeile = zeilen[Math.floor(feld / SEITE)];
      const spalte = spalten[feld % SEITE];
      const passt =
        treffer?.kategorie === zeile.id && erfuellt(spalte.regel, treffer?.wort ?? '');
      return passt ? wort : '';
    });
  }, [save.eingaben, spalten, zeilen]);

  const verraten = useMemo(() => {
    const roh = save.verraten ?? [];
    return Array.from({ length: FELDER }, (_, feld) => Boolean(roh[feld]) && Boolean(eingaben[feld]));
  }, [eingaben, save.verraten]);

  const tipps = save.tipps ?? 0;
  const aufgegeben = save.aufgegeben ?? false;
  const zustand = stand(eingaben, aufgegeben);
  const fertig = gefuellt(eingaben);

  // Nach einem Rätselwechsel soll das Ergebnisblatt wieder erscheinen dürfen.
  useEffect(() => {
    setZeigeErgebnis(true);
  }, [nummer]);

  const eintragen = useCallback(
    (feld: number, wort: string, perTipp = false) => {
      persist((vorher) => {
        const alteEingaben = [...(vorher.eingaben ?? leereEingaben())];
        const alteVerraten = [...(vorher.verraten ?? leereTipps())];
        while (alteEingaben.length < FELDER) alteEingaben.push('');
        while (alteVerraten.length < FELDER) alteVerraten.push(false);

        alteEingaben[feld] = wort;
        alteVerraten[feld] = perTipp;

        const vollGewesen = gefuellt(vorher.eingaben ?? []) === FELDER;
        const vollJetzt = gefuellt(alteEingaben) === FELDER;
        const tippZahl = (vorher.tipps ?? 0) + (perTipp ? 1 : 0);

        return {
          ...vorher,
          eingaben: alteEingaben,
          verraten: alteVerraten,
          tipps: tippZahl,
          stats:
            vollJetzt && !vollGewesen && !(vorher.aufgegeben ?? false)
              ? merken(vorher.stats ?? LEERE_STATS, tippZahl)
              : (vorher.stats ?? LEERE_STATS),
        };
      });
    },
    [persist],
  );

  const leeren = useCallback(
    (feld: number) => {
      persist((vorher) => {
        const alteEingaben = [...(vorher.eingaben ?? leereEingaben())];
        const alteVerraten = [...(vorher.verraten ?? leereTipps())];
        while (alteEingaben.length < FELDER) alteEingaben.push('');
        while (alteVerraten.length < FELDER) alteVerraten.push(false);
        alteEingaben[feld] = '';
        alteVerraten[feld] = false;
        return { ...vorher, eingaben: alteEingaben, verraten: alteVerraten };
      });
    },
    [persist],
  );

  const tippNehmen = useCallback(() => {
    if (tipps >= TIPPS || zustand !== 'laeuft') return;

    const leere = eingaben
      .map((wort, feld) => (wort ? -1 : feld))
      .filter((feld) => feld >= 0);
    if (leere.length === 0) return;

    const feld = leere[Math.floor(Math.random() * leere.length)];
    const wort = wortFuer(
      zeilen[Math.floor(feld / SEITE)],
      spalten[feld % SEITE],
      raetsel.loesung[feld],
      eingaben.filter(Boolean),
    );
    if (!wort) return;

    setOffenesFeld(null);
    eintragen(feld, wort, true);
  }, [eingaben, eintragen, raetsel, spalten, tipps, zeilen, zustand]);

  const aufgeben = useCallback(() => {
    setZeigeStats(false);
    setOffenesFeld(null);

    const geloest = [...eingaben];
    for (let feld = 0; feld < FELDER; feld++) {
      if (geloest[feld]) continue;
      geloest[feld] =
        wortFuer(
          zeilen[Math.floor(feld / SEITE)],
          spalten[feld % SEITE],
          raetsel.loesung[feld],
          geloest.filter(Boolean),
        ) ?? raetsel.loesung[feld];
    }

    persist((vorher) => ({
      ...vorher,
      eingaben: geloest,
      verraten: geloest.map((_, feld) => !eingaben[feld]),
      aufgegeben: true,
      stats: merken(vorher.stats ?? LEERE_STATS, null),
    }));
  }, [eingaben, persist, raetsel, spalten, zeilen]);

  const naechstes = useCallback(() => {
    setZeigeErgebnis(false);
    setZeigeStats(false);
    setOffenesFeld(null);
    const folge = nummer >= DATEN.raetsel.length ? 1 : nummer + 1;
    persist((vorher) => ({
      ...vorher,
      raetsel: folge,
      eingaben: leereEingaben(),
      verraten: leereTipps(),
      tipps: 0,
      aufgegeben: false,
    }));
  }, [nummer, persist]);

  return (
    <div className="game">
      <header className="game-bar">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Schnittpunkte</strong>
          <span>
            Rätsel {nummer} · {fertig}/{FELDER} Felder
          </span>
        </div>
        <button className="icon-button" onClick={() => setZeigeStats(true)} aria-label="Statistik">
          📊
        </button>
      </header>

      <div className="kreuz-brett">
        <div className="kreuz-gitter">
          <div className="kreuz-ecke" aria-hidden="true" />
          {spalten.map((spalte) => (
            <div className="kreuz-kopf" key={spalte.id}>
              {spalte.label}
            </div>
          ))}

          {zeilen.map((zeile, z) => (
            <Fragment key={zeile.id}>
              <div className="kreuz-kopf kreuz-kopf-zeile">{zeile.label}</div>
              {Array.from({ length: SEITE }, (_, s) => {
                const feld = z * SEITE + s;
                const wort = eingaben[feld];

                const klassen = ['kreuz-feld'];
                if (wort) klassen.push(verraten[feld] ? 'kreuz-feld-verraten' : 'kreuz-feld-voll');
                if (offenesFeld === feld) klassen.push('kreuz-feld-offen');

                return (
                  <button
                    key={feld}
                    className={klassen.join(' ')}
                    onClick={() => setOffenesFeld(feld)}
                    // Nach dem letzten Feld bleibt das Gitter stehen, wie es ist:
                    // sonst ließe sich ein gelöstes Rätsel erneut lösen.
                    disabled={status === 'laden' || zustand !== 'laeuft'}
                    aria-label={`${zeile.label}, ${spalten[s].label}${wort ? `: ${wort}` : ' – leer'}`}
                  >
                    {wort ? <span className={schriftKlasse(wort)}>{wort}</span> : '+'}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="kreuz-fuss">
        <button
          className="button button-ghost"
          onClick={tippNehmen}
          disabled={tipps >= TIPPS || zustand !== 'laeuft' || fertig === FELDER}
        >
          Tipp ({TIPPS - tipps})
        </button>
        <p className="hint">
          {zustand === 'laeuft'
            ? 'Tippe auf ein Feld und trage ein Wort ein, das zu Zeile und Spalte passt.'
            : zustand === 'gewonnen'
              ? 'Gitter voll.'
              : 'Aufgelöst.'}
        </p>
      </div>

      {status === 'fehler' && (
        <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>
      )}

      {offenesFeld !== null && (
        <EingabeSheet
          zeile={zeilen[Math.floor(offenesFeld / SEITE)]}
          spalte={spalten[offenesFeld % SEITE]}
          bestand={eingaben[offenesFeld]}
          benutzt={eingaben.filter((wort, feld) => Boolean(wort) && feld !== offenesFeld)}
          onEintragen={(wort) => {
            eintragen(offenesFeld, wort);
            setOffenesFeld(null);
          }}
          onLeeren={() => {
            leeren(offenesFeld);
            setOffenesFeld(null);
          }}
          onClose={() => setOffenesFeld(null)}
        />
      )}

      {zustand !== 'laeuft' && zeigeErgebnis && offenesFeld === null && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <h2>{zustand === 'gewonnen' ? lob(tipps) : 'Aufgelöst.'}</h2>
            <p className="muted">
              {zustand === 'gewonnen'
                ? tipps === 0
                  ? `Rätsel ${nummer} ohne Tipp gelöst.`
                  : `Rätsel ${nummer} mit ${tipps} ${tipps === 1 ? 'Tipp' : 'Tipps'} gelöst.`
                : 'Im Gitter steht jetzt eine mögliche Lösung.'}
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
          kannAufgeben={zustand === 'laeuft' && fertig < FELDER}
          onAufgeben={aufgeben}
          onClose={() => setZeigeStats(false)}
        />
      )}
    </div>
  );
}

function EingabeSheet({
  zeile,
  spalte,
  bestand,
  benutzt,
  onEintragen,
  onLeeren,
  onClose,
}: {
  zeile: Kategorie;
  spalte: Eigenschaft;
  bestand: string;
  benutzt: string[];
  onEintragen: (wort: string) => void;
  onLeeren: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(bestand);
  const [meldung, setMeldung] = useState<string | null>(null);
  const feldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    feldRef.current?.focus();
  }, []);

  const absenden = (event: React.FormEvent) => {
    event.preventDefault();
    const urteil = pruefeEingabe(text, zeile, spalte, INDEX, DATEN.kategorien, benutzt);
    if (urteil.art === 'ok') {
      onEintragen(urteil.wort);
      return;
    }
    setMeldung(rueckmeldung(urteil, spalte));
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(event) => event.stopPropagation()} onSubmit={absenden}>
        <h2 className="kreuz-frage">
          {zeile.label}
          <span className="kreuz-mal">×</span>
          {spalte.label}
        </h2>

        <input
          ref={feldRef}
          className="input kreuz-eingabe"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setMeldung(null);
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="Dein Wort"
        />

        {meldung ? <p className="error">{meldung}</p> : <p className="hint">Ein Wort pro Gitter.</p>}

        <div className="sheet-actions">
          <button className="button" type="submit">
            Eintragen
          </button>
          {bestand && (
            <button className="button button-ghost" type="button" onClick={onLeeren}>
              Feld leeren
            </button>
          )}
          <button className="button button-ghost" type="button" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}

function StatsSheet({
  stats,
  kannAufgeben,
  onAufgeben,
  onClose,
}: {
  stats: IntersectionsStats;
  kannAufgeben: boolean;
  onAufgeben: () => void;
  onClose: () => void;
}) {
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
          {kannAufgeben && (
            <button className="button button-ghost" onClick={onAufgeben}>
              Auflösen
            </button>
          )}
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
