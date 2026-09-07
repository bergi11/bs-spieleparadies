# BS Spieleparadies

Eine kleine, werbefreie Spielesammlung für zwei Personen. Mobil-first, als
Web-App aufs Handy installierbar, mit Profilen und serverseitig gespeicherten
Spielständen.

## Aufbau

| Teil      | Technik                                |
| --------- | -------------------------------------- |
| Frontend  | React + TypeScript, gebaut mit Vite    |
| Backend   | Cloudflare Worker (`worker/`)          |
| Datenbank | Cloudflare D1 (SQLite)                 |
| Hosting   | Cloudflare Workers (kostenloser Tarif) |

Es gibt ein gemeinsames Passwort für die ganze Seite. Die Profile dahinter sind
nur Namensschilder zum Auseinanderhalten der Spielstände – kein Login.

```
src/
  games/          ein Ordner pro Spiel
    registry.ts   zentrale Spieleliste (Launchpad + Routing lesen daraus)
    wordle/
  screens/        Login, Profilauswahl, Launchpad
  lib/            API-Client, Spielstand-Hook, Mini-Router
worker/
  index.ts        Einstiegspunkt: Router und Zugriffsschutz
  routes/         die Endpunkte: login, session, users, saves
  lib/            HTTP-Hilfen und signiertes Sitzungs-Cookie
schema.sql        Tabellen für D1
```

### Wie die Anfragen laufen

Statische Dateien liefert Cloudflare direkt aus `dist/` aus. Nur `/api/*` geht
durch den Worker – das legt `run_worker_first` in [`wrangler.toml`](wrangler.toml)
fest. Alles andere startet den Worker gar nicht erst.

Ein neuer Endpunkt braucht deshalb zwei Dinge: einen Handler in `worker/routes/`
und einen Eintrag in der `ROUTES`-Tabelle in [`worker/index.ts`](worker/index.ts).
Pfade, die dort nicht stehen, antworten mit 404, falsche Methoden mit 405.

## Einrichtung

Voraussetzung: **Node 22 oder neuer** (Wrangler verlangt >= 22, Vite >= 20.19).

```bash
npm install
```

### 1. Datenbank anlegen

```bash
npx wrangler d1 create bs-spieleparadies
```

Die ausgegebene `database_id` in [`wrangler.toml`](wrangler.toml) eintragen.
Danach das Schema einspielen – einmal lokal, einmal in der Cloud:

```bash
npm run db:local
```

```bash
npm run db:remote
```

### 2. Passwort setzen

Für die lokale Entwicklung eine Datei `.dev.vars` anlegen (steht in
`.gitignore`, landet also nicht im Repo):

```
SITE_PASSWORD=hier-euer-passwort
SESSION_SECRET=irgendeine-lange-zufallszeichenkette
```

Für die veröffentlichte Seite dieselben zwei Werte als Secrets hinterlegen.
Sie gehören **nicht** unter `[vars]` in die `wrangler.toml` – die liegt im Repo.

```bash
npx wrangler secret put SITE_PASSWORD
```

```bash
npx wrangler secret put SESSION_SECRET
```

### 3. Lokal entwickeln

Zwei Terminals:

```bash
npm run dev
```

```bash
npx wrangler dev
```

Vite liefert das Frontend mit Hot Reload aus und reicht `/api`-Anfragen an
Wrangler auf Port 8787 weiter. Wer nur den gebauten Stand sehen will, kommt mit
`npm run build` und `npx wrangler dev` allein aus.

### 4. Veröffentlichen

```bash
npm run deploy
```

Alternativ das Repo im Cloudflare-Dashboard verbinden: **Workers & Pages →
Create → Workers → Import a repository**. Build-Befehl `npm run build`,
Deploy-Befehl `npx wrangler deploy`. Dann veröffentlicht jeder Push auf `main`
automatisch.

### 5. Aufs Handy legen

Die Seite ist eine installierbare Web-App: Manifest, Icons und die passenden
Meta-Tags stecken in `index.html` und `public/`. Einmal auf den
Homebildschirm gelegt, startet sie ohne Adressleiste und mit eigenem Icon.

**iPhone (Safari):** Seite öffnen → Teilen-Symbol unten → *Zum
Home-Bildschirm*. In **Chrome auf dem iPhone** liegt derselbe Punkt unter dem
Teilen-Symbol oben rechts; ein eigenes „Installieren“ wie auf dem Desktop
gibt es unter iOS nicht, weil Apple dafür nur diesen Weg vorsieht.

**Android (Chrome):** Menü → *App installieren*.

Die so installierte App hat unter iOS **einen eigenen Cookie-Speicher**. Das
Passwort und das Profil müssen dort also einmal neu eingegeben werden, auch
wenn man im Browser schon angemeldet war.

Die Icons unter `public/*.png` sind erzeugt, nicht gemalt. Wer die Farben oder
die Form ändern will, passt `scripts/build-icons.mjs` an und lässt
`npm run icons` laufen. iOS behält ein einmal gewähltes Icon allerdings häufig
im Cache – nach einer Änderung die App vom Homebildschirm löschen und neu
ablegen.

## Ein Spiel hinzufügen

1. Ordner unter `src/games/<name>/` anlegen mit einer Komponente, die
   `GameProps` (`user`, `onExit`) entgegennimmt.
2. Spielstand über `useGameSave(user.id, '<spiel-id>', startwert)` laden und
   speichern – der Hook kümmert sich um Verzögerung und Fehlerfälle.
3. Eintrag in `src/games/registry.ts` ergänzen. Launchpad und Routing ziehen
   sich alles Weitere von dort.

## Wortlisten und Level

Alle Wortdaten liegen fertig als JSON im Repo und werden nicht von Hand
gepflegt. Beide Spiele trennen dabei zwei Listen: eine großzügige, die
Eingaben *akzeptiert*, und eine strenge, aus der *angezeigt* wird. Die
großzügigen Listen enthalten viel Obskures, die strengen nur Wörter, die man
tatsächlich kennt.

### Wörtchen

`npm run words` erzeugt die Listen neu aus den Originalquellen:

- Lösungswörter: kuratierte Liste aus [wordle-de](https://github.com/wordle-de/wordle-de.github.io) (MIT)
- Zusätzliche erlaubte Rateworte: [Wortliste von davidak](https://github.com/davidak/wortliste)

Die 1017 Lösungswörter reichen für rund 2,8 Jahre tägliche Rätsel, danach
beginnt die Reihenfolge von vorn.

### Wortsalat

`npm run words:puzzle` erzeugt `levels.json` – 120 fertige Level mit
Grundwort, Kreuzworträtsel und Bonuswörtern:

- Erlaubte Eingaben: [Wortliste des Spiels Tanglet](https://github.com/kamilmielnik/scrabble-dictionaries)
- Häufigkeit für die Auswahl der angezeigten Wörter: [FrequencyWords](https://github.com/hermitdave/FrequencyWords)

Die Gitter entstehen zur Bauzeit, nicht im Browser. Dadurch ist jedes Level
garantiert lösbar und passt in maximal 9×9 Felder. Der Generator wirft
Grundwörter weg, deren Gitter zu groß würde oder die zu wenige Teilwörter
hergeben – deshalb liefert er weniger Level, als er Grundwörter durchprobiert.

Zwei Sperrlisten im Skript halten sauber, was die Häufigkeitsliste anspült:
Vornamen und englische Wörter aus den Untertiteln, und getrennt davon
Artikel, Pronomen und Hilfsverben. Letztere ergäben zwar gültige, aber öde
Rätsel – als Bonuswort zählen sie weiterhin.

### Schnittpunkte

`npm run words:intersections` erzeugt `daten.json` – Wortlisten, Regeln und
220 Rätsel in einer Datei. Anders als bei den anderen Spielen wandern die
Listen mit ins Spiel: Die Lösungen sind nicht vorgegeben, man denkt sie sich
selbst aus, also muss der Browser eine freie Eingabe beurteilen können.

Ein Rätsel ist ein 4x4-Gitter. Die Zeilen sind Kategorien ("Tiere"), die
Spalten Eigenschaften der Schreibweise ("beginnt mit S", "Doppelbuchstabe",
"Farbe versteckt"). Gesucht ist je Feld ein Wort, das beides erfüllt.

Die Kategorielisten stehen von Hand gepflegt im Skript. Automatisch beschaffte
Listen wären länger, brächten aber Fachbegriffe und lateinische Namen mit –
hier zählt, dass einem ein Wort beim Grübeln einfällt. Je länger die Listen,
desto seltener wird eine gute Eingabe abgelehnt.

Die Eigenschaften stehen als Daten in der JSON, nicht als Code: `{"art":
"anfang", "wert": "S"}`. Ausgewertet werden sie zweimal – beim Erzeugen im
Skript und im Spiel beim Prüfen einer Eingabe. `npm run check:intersections`
hält beide Auswertungen zusammen und prüft außerdem, dass jedes Feld mindestens
vier mögliche Wörter hat. Ein Feld mit nur einer Lösung wäre Raten statt Denken.
