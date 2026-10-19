import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../registry';
import { useGameSave } from '../../lib/useGameSave';
import { RegelnKnopf, Spielregeln } from '../../components/Spielregeln';
import {
  FORMEN,
  GROESSE,
  KOMBO_LUFT,
  LEER_BONUS,
  gueltig,
  irgendwoPlatz,
  legen,
  masse,
  neuePartie,
  passt,
  wuerdeRaeumen,
  type Partie,
  type Stueck,
} from './logic';

export interface BlocksSave {
  version: 1;
  /** Die laufende oder zuletzt beendete Partie – das Brett bleibt stehen. */
  partie: Partie | null;
  /** Ob die beendete Partie den Rekord gebrochen hat. */
  rekord: boolean;
  beste: number;
  partien: number;
}

const LEER: BlocksSave = { version: 1, partie: null, rekord: false, beste: 0, partien: 0 };

/** Wo der Finger gerade eine Form hinzieht. */
interface Ziehen {
  index: number;
  x: number;
  y: number;
}

/** Abmessungen des Bretts in Pixeln, gemessen beim Zugriff. */
interface Raster {
  links: number;
  oben: number;
  /** Abstand von Zellanfang zu Zellanfang. */
  schritt: number;
  zelle: number;
}

/**
 * Die gezogene Form schwebt über dem Finger, nicht darunter – sonst verdeckt
 * der Daumen genau die Stelle, auf die es ankommt. Gemessen in Zellen.
 */
const ANHEBEN = 1.6;

export function Blocks({ user, onExit }: GameProps) {
  const { state: save, save: persist, status } = useGameSave<BlocksSave>(user.id, 'blocks', LEER);

  const [ziehen, setZiehen] = useState<Ziehen | null>(null);
  const [blitz, setBlitz] = useState<{ felder: Map<number, number>; nr: number } | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; nr: number } | null>(null);
  const [zeigeErgebnis, setZeigeErgebnis] = useState(true);
  const [zeigeStats, setZeigeStats] = useState(false);
  const [zeigeHilfe, setZeigeHilfe] = useState(false);
  const brett = useRef<HTMLDivElement>(null);
  const raster = useRef<Raster | null>(null);

  const partie = gueltig(save.partie) ? save.partie : null;
  const beste = save.beste ?? 0;

  useEffect(() => {
    if (!blitz) return;
    const zeit = setTimeout(() => setBlitz(null), 380);
    return () => clearTimeout(zeit);
  }, [blitz]);

  useEffect(() => {
    if (!meldung) return;
    const zeit = setTimeout(() => setMeldung(null), 1100);
    return () => clearTimeout(zeit);
  }, [meldung]);

  const vermessen = (): Raster | null => {
    const zellen = brett.current?.children;
    if (!zellen || zellen.length < GROESSE) return null;
    const erste = zellen[0].getBoundingClientRect();
    const letzte = zellen[GROESSE - 1].getBoundingClientRect();
    return {
      links: erste.left,
      oben: erste.top,
      schritt: (letzte.left - erste.left) / (GROESSE - 1),
      zelle: erste.width,
    };
  };

  const gezogen = ziehen && partie ? partie.hand[ziehen.index] : null;

  /** Linke obere Ecke der schwebenden Form in Pixeln. */
  const schwebt = useMemo(() => {
    const r = raster.current;
    if (!ziehen || !gezogen || !r) return null;
    const { hoehe, breite } = masse(gezogen.zellen);
    return {
      x: ziehen.x - (breite * r.schritt) / 2,
      y: ziehen.y - (hoehe + ANHEBEN) * r.schritt,
    };
  }, [gezogen, ziehen]);

  /** Wo die Form landen würde – nur gesetzt, wenn sie dort auch passt. */
  const ziel = useMemo(() => {
    const r = raster.current;
    if (!schwebt || !gezogen || !partie || !r) return null;
    const zeile = Math.round((schwebt.y - r.oben) / r.schritt);
    const spalte = Math.round((schwebt.x - r.links) / r.schritt);
    if (!passt(partie.feld, gezogen.zellen, zeile, spalte)) return null;
    return { zeile, spalte };
  }, [gezogen, partie, schwebt]);

  const vorschau = useMemo(() => {
    const felder = new Set<number>();
    if (!ziel || !gezogen) return { felder, weg: felder };
    for (const [dr, dc] of gezogen.zellen)
      felder.add((ziel.zeile + dr) * GROESSE + ziel.spalte + dc);
    return { felder, weg: wuerdeRaeumen(partie!.feld, gezogen.zellen, ziel.zeile, ziel.spalte) };
  }, [gezogen, partie, ziel]);

  const passtNoch = useMemo(
    () => partie?.hand.map((s) => (s ? irgendwoPlatz(partie.feld, s.zellen) : false)) ?? [],
    [partie],
  );

  const starten = useCallback(() => {
    // Gewürfelt wird hier und nicht im Updater: React ruft den im Strict Mode
    // doppelt auf, und zweimal ziehen hieße, eine Hand still zu verwerfen.
    const neu = neuePartie();
    setZeigeErgebnis(true);
    setZeigeStats(false);
    persist((v) => {
      // Eine abgebrochene Partie zählt mit – Punkte gehen ja nie verloren.
      const alt = gueltig(v.partie) && !v.partie.vorbei && v.partie.zuege > 0 ? v.partie : null;
      return {
        ...v,
        version: 1,
        partie: neu,
        rekord: false,
        beste: Math.max(v.beste ?? 0, alt?.punkte ?? 0),
        partien: (v.partien ?? 0) + (alt ? 1 : 0),
      };
    });
  }, [persist]);

  const ablegen = useCallback(
    (index: number) => {
      if (!partie || !ziel) return;
      const zug = legen(partie, index, ziel.zeile, ziel.spalte);
      if (!zug) return;

      if (zug.geraeumt.length > 0)
        setBlitz({ felder: new Map(zug.geraeumt.map((g) => [g.feld, g.farbe])), nr: Date.now() });
      if (zug.linien > 0) {
        const kombo = zug.partie.kombo > 1 ? ` · Kombo ×${zug.partie.kombo}` : '';
        setMeldung({ text: `+${zug.gewinn}${kombo}`, nr: Date.now() });
      }

      const fertig = zug.partie.vorbei;
      if (fertig) setZeigeErgebnis(true);
      persist((v) => ({
        ...v,
        partie: zug.partie,
        rekord: fertig && zug.partie.punkte > (v.beste ?? 0),
        beste: fertig ? Math.max(v.beste ?? 0, zug.partie.punkte) : (v.beste ?? 0),
        partien: (v.partien ?? 0) + (fertig ? 1 : 0),
      }));
    },
    [partie, persist, ziel],
  );

  const greifen = (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (!partie || partie.vorbei || !partie.hand[index]) return;
    raster.current = vermessen();
    if (!raster.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setZiehen({ index, x: event.clientX, y: event.clientY });
  };

  const bewegen = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ziehen) return;
    setZiehen({ ...ziehen, x: event.clientX, y: event.clientY });
  };

  const loslassen = () => {
    if (!ziehen) return;
    ablegen(ziehen.index);
    setZiehen(null);
  };

  const neuerRekord = partie?.vorbei && save.rekord;

  return (
    <div className="game klotz-spiel">
      <header className="game-bar game-bar-raster">
        <button className="icon-button" onClick={onExit} aria-label="Zurück zum Launchpad">
          ←
        </button>
        <div className="game-bar-title">
          <strong>Klötzchen</strong>
          <span>{partie ? `${partie.zuege} gelegt` : 'Formen legen, Reihen räumen'}</span>
        </div>
        <div className="kopf-knoepfe">
          <RegelnKnopf onClick={() => setZeigeHilfe(true)} />
          <button className="icon-button" onClick={() => setZeigeStats(true)} aria-label="Statistik">
            📊
          </button>
        </div>
      </header>

      <div className="klotz-stand">
        <span className="klotz-beste">👑 {Math.max(beste, partie?.punkte ?? 0)}</span>
        <strong className="klotz-punkte">{partie?.punkte ?? 0}</strong>
        {meldung && (
          <span key={meldung.nr} className="klotz-meldung">
            {meldung.text}
          </span>
        )}
      </div>

      <div className="klotz-buehne">
        <div className="klotz-brett" ref={brett}>
          {Array.from({ length: GROESSE * GROESSE }, (_, i) => {
            const farbe = partie?.feld[i] ?? 0;
            const klassen = ['klotz-feld'];
            let zeige = farbe;
            if (vorschau.felder.has(i)) {
              klassen.push('klotz-vorschau');
              zeige = gezogen!.farbe;
            } else if (blitz?.felder.has(i) && farbe === 0) {
              klassen.push('klotz-weg');
              zeige = blitz.felder.get(i)!;
            }
            // Was gleich verschwindet, nimmt schon die Farbe der neuen Form an.
            if (farbe > 0 && vorschau.weg.has(i)) {
              klassen.push('klotz-wird-weg');
              zeige = gezogen!.farbe;
            }
            if (zeige > 0) klassen.push(`klotz-farbe-${zeige}`);
            return <div key={blitz?.felder.has(i) ? `${i}-${blitz.nr}` : i} className={klassen.join(' ')} />;
          })}
        </div>
      </div>

      <div className="klotz-schale">
        {(partie?.hand ?? [null, null, null]).map((stueck, index) => (
          <div
            key={index}
            className="klotz-platz"
            onPointerDown={greifen(index)}
            onPointerMove={bewegen}
            onPointerUp={loslassen}
            onPointerCancel={() => setZiehen(null)}
          >
            {stueck && ziehen?.index !== index && (
              <Form stueck={stueck} klein matt={!passtNoch[index]} />
            )}
          </div>
        ))}
      </div>

      {gezogen && schwebt && raster.current && (
        <div
          className="klotz-schwebend"
          style={
            {
              left: schwebt.x,
              top: schwebt.y,
              '--zelle': `${raster.current.zelle}px`,
              '--fuge': `${raster.current.schritt - raster.current.zelle}px`,
            } as CSSProperties
          }
        >
          <Form stueck={gezogen} />
        </div>
      )}

      {status === 'fehler' && (
        <div className="save-warning">Spielstand konnte nicht gespeichert werden.</div>
      )}

      {status !== 'laden' && !partie && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <h2>Klötzchen</h2>
            <p className="muted">
              Drei Formen, ein Brett mit 8×8 Feldern. Volle Reihen und Spalten verschwinden.
            </p>
            <div className="sheet-actions">
              <button className="button" onClick={starten}>
                Losspielen
              </button>
              <button className="button button-ghost" onClick={() => setZeigeHilfe(true)}>
                Wie geht das?
              </button>
            </div>
          </div>
        </div>
      )}

      {partie?.vorbei && zeigeErgebnis && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <h2>{neuerRekord ? 'Neuer Rekord!' : 'Kein Platz mehr.'}</h2>
            <p className="muted">
              {partie.punkte} Punkte mit {partie.zuege} gelegten Formen.
              {!neuerRekord && ` Bestwert: ${beste}.`}
            </p>
            <div className="sheet-actions">
              <button className="button" onClick={starten}>
                Neue Partie
              </button>
              <button className="button button-ghost" onClick={() => setZeigeErgebnis(false)}>
                Brett ansehen
              </button>
              <button className="button button-ghost" onClick={onExit}>
                Zurück zum Launchpad
              </button>
            </div>
          </div>
        </div>
      )}

      {zeigeHilfe && (
        <Spielregeln titel="Klötzchen" onClose={() => setZeigeHilfe(false)}>
          <Regeln />
        </Spielregeln>
      )}

      {zeigeStats && (
        <StatsSheet
          save={save}
          laeuft={!!partie && !partie.vorbei && partie.zuege > 0}
          onNeu={starten}
          onClose={() => setZeigeStats(false)}
        />
      )}
    </div>
  );
}

function Form({ stueck, klein, matt }: { stueck: Stueck; klein?: boolean; matt?: boolean }) {
  const { hoehe, breite } = masse(stueck.zellen);
  const klassen = ['klotz-form'];
  if (klein) klassen.push('klotz-form-klein');
  if (matt) klassen.push('klotz-form-matt');
  return (
    <div
      className={klassen.join(' ')}
      style={{
        gridTemplateColumns: `repeat(${breite}, var(--zelle))`,
        gridTemplateRows: `repeat(${hoehe}, var(--zelle))`,
      }}
    >
      {stueck.zellen.map(([r, c]) => (
        <div
          key={`${r},${c}`}
          className={`klotz-feld klotz-farbe-${stueck.farbe}`}
          style={{ gridRow: r + 1, gridColumn: c + 1 }}
        />
      ))}
    </div>
  );
}

function StatsSheet({
  save,
  laeuft,
  onNeu,
  onClose,
}: {
  save: BlocksSave;
  laeuft: boolean;
  onNeu: () => void;
  onClose: () => void;
}) {
  const [sicher, setSicher] = useState(false);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>Statistik</h2>

        <div className="stat-row klotz-stat-row">
          <div className="stat">
            <strong>{save.partien ?? 0}</strong>
            <span>Partien</span>
          </div>
          <div className="stat">
            <strong>{save.beste ?? 0}</strong>
            <span>Bestwert</span>
          </div>
          <div className="stat">
            <strong>{FORMEN.length}</strong>
            <span>Formen im Topf</span>
          </div>
        </div>

        <div className="sheet-actions">
          {laeuft &&
            (sicher ? (
              <button className="button button-warnung" onClick={onNeu}>
                Wirklich neu anfangen
              </button>
            ) : (
              <button className="button button-ghost" onClick={() => setSicher(true)}>
                Neu anfangen
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

function Regeln() {
  return (
    <>
      <p>Lege Formen auf das Brett und halte es so lange wie möglich frei.</p>
      <ul>
        <li>Unten liegen immer drei Formen. Erst wenn alle drei liegen, kommen neue.</li>
        <li>Formen lassen sich nicht drehen – sie liegen so, wie sie kommen.</li>
        <li>Eine volle Reihe oder Spalte verschwindet.</li>
        <li>Passt keine der übrigen Formen mehr irgendwo hin, ist die Partie vorbei.</li>
      </ul>

      <h3>Punkte</h3>
      <ul>
        <li>Jedes gelegte Feld bringt einen Punkt.</li>
        <li>Eine Linie räumen: 10. Zwei auf einmal: 30, drei: 60, vier: 100 und so weiter.</li>
        <li>
          Kombo: Räumst du wieder, bevor {KOMBO_LUFT} Formen ohne Räumen liegen, steigt der Faktor
          auf ×2, ×3, …
        </li>
        <li>Ist das Brett danach ganz leer, gibt es {LEER_BONUS} obendrauf.</li>
      </ul>

      <h3>Bedienung</h3>
      <ul>
        <li>Eine Form aus der Schale aufs Brett ziehen. Sie schwebt etwas über dem Finger.</li>
        <li>Wo sie passt, zeigt das Brett sie schon an – und färbt, was dabei verschwindet.</li>
        <li>Blasse Formen passen gerade nirgends hin.</li>
      </ul>

      <h3>Ehrlicher Zufall</h3>
      <p>
        Jede der {FORMEN.length} Formen kommt gleich oft, egal wie das Brett aussieht. Das Spiel hilft
        nicht, wenn es eng wird, und legt dir auch keine Steine in den Weg.
      </p>
    </>
  );
}
