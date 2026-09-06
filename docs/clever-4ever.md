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

## Noch offen

Diese Angaben stehen noch nicht fest und müssen vor dem Bau des jeweiligen
Bereichs aus dem Blatt nachgezogen werden:

- Genaue Zuordnung der Bonusfelder in Gelb, Grau, Grün und Pink zu einzelnen
  Feldern. Die Farben und ungefähren Positionen sind gemessen, die Zuordnung
  Feld → Bonus fehlt.
- Aufbau der Aktionsleiste: Anzahl der Felder je Aktion und die Boni am
  Leistenende.
- Welche Teilflächen im grauen Bereich einen Fuchs tragen.
