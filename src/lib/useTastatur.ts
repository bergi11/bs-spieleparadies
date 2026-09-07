import { useEffect } from 'react';

/**
 * Meldet dem Stylesheet in `--tastatur`, wie viel Höhe die Bildschirmtastatur
 * gerade verdeckt.
 *
 * Android verkleinert beim Aufklappen die Seite – dort bleibt der Wert 0, und
 * ein unten angeheftetes Blatt rutscht von selbst mit hoch. iOS lässt die Seite
 * dagegen, wie sie ist, und legt die Tastatur darüber: ohne diesen Abstand läge
 * das Eingabefeld darunter und man tippt blind.
 */
export function useTastatur() {
  useEffect(() => {
    const sicht = window.visualViewport;
    if (!sicht) return;

    const messen = () => {
      const verdeckt = window.innerHeight - sicht.height - sicht.offsetTop;
      document.documentElement.style.setProperty(
        '--tastatur',
        `${Math.max(0, Math.round(verdeckt))}px`,
      );
    };

    messen();
    sicht.addEventListener('resize', messen);
    // Beim Scrollen verschiebt iOS den sichtbaren Ausschnitt, ohne die Höhe zu
    // ändern – der verdeckte Rand ändert sich trotzdem.
    sicht.addEventListener('scroll', messen);

    return () => {
      sicht.removeEventListener('resize', messen);
      sicht.removeEventListener('scroll', messen);
      document.documentElement.style.removeProperty('--tastatur');
    };
  }, []);
}
