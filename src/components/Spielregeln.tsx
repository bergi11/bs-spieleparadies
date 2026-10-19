import type { ReactNode } from 'react';

/**
 * Blatt mit den Regeln eines Spiels. Der Inhalt kommt vom Spiel selbst; hier
 * steht nur der Rahmen, damit alle Regelblätter gleich aussehen.
 *
 * Den Offen-Zustand hält das Spiel, nicht dieses Blatt: Spiele mit eigener
 * Tastaturbedienung müssen wissen, dass gerade ein Blatt davorliegt, sonst
 * landet ein Tastendruck im Gitter dahinter.
 */
export function Spielregeln({
  titel,
  onClose,
  children,
}: {
  titel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet regeln"
        role="dialog"
        aria-label={`So geht ${titel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>So geht {titel}</h2>
        {children}
        <div className="sheet-actions">
          <button className="button" onClick={onClose}>
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}

/** Der Knopf in der Kopfzeile. */
export function RegelnKnopf({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-button" onClick={onClick} aria-label="Spielregeln">
      ?
    </button>
  );
}
