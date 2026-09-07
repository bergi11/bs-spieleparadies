# Clever 4Ever – ausgelesene Regeln und Blattdaten

Grundlage für das Spiel `clever` in `src/games/clever/`. Zusammengetragen aus
der englischen Anleitung und dem Spielblatt (beide als PDF vorgelegt). Der
Regeltext ließ sich direkt extrahieren; die Zahlen und Feldformen des Blattes
stammen aus dem Textlayer des PDFs und aus Farbmessungen am gerenderten Blatt.

> Nachgebaut wird die **Solo-Variante**. Punktstände sollen mit dem Papierspiel
> übereinstimmen; die Optik folgt unserem Stil, nicht dem Blatt.

## Ablauf (Solo)

6 Runden. Jede Runde besteht aus zwei Phasen:

1. **Aktive Phase** – 3 Würfe. Beim ersten Wurf alle 6 Würfel; einen davon auf
   eines der 3 Würfelfelder legen und im passenden Bereich eintragen. Danach
   wandern **alle Würfel mit niedrigerem Wert** aufs Tablett (gleiche Werte
   bleiben). Mit den übrigen weiterwürfeln, insgesamt dreimal.
2. **Passive Phase** – alle 6 Würfel werfen, die **3 niedrigsten** aufs Tablett
   legen, einen der verbleibenden 3 eintragen.

Wer einen hohen Würfel zu früh nimmt, hat für die späteren Würfe nichts mehr
übrig – das ist die zentrale Abwägung. Man *muss* keinen Würfel nehmen, verliert
dann aber den Wurf.

Rundenboni (nur Runden 1–4), werden zu Beginn der Runde vergeben:

| Runde | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Bonus | Neuwurf | +1 | weißer Würfel | schwarzes ? | – | – |

Der weiße Würfel ist Joker für Gelb, Grau, Grün und Pink – **nicht** für Blau.
Für Blau wird er als Spaltenangabe gebraucht.

Im Solospiel ist die Aktion **„Umdrehen" gesperrt**.

## Die fünf Bereiche

### Gelb – Würfelwert eintragen

3 Reihen à 5 Felder. Pro Würfel eine Reihe wählen, von links das nächste freie
Feld füllen, kein Überspringen.

- **Obere Reihe:** jeder Eintrag muss größer sein als der linke Nachbar. Nach
  einer 6 ist die Reihe zu.
- **Mittlere Reihe:** beliebige Werte, Summe zählt am Ende **negativ**.
- **Untere Reihe:** beliebige Werte, Summe zählt **positiv**. Keine Boni.
- **Vollständige Spalten:** 10 / 10 / 15 / 15 / 20 Punkte.

### Blau – Feld ankreuzen

6×6-Gitter. Der **blaue Würfel bestimmt die Zeile**, der **weiße die Spalte**
(nicht addieren). Kreuz am Schnittpunkt.

- **Zeilenbonus** bei genau 2 Kreuzen in einer Zeile; ebenso für 2 Kreuze auf
  der Diagonale oben links → unten rechts.
- **Zeilenboni:** Zeile 1 grünes ?, 2 lila ?, 3 gelbes ?, 4 „+1", 5 oranges ?,
  Zeile 6 keiner.
- **Spaltenwertung** ab 2 Kreuzen: 7 / 8 / 9 / 10 / 11 / 12.
- **Diagonale** oben rechts → unten links ab 2 Kreuzen: 6 Punkte.

### Grau (orange gerahmt) – Teilflächen abkreuzen

Raster aus **16 Spalten × 4 Zeilen**. Zusammenhängende Felder gleicher Färbung
bilden eine Teilfläche. Der Würfelwert muss **mindestens so groß** sein wie die
Teilfläche Felder hat; Überschuss verfällt. Es wird die ganze Teilfläche auf
einmal abgekreuzt.

Start nur in einer der beiden rot umrandeten Teilflächen. Danach muss jede neue
Teilfläche **orthogonal an ein bereits abgekreuztes Feld grenzen**.

Färbung (W = weiß, H = hellgrau, D = dunkelgrau), Spalte 1 bis 16:

```
Z1: D W W H H H H W W H H D H H D D
Z2: H W W D D D H W W W H D H W D D
Z3: H H W H H D W D D H H W H W W D
Z4: H D D H D D W D D H W W H W H D
```

Rot umrandete Startflächen: Spalte 1 in Zeile 1–2 sowie Spalte 1–2 in Zeile 3–4.

**Spaltenwertung** bei vollständig abgekreuzter Spalte:
1, 2, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11.

Wer alle Felder einer Färbung abkreuzt, bekommt den passenden Fuchs.

### Grün – Würfelwert eintragen

Felder mit oberem und unterem Dreieck; beim Eintragen entscheidet man sich für
oben oder unten. Beide „Reihen" werden von links gefüllt, kein Überspringen.

- Sind **beide Dreiecke** eines Feldes gefüllt, wird die Summe ins Punktfeld
  darüber geschrieben. **Ab Feld 4 zählt diese Summe doppelt** (8 x2-Felder).
- Boni nur unter den **unteren** Dreiecken.
- Felder mit nur einer Zahl geben keine Punkte.

### Pink – Würfelwert eintragen

12 Felder, von links ohne Überspringen. Der eingetragene Wert wirkt sofort:

| Wert | Wirkung |
| --- | --- |
| 1 | nichts |
| 2 | einkreisen, am Ende +2 |
| 3 | sofort eine 3 ins nächste Feld eintragen |
| 4 | einkreisen, am Ende +4 |
| 5 | Bonus unter dem Feld |
| 6 | Bonus unter dem Feld, einkreisen, am Ende +3 |

Ein Bonus unter einem Feld gibt es also **nur bei 5 oder 6**.

**Wertung:** Punkte über dem zuletzt gefüllten Feld, plus die eingekreisten
Werte. Feldwerte: 2, 4, 6, 9, 12, 15, 19, 23, 27, 32, 37, 42.

## Boni

- **?-Bonus:** sofort einsetzen. Man wählt eine Zahl 1–6 und trägt sie im
  Bereich der Bonusfarbe ein, als hätte man sie gewürfelt. Beim blauen ? darf
  ein beliebiges freies Feld angekreuzt werden. Das schwarze ? lässt zusätzlich
  die Farbe frei.
- **Aktionen** (Neuwurf, Extrawürfel, Silber polieren) werden freigeschaltet und
  später verbraucht. Freischalten von links nach rechts; am Ende jeder Leiste
  wartet ein weiterer Bonus. Pro Zug beliebig viele einsetzbar.
- **Füchse** geben am Ende je so viele Punkte wie der **schwächste Bereich**.

## Endwertung

Summe der fünf Bereiche, dazu Füchse × schwächster Bereich.

| Punkte | Titel |
| --- | --- |
| > 450 | Clever forever! |
| 420–449 | Nochmal! So schlau. |
| 390–419 | Hey, Einstein! |
| 360–389 | Deine Freunde beneiden dich. |
| 330–359 | Ganz schön clever! |
| 300–329 | Wunderkind in Ausbildung. |
| 270–299 | Es geht aufwärts. |
| 240–269 | Mann, keine Sorge! |
| 210–239 | Da ist noch Luft nach oben. |
| 180–209 | Die Würfel wollten wohl nicht. |
| < 179 | Reden wir über etwas anderes… |

## Bonusfelder

Alle Angaben sind in `src/games/clever/sheet.ts` hinterlegt.

**Gelb** – obere Reihe: –, weißer Würfel, oranges ?, grünes ?, **Fuchs**.
Mittlere Reihe: Neuwurf, lila ?, blaues ?, +1, gelbes ?. Untere Reihe: keine.

**Grün** (unter den unteren Dreiecken, Feld 1–11): Neuwurf, blaues ?, weißer
Würfel, gelbes ?, oranges ?, +1, lila ?, blaues ?, gelbes ?, **Fuchs**, +1.

**Pink** (greift nur bei 5 oder 6, Feld 1–12): weißer Würfel, –, grünes ?, +1,
Neuwurf, –, oranges ?, **Fuchs**, –, blaues ?, –, gelbes ?.

**Grau** (Zeile,Spalte jeweils 0-basiert): 0,0 weißer Würfel · 0,5 grünes ? ·
0,12 weißer Würfel · 1,7 Neuwurf · 1,15 grünes ? · 2,3 lila ? · 2,5 weißer
Würfel · 2,9 weißer Würfel · 2,13 blaues ? · 3,0 Neuwurf · 3,7 +1 ·
3,11 gelbes ? · 3,14 weißer Würfel.

Orange steht dabei für den grauen Bereich, lila für den pinken – so sind die
Bonussymbole auf dem Blatt eingefärbt.

## Aktionsleisten

Neuwurf 7 Felder mit einem lila ? am Ende, Extrawürfel 7 Felder, Silber
polieren 9 Felder (als 3×3-Block gedruckt).

## Teilflächen im grauen Bereich

Aus dem Raster berechnet ergeben sich **15 Teilflächen** mit den Größen
2, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7. Die beiden Startflächen sind die
weiße oben links und die hellgraue darunter.

## Stand der Umsetzung

`src/games/clever/logic.ts` enthält den Regelkern: Zugprüfung je Bereich,
Eintragen samt ausgelösten Boni, Teilflächenberechnung und die vollständige
Endwertung.

`src/games/clever/wuerfel.ts` enthält Würfel und Rundenablauf. Der Zufall
kommt als `Rng` von außen herein, damit sich Runden mit festen Würfelfolgen
durchspielen lassen. Wichtigste Funktion für die Oberfläche ist
`moeglicheZiele(blatt, wuerfel, weiss)`: sie liefert alle erlaubten Einträge
für einen Würfel – damit lässt sich hervorheben, wo er verwendbar ist, und es
können nur erlaubte Züge angeboten werden.

Der weiße Würfel wird dort gesondert behandelt: Joker für Gelb, Grau, Grün und
Pink, aber nie für Blau – dort gibt sein Wert die Spalte vor, unabhängig davon,
wo er gerade liegt. `weisserWert(stand)` sucht ihn deshalb über alle Ablagen.

`npm run check:clever` prüft beides: die Punktbeispiele der Anleitung
(Gelb 49, Blau 25, Grau 55, Grün 42, Pink 32), die Zugregeln, den
Würfelablauf mit festen Würfelfolgen und einen vollständigen Sechs-Runden-
Durchlauf.

Noch nicht gebaut: Einlösen der Boni und Aktionen sowie die Oberfläche.

## Unsicher

Bei Pink Feld 1 widersprechen sich Textlayer (dort steht „+1") und Blattbild
(dort ist ein weißer Würfel zu sehen). Übernommen ist das Bild. Falls beim
Spielen etwas nicht passt, ist das die erste Stelle zum Nachsehen.

## So geht es weiter

Schritt 3 ist erledigt. Offen ist Schritt 4:

4. **Oberfläche.** Ein Bereich pro Ansicht mit Farbleiste unten; nach dem Wurf
   über `moeglicheZiele` hervorheben, wo der Würfel verwendbar ist. Danach das
   Einlösen der Boni und die Aktionsleisten.

Beim Bonussystem ist noch offen, wie ein ?-Bonus abgefragt wird: er wird sofort
eingelöst, dabei wählt man eine Zahl von 1 bis 6 und trägt sie im Bereich der
Bonusfarbe ein – beim schwarzen ? zusätzlich die Farbe. Das braucht einen
eigenen Zwischenschritt in der Oberfläche, weil währenddessen kein Würfel
gewählt wird.

Ebenfalls offen sind die drei Aktionen. „Umdrehen" ist im Solospiel gesperrt,
die anderen greifen in den Würfelablauf ein: Neuwurf wirft die eben geworfenen
Würfel neu, Extrawürfel hängt am Zugende einen beliebigen Würfel an, Silber
polieren verändert einen Tablettwürfel um ±1 (nie von 1 auf 6 oder umgekehrt).

Der Spielstand gehört wie bei den anderen Spielen über
`useGameSave(user.id, 'clever', …)` in die Datenbank, und das Spiel braucht
einen Eintrag in `src/games/registry.ts`.

## Wenn etwas nachgemessen werden muss

Die Vorlagen liegen außerhalb des Repos:
`C:\Users\lucas\OneDrive\Desktop\clever4_v2.pdf` (Blatt) und
`CLEVER_4EVER_English_Rules.pdf` (Anleitung).

Der Regeltext geht direkt mit dem `pdftotext`, das bei Git für Windows
mitkommt:

```bash
pdftotext -layout CLEVER_4EVER_English_Rules.pdf regeln.txt
```

Für das Blatt gibt es hier weder `pdftoppm` noch einen PDF-Betrachter im
Browser. Was funktioniert hat: die PDF nach `dist/` kopieren, eine kleine
HTML-Seite danebenlegen, die sie mit pdf.js von cdnjs in ein Canvas rendert,
und dann über `wrangler dev` aufrufen. Zwei Dinge waren dabei entscheidend:

- **Auf das Ende des Renderns warten.** Screenshots davor zeigen halb
  gezeichnete Bilder und führen völlig in die Irre – das hat mich mehrere
  Fehlschlüsse gekostet. Die Seite setzt am Ende `document.title`.
- **Nicht auf Bildschirmmaße verlassen.** Zuverlässig waren der Textlayer
  (`page.getTextContent()` liefert jede Zahl mit Koordinaten) und
  Farbmessungen im Canvas. Ein Blatt ist die linke Seitenhälfte:
  `x 11–702, y 10–989` bei einer Seitengröße von 1414×1000.
