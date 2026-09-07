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
import { GRAU_RASTER, RUNDEN } from '../src/games/clever/sheet.ts';
import {
  WUERFEL_FARBEN,
  moeglicheZiele,
  nachWahl,
  naechsteRunde,
  neueRunde,
  passivWaehlbar,
  startePassiv,
  verzichten,
  weisserWert,
  type Rng,
} from '../src/games/clever/wuerfel.ts';

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

  // Die mittlere gelbe Reihe zählt negativ – ein Zwischenstand unter null darf
  // die Wertung nicht zum Absturz bringen.
  const minus = leeresBlatt();
  minus.gelb[1] = [6, 6, 6, null, null];
  const mw = werten(minus);
  pruefe('Negative Summe ist erlaubt', mw.gesamt, -18);
  pruefe('Negative Summe bekommt einen Titel', typeof mw.titel, 'string');
}

// -------------------------------------------------- Würfel und Rundenablauf

/** Liefert genau die angegebenen Würfelwerte, der Reihe nach. */
function festeWuerfel(werte: number[]): Rng {
  let i = 0;
  return () => (werte[i++ % werte.length] - 1 + 0.5) / 6;
}

const werte = (w: { wert: number }[]) => w.map((x) => x.wert);
const farben = (w: { farbe: string }[]) => w.map((x) => x.farbe);

{
  // Reihenfolge der Farben ist gelb, blau, grau, grün, pink, weiß.
  const stand = neueRunde(1, festeWuerfel([3, 5, 2, 5, 1, 6]));
  pruefe('Wurf: sechs Würfel', stand.offen.length, 6);
  pruefe('Wurf: feste Werte', werte(stand.offen), [3, 5, 2, 5, 1, 6]);
  pruefe('Wurf: Farbreihenfolge', farben(stand.offen), WUERFEL_FARBEN);
  pruefe('Runde beginnt aktiv', stand.phase, 'aktiv');
}

{
  // Blau (5) nehmen: alles unter 5 kommt aufs Tablett, 5 und 6 bleiben.
  const stand = neueRunde(1, festeWuerfel([3, 5, 2, 5, 1, 6]));
  const nach = nachWahl(stand, 1, festeWuerfel([4, 4]));
  pruefe('Wahl: Würfel liegt auf dem Feld', werte(nach.felder as { wert: number }[]), [5]);
  pruefe('Wahl: Niedrigere aufs Tablett', werte(nach.tablett).sort(), [1, 2, 3]);
  pruefe('Wahl: Gleiche bleiben in der Hand', nach.offen.length, 2);
  pruefe('Wahl: weitergewürfelt wird mit denselben Farben', farben(nach.offen), ['gruen', 'weiss']);
  pruefe('Wahl: zweiter Wurf', nach.wurf, 2);
}

{
  // Gleiche Werte sind nicht niedriger und bleiben liegen.
  const stand = neueRunde(1, festeWuerfel([4, 4, 4, 4, 4, 4]));
  const nach = nachWahl(stand, 0, festeWuerfel([2]));
  pruefe('Wahl: gleicher Wert wandert nicht aufs Tablett', nach.tablett.length, 0);
  pruefe('Wahl: fünf Würfel bleiben', nach.offen.length, 5);
}

{
  // Nach drei genommenen Würfeln ist die aktive Phase vorbei.
  let stand = neueRunde(1, festeWuerfel([6, 6, 6, 6, 6, 6]));
  stand = nachWahl(stand, 0, festeWuerfel([6]));
  stand = nachWahl(stand, 0, festeWuerfel([6]));
  stand = nachWahl(stand, 0, festeWuerfel([6]));
  pruefe('Aktiv: drei Würfelfelder belegt', stand.felder.length, 3);
  pruefe('Aktiv: keine offenen Würfel mehr', stand.offen.length, 0);
  pruefe('Aktiv: der Rest liegt auf dem Tablett', stand.tablett.length, 3);
}

{
  // Wer den höchsten Würfel zuerst nimmt, hat nichts mehr zum Weiterwürfeln.
  const stand = neueRunde(1, festeWuerfel([1, 1, 1, 1, 1, 6]));
  const nach = nachWahl(stand, 5, festeWuerfel([1]));
  pruefe('Aktiv: zu früh hoch gewählt beendet den Zug', nach.offen.length, 0);
  pruefe('Aktiv: nur ein Würfelfeld belegt', nach.felder.length, 1);
}

{
  // Verzichten verbraucht ein Würfelfeld, ohne etwas einzutragen.
  const stand = neueRunde(1, festeWuerfel([2, 2, 2, 2, 2, 2]));
  const nach = verzichten(stand, festeWuerfel([3]));
  pruefe('Verzicht: Feld bleibt leer, ist aber verbraucht', nach.felder, [null]);
  pruefe('Verzicht: es wird neu gewürfelt', nach.offen.length, 6);
  pruefe('Verzicht: nächster Wurf', nach.wurf, 2);
}

{
  // Der weiße Würfel bleibt auffindbar, auch wenn er auf dem Tablett landet.
  const stand = neueRunde(1, festeWuerfel([6, 1, 1, 1, 1, 2]));
  pruefe('Weiß: Wert im Wurf', weisserWert(stand), 2);
  const nach = nachWahl(stand, 0, festeWuerfel([1]));
  pruefe('Weiß: liegt jetzt auf dem Tablett', farben(nach.tablett).includes('weiss'), true);
  pruefe('Weiß: Wert weiterhin bekannt', weisserWert(nach), 2);
}

{
  // Passive Phase: die drei niedrigsten aufs Tablett, die drei hohen daneben.
  const stand = startePassiv(neueRunde(1, festeWuerfel([1, 1, 1, 1, 1, 1])), festeWuerfel([4, 2, 6, 1, 5, 3]));
  pruefe('Passiv: Phase gewechselt', stand.phase, 'passiv');
  pruefe('Passiv: drei niedrige aufs Tablett', werte(stand.tablett), [1, 2, 3]);
  pruefe('Passiv: drei hohe auf den Feldern', werte(stand.passivFelder), [4, 5, 6]);
}

{
  // Vom Tablett wird gewählt; nur wenn dort nichts geht, die hohen Würfel.
  const blatt = leeresBlatt();
  const stand = startePassiv(neueRunde(1, festeWuerfel([1, 1, 1, 1, 1, 1])), festeWuerfel([4, 2, 6, 1, 5, 3]));
  const waehlbar = passivWaehlbar(stand, blatt);
  pruefe('Passiv: Auswahl kommt vom Tablett', waehlbar.length > 0, true);
  pruefe(
    'Passiv: nur Tablettwürfel',
    waehlbar.every((w) => stand.tablett.includes(w)),
    true,
  );
}

{
  // Rundenwechsel und Spielende.
  const stand = neueRunde(1, festeWuerfel([1]));
  pruefe('Rundenwechsel: weiter zu Runde 2', naechsteRunde(stand, festeWuerfel([1])).runde, 2);
  const letzte = neueRunde(RUNDEN, festeWuerfel([1]));
  pruefe('Rundenwechsel: nach der letzten ist Schluss', naechsteRunde(letzte, festeWuerfel([1])).phase, 'spielende');
}

// ----------------------------------------------------------- Mögliche Ziele

{
  const blatt = leeresBlatt();

  // Der weiße Würfel ist Joker für vier Bereiche – für Blau nie, dort gibt er
  // die Spalte vor.
  const weissZiele = moeglicheZiele(blatt, { farbe: 'weiss', wert: 4 }, 4);
  pruefe('Weiß: nie für Blau', weissZiele.some((z) => z.bereich === 'blau'), false);
  pruefe(
    'Weiß: Joker für die übrigen vier',
    [...new Set(weissZiele.map((z) => z.bereich))].sort(),
    ['gelb', 'grau', 'gruen', 'pink'],
  );

  // Die kleinere Startfläche hat 4 Felder – mit einer 3 ist Grau noch zu.
  const weissDrei = moeglicheZiele(blatt, { farbe: 'weiss', wert: 3 }, 3);
  pruefe('Weiß: mit 3 ist Grau noch verschlossen', weissDrei.some((z) => z.bereich === 'grau'), false);

  // Blau: Zeile aus dem blauen, Spalte aus dem weißen Würfel.
  const blauZiele = moeglicheZiele(blatt, { farbe: 'blau', wert: 3 }, 5);
  pruefe('Blau: genau ein Feld', blauZiele.length, 1);
  pruefe('Blau: Zeile 3, Spalte 5', blauZiele[0].ziel, [2, 4]);

  // Ohne weißen Würfel geht Blau nicht.
  pruefe('Blau: ohne weißen Würfel kein Ziel', moeglicheZiele(blatt, { farbe: 'blau', wert: 3 }, null).length, 0);

  // Gelb bietet auf dem leeren Blatt alle drei Reihen an.
  pruefe('Gelb: drei Reihen zur Wahl', moeglicheZiele(blatt, { farbe: 'gelb', wert: 4 }, 1).length, 3);

  // Eine 1 reicht für keine graue Startfläche.
  pruefe('Grau: 1 findet kein Ziel', moeglicheZiele(blatt, { farbe: 'grau', wert: 1 }, 1).length, 0);
}

{
  // Ein voller Bereich bietet nichts mehr an.
  const blatt = leeresBlatt();
  blatt.pink = blatt.pink.map(() => 1);
  pruefe('Pink: volle Leiste ohne Ziel', moeglicheZiele(blatt, { farbe: 'pink', wert: 4 }, 1).length, 0);
}

// ------------------------------------------------- Ein ganzes Spiel am Stück

/** Einfacher Zufall mit festem Startwert, damit der Durchlauf reproduzierbar ist. */
function gesaetsterZufall(saat: number): Rng {
  let zustand = saat >>> 0;
  return () => {
    zustand = (zustand * 1664525 + 1013904223) >>> 0;
    return zustand / 0x100000000;
  };
}

{
  // Sechs Runden mit aktiver und passiver Phase durchspielen. Gewählt wird
  // stumpf das erste mögliche Ziel – es geht nicht um gutes Spiel, sondern
  // darum, dass der Ablauf ohne Sackgasse durchläuft und die Wertung greift.
  const rng = gesaetsterZufall(20260907);
  let blatt = leeresBlatt();
  let stand = neueRunde(1, rng);
  let eintraege = 0;
  let verzichte = 0;

  for (let runde = 1; runde <= RUNDEN; runde++) {
    while (stand.phase === 'aktiv' && stand.offen.length > 0) {
      const weiss = weisserWert(stand);
      const index = stand.offen.findIndex((w) => moeglicheZiele(blatt, w, weiss).length > 0);

      if (index === -1) {
        stand = verzichten(stand, rng);
        verzichte++;
        continue;
      }

      blatt = eintragen(blatt, moeglicheZiele(blatt, stand.offen[index], weiss)[0]).blatt;
      eintraege++;
      stand = nachWahl(stand, index, rng);
    }

    stand = startePassiv(stand, rng);
    const waehlbar = passivWaehlbar(stand, blatt);
    if (waehlbar.length > 0) {
      blatt = eintragen(blatt, moeglicheZiele(blatt, waehlbar[0], weisserWert(stand))[0]).blatt;
      eintraege++;
    }

    stand = naechsteRunde(stand, rng);
  }

  pruefe('Ganzes Spiel: endet nach sechs Runden', stand.phase, 'spielende');
  pruefe('Ganzes Spiel: höchstens 4 Einträge pro Runde', eintraege <= RUNDEN * 4, true);
  pruefe('Ganzes Spiel: es wurde etwas eingetragen', eintraege > 10, true);

  const w = werten(blatt);
  const summe = w.gelb + w.blau + w.grau + w.gruen + w.pink + w.fuechse;
  pruefe('Ganzes Spiel: Gesamtpunkte sind die Summe der Bereiche', w.gesamt, summe);
  pruefe('Ganzes Spiel: Titel vergeben', typeof w.titel === 'string' && w.titel.length > 0, true);
  console.log(
    `         ${eintraege} Einträge, ${verzichte} Verzichte, ${blatt.fuechse} Füchse\n` +
      `         Gelb ${w.gelb}, Blau ${w.blau}, Grau ${w.grau}, Grün ${w.gruen}, ` +
      `Pink ${w.pink}, Füchse ${w.fuechse} → ${w.gesamt} „${w.titel}"`,
  );
}

console.log(fehler === 0 ? '\nAlle Prüfungen bestanden.' : `\n${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
