/**
 * Prüft den Regelkern von Clever 4Ever gegen die Beispiele aus der Anleitung.
 *
 *   node scripts/check-clever.ts
 *
 * Bewusst ohne Testframework – Node führt TypeScript direkt aus, und die
 * Anleitung nennt für jeden Bereich eine konkrete Punktzahl, an der sich die
 * Wertung festnageln lässt.
 */
import {
  GRAU_GRUPPEN,
  eintragen,
  gelbErlaubt,
  grauVerfuegbar,
  leeresBlatt,
  punkteBlau,
  punkteGelb,
  punkteGrau,
  punkteGruen,
  punktePink,
  werten,
  type Blatt,
} from '../src/games/clever/logic.ts';
import { GRAU_RASTER } from '../src/games/clever/sheet.ts';

let fehler = 0;

function pruefe(name: string, ist: unknown, soll: unknown) {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  if (!gleich) fehler++;
  console.log(`${gleich ? '  ok  ' : 'FEHLER'}  ${name}${gleich ? '' : `  ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`}`);
}

// ---------------------------------------------------------------- Wertung

{
  // Anleitung Gelb: 7 Minuspunkte in der mittleren Reihe, 21 Pluspunkte in der
  // unteren, dazu die ersten drei Spalten vollständig (10+10+15) = 49.
  const b = leeresBlatt();
  b.gelb[0] = [1, 2, 3, null, null];
  b.gelb[1] = [3, 2, 2, null, null];
  b.gelb[2] = [6, 6, 5, 4, null];
  pruefe('Gelb: Beispiel aus der Anleitung', punkteGelb(b), 49);
}

{
  // Anleitung Blau: Spalten 2 und 5 mit je 2 Kreuzen (8+11), dazu 2 Kreuze auf
  // der Nebendiagonale (6) = 25.
  const b = leeresBlatt();
  for (const [r, c] of [
    [0, 1],
    [1, 1],
    [2, 4],
    [3, 4],
    [0, 5],
    [5, 0],
  ]) {
    b.blau[r][c] = true;
  }
  pruefe('Blau: Beispiel aus der Anleitung', punkteBlau(b), 25);
}

{
  // Anleitung Grau: 1+6+8+9+10+10+11 = 55 für vollständige Spalten.
  const b = leeresBlatt();
  for (const spalte of [0, 5, 9, 11, 13, 14, 15]) {
    for (let r = 0; r < 4; r++) b.grau[r][spalte] = true;
  }
  pruefe('Grau: Beispiel aus der Anleitung', punkteGrau(b), 55);
}

{
  // Anleitung Grün: 10+8+10+14 = 42. Ab Feld 4 (Index 3) zählt doppelt.
  const b = leeresBlatt();
  b.gruenOben[0] = 4;
  b.gruenUnten[0] = 6;
  b.gruenOben[1] = 3;
  b.gruenUnten[1] = 5;
  b.gruenOben[2] = 5;
  b.gruenUnten[2] = 5;
  b.gruenOben[3] = 3;
  b.gruenUnten[3] = 4;
  pruefe('Grün: Beispiel aus der Anleitung', punkteGruen(b), 42);
  // Halb gefüllte Felder geben nichts.
  const c = leeresBlatt();
  c.gruenOben[0] = 6;
  pruefe('Grün: halbes Feld gibt keine Punkte', punkteGruen(c), 0);
}

{
  // Anleitung Pink: 23 Punkte für die Leiste, dazu 2+4+3 = 9 für Eingekreiste.
  const b = leeresBlatt();
  b.pink = [2, 4, 6, 1, 1, 1, 1, 1, null, null, null, null];
  pruefe('Pink: Beispiel aus der Anleitung', punktePink(b), 32);
}

// ------------------------------------------------------------ Zugregeln

{
  const b = leeresBlatt();
  pruefe('Gelb: obere Reihe nimmt zuerst jeden Wert', gelbErlaubt(b, 0, 4), true);
  b.gelb[0][0] = 4;
  pruefe('Gelb: obere Reihe muss aufsteigen', gelbErlaubt(b, 0, 3), false);
  pruefe('Gelb: höherer Wert erlaubt', gelbErlaubt(b, 0, 5), true);
  b.gelb[0][1] = 6;
  pruefe('Gelb: nach einer 6 ist die Reihe zu', gelbErlaubt(b, 0, 6), false);
  pruefe('Gelb: untere Reihen nehmen alles', gelbErlaubt(b, 2, 1), true);
}

{
  // Eine 3 in Pink trägt sich sofort noch einmal ein.
  const { blatt } = eintragen(leeresBlatt(), { bereich: 'pink', wert: 3 });
  pruefe('Pink: die 3 füllt das nächste Feld mit', blatt.pink.slice(0, 3), [3, 3, null]);
}

{
  // Eine 6 in Pink löst den Bonus unter dem Feld aus, eine 4 nicht.
  const sechs = eintragen(leeresBlatt(), { bereich: 'pink', wert: 6 });
  pruefe('Pink: 6 löst den Feldbonus aus', sechs.boni.length > 0, true);
  const vier = eintragen(leeresBlatt(), { bereich: 'pink', wert: 4 });
  pruefe('Pink: 4 löst keinen Feldbonus aus', vier.boni.length, 0);
}

// --------------------------------------------------------- Grauer Bereich

{
  const felderGesamt = GRAU_GRUPPEN.reduce((s, g) => s + g.felder.length, 0);
  pruefe('Grau: alle 64 Felder in Teilflächen', felderGesamt, 4 * 16);

  const groessen = GRAU_GRUPPEN.map((g) => g.felder.length).sort((a, b) => a - b);
  console.log(`         Teilflächen: ${GRAU_GRUPPEN.length}, Größen ${groessen.join(',')}`);

  // Vor dem ersten Zug sind nur die beiden Startflächen wählbar.
  const leer = leeresBlatt();
  const mitSechs = grauVerfuegbar(leer, 6);
  const startFarben = mitSechs.map((i) => GRAU_GRUPPEN[i].farbe);
  pruefe('Grau: erster Zug nur in Startflächen', mitSechs.length <= 2, true);
  console.log(`         erster Zug mit 6: ${mitSechs.length} Fläche(n), Farben ${startFarben.join(',')}`);

  // Zu kleiner Würfel schließt zu große Flächen aus.
  pruefe('Grau: 1 reicht für keine Startfläche', grauVerfuegbar(leer, 1).length, 0);
}

{
  // Nach dem ersten Zug muss angrenzend weitergemacht werden.
  const leer = leeresBlatt();
  const erste = grauVerfuegbar(leer, 6)[0];
  const { blatt } = eintragen(leer, { bereich: 'grau', wert: 6, ziel: erste });
  const gekreuzt = blatt.grau.flat().filter(Boolean).length;
  pruefe('Grau: Teilfläche wird komplett abgekreuzt', gekreuzt, GRAU_GRUPPEN[erste].felder.length);

  const weiter = grauVerfuegbar(blatt, 6);
  pruefe('Grau: es geht angrenzend weiter', weiter.length > 0, true);
  pruefe('Grau: abgekreuzte Fläche nicht erneut wählbar', weiter.includes(erste), false);
}

{
  // Alle Felder einer Färbung abgekreuzt gibt einen Fuchs. Dafür alles außer
  // einer weißen Teilfläche abkreuzen – dann grenzt sie garantiert an und ist
  // der letzte fehlende Baustein dieser Färbung.
  const b = leeresBlatt();
  const offen = GRAU_GRUPPEN.find((g) => g.farbe === 'W')!;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 16; c++) b.grau[r][c] = true;
  for (const [r, c] of offen.felder) b.grau[r][c] = false;
  const index = GRAU_GRUPPEN.indexOf(offen);
  const { boni } = eintragen(b, { bereich: 'grau', wert: offen.felder.length, ziel: index });
  pruefe('Grau: vollständige Färbung gibt einen Fuchs', boni.some((x) => x.art === 'fuchs'), true);
}

// ------------------------------------------------------------- Endwertung

{
  const b: Blatt = leeresBlatt();
  b.gelb[2] = [6, 6, 6, 6, 6];
  b.fuechse = 2;
  const w = werten(b);
  // Schwächster Bereich ist 0, also bringen Füchse hier nichts.
  pruefe('Füchse zählen wie der schwächste Bereich', w.fuechse, 0);
  pruefe('Gesamtpunkte', w.gesamt, 30);
  pruefe('Titel bei wenig Punkten', w.titel, 'Reden wir über etwas anderes…');
}

console.log(fehler === 0 ? '\nAlle Prüfungen bestanden.' : `\n${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
