import { GRAU_GRUPPEN, type Blatt } from './logic';
import {
  BLAU_BONI,
  BLAU_SPALTENWERTE,
  GELB_BONI,
  GELB_SPALTENWERTE,
  GRAU_BONI,
  GRAU_RASTER,
  GRAU_SPALTENWERTE,
  GRUEN_BONI,
  GRUEN_FELDER,
  GRUEN_VERDOPPELT_AB,
  PINK_BONI,
  PINK_WERTE,
  type Bereich,
  type Bonus,
} from './sheet';
import type { Ziel } from './wuerfel';

/**
 * Die fünf Bereiche des Spielblatts.
 *
 * Alles als SVG mit fester viewBox: so wachsen Felder und Beschriftung
 * zusammen mit der Displaybreite, ohne dass irgendwo Schriftgrößen geraten
 * werden müssen. Gezeichnet wird in unserem Stil, nicht als Abbild des Papiers
 * – die Zahlen und Formen stimmen aber mit dem Original überein.
 */

interface Props {
  blatt: Blatt;
  /** Aktuell erlaubte Ziele; nur diese sind anklickbar und hervorgehoben. */
  ziele: Ziel[];
  onZiel: (ziel: Ziel) => void;
}

/** Kurzzeichen für ein Bonusfeld. */
function bonusZeichen(bonus: Bonus): { text: string; klasse: string } {
  switch (bonus.art) {
    case 'plus1':
      return { text: '+1', klasse: 'bonus-neutral' };
    case 'frage':
      return { text: '?', klasse: `bonus-${bonus.farbe}` };
    case 'weiss':
      return { text: '◯', klasse: 'bonus-neutral' };
    case 'neuwurf':
      return { text: '↻', klasse: 'bonus-neutral' };
    case 'extra':
      return { text: '+W', klasse: 'bonus-neutral' };
    case 'polieren':
      return { text: '±1', klasse: 'bonus-neutral' };
    case 'fuchs':
      return { text: '🦊', klasse: 'bonus-fuchs' };
  }
}

function BonusZeichen({ bonus, x, y }: { bonus: Bonus; x: number; y: number }) {
  const { text, klasse } = bonusZeichen(bonus);
  return (
    <text x={x} y={y} className={`feld-bonus ${klasse}`} textAnchor="middle" dominantBaseline="central">
      {text}
    </text>
  );
}

// ------------------------------------------------------------------- Gelb

export function GelbAnsicht({ blatt, ziele, onZiel }: Props) {
  const Z = 22; // Kantenlänge einer Zelle
  const links = 18;
  const breite = links + 5 * Z;
  const hoehe = 3 * Z + 16;

  // Je Reihe das nächste freie Feld – dort landet der Würfel.
  const naechstes = blatt.gelb.map((reihe) => reihe.findIndex((w) => w === null));
  const zielFuer = (reihe: number) => ziele.find((z) => z.bereich === 'gelb' && z.ziel === reihe);

  return (
    <svg className="bereich bereich-gelb" viewBox={`0 0 ${breite} ${hoehe}`}>
      {['↗', '−', '+'].map((zeichen, reihe) => (
        <text
          key={reihe}
          x={links / 2}
          y={reihe * Z + Z / 2}
          className="reihen-marke"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {zeichen}
        </text>
      ))}

      {blatt.gelb.map((reihe, r) =>
        reihe.map((wert, c) => {
          const ziel = zielFuer(r);
          const offen = ziel !== undefined && naechstes[r] === c;
          return (
            <g
              key={`${r},${c}`}
              onClick={offen ? () => onZiel(ziel) : undefined}
              className={offen ? 'feld-klickbar' : undefined}
            >
              <rect
                x={links + c * Z + 1}
                y={r * Z + 1}
                width={Z - 2}
                height={Z - 2}
                rx={3}
                className={`feld${wert !== null ? ' feld-belegt' : ''}${offen ? ' feld-offen' : ''}`}
              />
              {wert !== null && (
                <text
                  x={links + c * Z + Z / 2}
                  y={r * Z + Z / 2}
                  className="feld-wert"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {wert}
                </text>
              )}
              {wert === null && GELB_BONI[r][c] && (
                <BonusZeichen bonus={GELB_BONI[r][c]!} x={links + c * Z + Z - 5} y={r * Z + Z - 5} />
              )}
            </g>
          );
        }),
      )}

      {GELB_SPALTENWERTE.map((wert, c) => (
        <text
          key={c}
          x={links + c * Z + Z / 2}
          y={3 * Z + 8}
          className={`spaltenwert${blatt.gelb.every((reihe) => reihe[c] !== null) ? ' spaltenwert-voll' : ''}`}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {wert}
        </text>
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------- Blau

export function BlauAnsicht({ blatt, ziele, onZiel }: Props) {
  const Z = 18;
  const links = 14;
  const oben = 14;
  const rechts = 16;
  const breite = links + 6 * Z + rechts;
  const hoehe = oben + 6 * Z + 26;

  // Zwei Kreuze auf einer Diagonale bringen etwas: oben links → unten rechts
  // einen Neuwurf, oben rechts → unten links am Ende 6 Punkte.
  const haupt = blatt.blau.filter((zeile, r) => zeile[r]).length;
  const neben = blatt.blau.filter((zeile, r) => zeile[5 - r]).length;

  const zielFuer = (r: number, c: number) =>
    ziele.find(
      (z) => z.bereich === 'blau' && Array.isArray(z.ziel) && z.ziel[0] === r && z.ziel[1] === c,
    );

  return (
    <svg className="bereich bereich-blau" viewBox={`0 0 ${breite} ${hoehe}`}>
      {/* Der blaue Würfel gibt die Zeile vor, der weiße die Spalte. Ohne die
          Beschriftung sieht man nicht, wo ein Wurf landen wird. */}
      {[1, 2, 3, 4, 5, 6].map((n, r) => (
        <text
          key={`zeile-${n}`}
          x={links / 2}
          y={oben + r * Z + Z / 2}
          className="achse achse-blau"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {n}
        </text>
      ))}
      {[1, 2, 3, 4, 5, 6].map((n, c) => (
        <text
          key={`spalte-${n}`}
          x={links + c * Z + Z / 2}
          y={oben / 2}
          className="achse achse-weiss"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {n}
        </text>
      ))}

      {/* Die beiden Diagonalen als dünne Linien, damit man sieht, welche
          Felder überhaupt dazuzählen. */}
      <line
        x1={links + 1}
        y1={oben + 1}
        x2={links + 6 * Z - 1}
        y2={oben + 6 * Z - 1}
        className={`diagonale${haupt >= 2 ? ' diagonale-voll' : ''}`}
      />
      <line
        x1={links + 6 * Z - 1}
        y1={oben + 1}
        x2={links + 1}
        y2={oben + 6 * Z - 1}
        className={`diagonale${neben >= 2 ? ' diagonale-voll' : ''}`}
      />

      {blatt.blau.map((reihe, r) =>
        reihe.map((gekreuzt, c) => {
          const ziel = zielFuer(r, c);
          return (
            <g
              key={`${r},${c}`}
              onClick={ziel ? () => onZiel(ziel) : undefined}
              className={ziel ? 'feld-klickbar' : undefined}
            >
              <rect
                x={links + c * Z + 1}
                y={oben + r * Z + 1}
                width={Z - 2}
                height={Z - 2}
                rx={3}
                className={`feld${gekreuzt ? ' feld-belegt' : ''}${ziel ? ' feld-offen' : ''}`}
              />
              {gekreuzt && (
                <text
                  x={links + c * Z + Z / 2}
                  y={oben + r * Z + Z / 2}
                  className="feld-wert"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  ×
                </text>
              )}
            </g>
          );
        }),
      )}

      {BLAU_BONI.map((bonus, r) =>
        bonus ? (
          <BonusZeichen key={r} bonus={bonus} x={links + 6 * Z + rechts / 2} y={oben + r * Z + Z / 2} />
        ) : null,
      )}

      {BLAU_SPALTENWERTE.map((wert, c) => (
        <text
          key={c}
          x={links + c * Z + Z / 2}
          y={oben + 6 * Z + 7}
          className={`spaltenwert${blatt.blau.filter((z) => z[c]).length >= 2 ? ' spaltenwert-voll' : ''}`}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {wert}
        </text>
      ))}

      {/* Was die Diagonalen bringen – ab zwei Kreuzen. */}
      <text
        x={links + 1.5 * Z}
        y={oben + 6 * Z + 19}
        className={`diagonal-hinweis${haupt >= 2 ? ' spaltenwert-voll' : ''}`}
        textAnchor="middle"
        dominantBaseline="central"
      >
        ↘ ↻ {haupt}/2
      </text>
      <text
        x={links + 4.5 * Z}
        y={oben + 6 * Z + 19}
        className={`diagonal-hinweis${neben >= 2 ? ' spaltenwert-voll' : ''}`}
        textAnchor="middle"
        dominantBaseline="central"
      >
        ↙ 6 P. {neben}/2
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------- Grau

const GRAU_FUELLUNG: Record<string, string> = { W: 'grau-w', H: 'grau-h', D: 'grau-d' };

export function GrauAnsicht({ blatt, ziele, onZiel }: Props) {
  const Z = 13;
  const breite = 16 * Z;
  const hoehe = 4 * Z + 12;

  // Zu jeder wählbaren Teilfläche das passende Ziel.
  const zielFuerGruppe = new Map<number, Ziel>();
  for (const z of ziele) {
    if (z.bereich === 'grau' && typeof z.ziel === 'number') zielFuerGruppe.set(z.ziel, z);
  }

  return (
    <svg className="bereich bereich-grau" viewBox={`0 0 ${breite} ${hoehe}`}>
      {GRAU_GRUPPEN.map((gruppe, index) => {
        const ziel = zielFuerGruppe.get(index);
        return (
          <g
            key={index}
            onClick={ziel ? () => onZiel(ziel) : undefined}
            className={ziel ? 'feld-klickbar' : undefined}
          >
            {gruppe.felder.map(([r, c]) => (
              <g key={`${r},${c}`}>
                <rect
                  x={c * Z + 0.5}
                  y={r * Z + 0.5}
                  width={Z - 1}
                  height={Z - 1}
                  rx={2}
                  className={`feld ${GRAU_FUELLUNG[GRAU_RASTER[r][c]]}${blatt.grau[r][c] ? ' feld-belegt' : ''}${ziel ? ' feld-offen' : ''}`}
                />
                {blatt.grau[r][c] && (
                  <text
                    x={c * Z + Z / 2}
                    y={r * Z + Z / 2}
                    className="feld-wert klein"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    ×
                  </text>
                )}
                {!blatt.grau[r][c] && GRAU_BONI[`${r},${c}`] && (
                  <BonusZeichen bonus={GRAU_BONI[`${r},${c}`]} x={c * Z + Z / 2} y={r * Z + Z / 2} />
                )}
              </g>
            ))}
          </g>
        );
      })}

      {/* Umrisse: nur die Kanten zeichnen, an denen eine andere Teilfläche
          beginnt. Ohne sie verschwimmt das Raster zu einer Fläche und man
          sieht nicht mehr, was zusammengehört – und genau darum geht es hier. */}
      {GRAU_GRUPPEN.map((gruppe, index) => {
        const drin = new Set(gruppe.felder.map(([r, c]) => `${r},${c}`));
        const kanten: string[] = [];
        for (const [r, c] of gruppe.felder) {
          const x = c * Z;
          const y = r * Z;
          if (!drin.has(`${r - 1},${c}`)) kanten.push(`M${x} ${y}h${Z}`);
          if (!drin.has(`${r + 1},${c}`)) kanten.push(`M${x} ${y + Z}h${Z}`);
          if (!drin.has(`${r},${c - 1}`)) kanten.push(`M${x} ${y}v${Z}`);
          if (!drin.has(`${r},${c + 1}`)) kanten.push(`M${x + Z} ${y}v${Z}`);
        }
        return <path key={`umriss-${index}`} d={kanten.join('')} className="grau-umriss" />;
      })}

      {GRAU_SPALTENWERTE.map((wert, c) => (
        <text
          key={c}
          x={c * Z + Z / 2}
          y={4 * Z + 6}
          className={`spaltenwert klein${blatt.grau.every((z) => z[c]) ? ' spaltenwert-voll' : ''}`}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {wert}
        </text>
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------- Grün

export function GruenAnsicht({ blatt, ziele, onZiel }: Props) {
  const Z = 20;
  const breite = GRUEN_FELDER * Z;
  const hoehe = Z + 26;

  const zielOben = ziele.find((z) => z.bereich === 'gruen' && z.ziel === 'oben');
  const zielUnten = ziele.find((z) => z.bereich === 'gruen' && z.ziel === 'unten');
  const naechstesOben = blatt.gruenOben.findIndex((w) => w === null);
  const naechstesUnten = blatt.gruenUnten.findIndex((w) => w === null);

  return (
    <svg className="bereich bereich-gruen" viewBox={`0 0 ${breite} ${hoehe}`}>
      {Array.from({ length: GRUEN_FELDER }, (_, i) => {
        const oben = blatt.gruenOben[i];
        const unten = blatt.gruenUnten[i];
        const x = i * Z;
        const y = 10;
        const offenOben = zielOben && naechstesOben === i;
        const offenUnten = zielUnten && naechstesUnten === i;

        return (
          <g key={i}>
            {/* Punktfeld: erst gefüllt, wenn beide Dreiecke stehen. */}
            <text x={x + Z / 2} y={5} className="spaltenwert" textAnchor="middle" dominantBaseline="central">
              {oben !== null && unten !== null ? (oben + unten) * (i >= GRUEN_VERDOPPELT_AB ? 2 : 1) : ''}
            </text>

            <polygon
              points={`${x + 1},${y + 1} ${x + Z - 1},${y + 1} ${x + 1},${y + Z - 1}`}
              className={`feld${oben !== null ? ' feld-belegt' : ''}${offenOben ? ' feld-offen feld-klickbar' : ''}`}
              onClick={offenOben ? () => onZiel(zielOben!) : undefined}
            />
            <polygon
              points={`${x + Z - 1},${y + 1} ${x + Z - 1},${y + Z - 1} ${x + 1},${y + Z - 1}`}
              className={`feld${unten !== null ? ' feld-belegt' : ''}${offenUnten ? ' feld-offen feld-klickbar' : ''}`}
              onClick={offenUnten ? () => onZiel(zielUnten!) : undefined}
            />

            {oben !== null && (
              <text x={x + Z * 0.34} y={y + Z * 0.32} className="feld-wert klein" textAnchor="middle" dominantBaseline="central">
                {oben}
              </text>
            )}
            {unten !== null && (
              <text x={x + Z * 0.68} y={y + Z * 0.7} className="feld-wert klein" textAnchor="middle" dominantBaseline="central">
                {unten}
              </text>
            )}

            {i >= GRUEN_VERDOPPELT_AB && (
              <text x={x + Z - 3} y={y + 3} className="verdoppelt" textAnchor="end" dominantBaseline="central">
                ×2
              </text>
            )}
            {unten === null && GRUEN_BONI[i] && (
              <BonusZeichen bonus={GRUEN_BONI[i]!} x={x + Z / 2} y={y + Z + 5} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------- Pink

export function PinkAnsicht({ blatt, ziele, onZiel }: Props) {
  const Z = 19;
  const breite = PINK_WERTE.length * Z;
  const hoehe = Z + 24;

  const ziel = ziele.find((z) => z.bereich === 'pink');
  const naechstes = blatt.pink.findIndex((w) => w === null);

  return (
    <svg className="bereich bereich-pink" viewBox={`0 0 ${breite} ${hoehe}`}>
      {PINK_WERTE.map((punkte, i) => {
        const wert = blatt.pink[i];
        const x = i * Z;
        const offen = ziel !== undefined && naechstes === i;
        // Die 2, 4 und 6 werden eingekreist und geben am Ende Zusatzpunkte.
        const eingekreist = wert === 2 || wert === 4 || wert === 6;

        return (
          <g
            key={i}
            onClick={offen ? () => onZiel(ziel) : undefined}
            className={offen ? 'feld-klickbar' : undefined}
          >
            <text x={x + Z / 2} y={5} className="spaltenwert" textAnchor="middle" dominantBaseline="central">
              {punkte}
            </text>
            <rect
              x={x + 1}
              y={10}
              width={Z - 2}
              height={Z - 2}
              rx={3}
              className={`feld${wert !== null ? ' feld-belegt' : ''}${offen ? ' feld-offen' : ''}`}
            />
            {wert !== null && (
              <>
                {eingekreist && (
                  <circle cx={x + Z / 2} cy={10 + (Z - 2) / 2} r={Z * 0.36} className="pink-kreis" />
                )}
                <text
                  x={x + Z / 2}
                  y={10 + (Z - 2) / 2}
                  className="feld-wert klein"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {wert}
                </text>
              </>
            )}
            {wert === null && PINK_BONI[i] && <BonusZeichen bonus={PINK_BONI[i]!} x={x + Z / 2} y={10 + Z + 4} />}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- Auswahl

export const ANSICHTEN: Record<Bereich, (props: Props) => JSX.Element> = {
  gelb: GelbAnsicht,
  blau: BlauAnsicht,
  grau: GrauAnsicht,
  gruen: GruenAnsicht,
  pink: PinkAnsicht,
};
