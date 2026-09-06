# BS Spieleparadies

Eine kleine, werbefreie Spielesammlung für zwei Personen. Mobil-first, als
Web-App aufs Handy installierbar, mit Profilen und serverseitig gespeicherten
Spielständen.

## Aufbau

| Teil            | Technik                              |
| --------------- | ------------------------------------ |
| Frontend        | React + TypeScript, gebaut mit Vite  |
| Backend         | Cloudflare Pages Functions (`/api/*`)|
| Datenbank       | Cloudflare D1 (SQLite)               |
| Hosting         | Cloudflare Pages (kostenloser Tarif) |

Es gibt ein gemeinsames Passwort für die ganze Seite. Die Profile dahinter sind
nur Namensschilder zum Auseinanderhalten der Spielstände – kein Login.

```
src/
  games/          ein Ordner pro Spiel
    registry.ts   zentrale Spieleliste (Launchpad + Routing lesen daraus)
    wordle/
  screens/        Login, Profilauswahl, Launchpad
  lib/            API-Client, Spielstand-Hook, Mini-Router
functions/
  api/            Endpunkte: login, session, users, saves
  lib/auth.ts     signiertes Sitzungs-Cookie
schema.sql        Tabellen für D1
```

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

Für die veröffentlichte Seite dieselben zwei Werte als Secrets hinterlegen –
entweder im Cloudflare-Dashboard unter *Pages → Settings → Environment
variables* oder per CLI:

```bash
npx wrangler pages secret put SITE_PASSWORD
```

```bash
npx wrangler pages secret put SESSION_SECRET
```

### 3. Lokal entwickeln

Zwei Terminals:

```bash
npm run dev
```

```bash
npx wrangler pages dev
```

Vite liefert das Frontend aus und reicht `/api`-Anfragen an Wrangler weiter.

### 4. Veröffentlichen

```bash
npm run deploy
```

Alternativ das Repo im Cloudflare-Dashboard mit Pages verbinden – dann baut
jeder Push auf `main` automatisch (Build-Befehl `npm run build`,
Ausgabeverzeichnis `dist`).

## Ein Spiel hinzufügen

1. Ordner unter `src/games/<name>/` anlegen mit einer Komponente, die
   `GameProps` (`user`, `onExit`) entgegennimmt.
2. Spielstand über `useGameSave(user.id, '<spiel-id>', startwert)` laden und
   speichern – der Hook kümmert sich um Verzögerung und Fehlerfälle.
3. Eintrag in `src/games/registry.ts` ergänzen. Launchpad und Routing ziehen
   sich alles Weitere von dort.

## Wortlisten

Die Listen für *Wörtchen* liegen fertig als JSON im Repo. `scripts/build-words.mjs`
erzeugt sie neu aus den Originalquellen:

- Lösungswörter: kuratierte Liste aus [wordle-de](https://github.com/wordle-de/wordle-de.github.io) (MIT)
- Zusätzliche erlaubte Rateworte: [Wortliste von davidak](https://github.com/davidak/wortliste)

Die 1017 Lösungswörter reichen für rund 2,8 Jahre tägliche Rätsel, danach
beginnt die Reihenfolge von vorn.
