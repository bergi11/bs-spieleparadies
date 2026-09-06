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

## Ein Spiel hinzufügen

1. Ordner unter `src/games/<name>/` anlegen mit einer Komponente, die
   `GameProps` (`user`, `onExit`) entgegennimmt.
2. Spielstand über `useGameSave(user.id, '<spiel-id>', startwert)` laden und
   speichern – der Hook kümmert sich um Verzögerung und Fehlerfälle.
3. Eintrag in `src/games/registry.ts` ergänzen. Launchpad und Routing ziehen
   sich alles Weitere von dort.

## Wortlisten

Die Listen für *Wörtchen* liegen fertig als JSON im Repo. `npm run words`
erzeugt sie neu aus den Originalquellen:

- Lösungswörter: kuratierte Liste aus [wordle-de](https://github.com/wordle-de/wordle-de.github.io) (MIT)
- Zusätzliche erlaubte Rateworte: [Wortliste von davidak](https://github.com/davidak/wortliste)

Die 1017 Lösungswörter reichen für rund 2,8 Jahre tägliche Rätsel, danach
beginnt die Reihenfolge von vorn.
