# BS Spieleparadies

Private, werbefreie Spielesammlung für zwei Personen. Wird fast ausschließlich
auf dem Handy gespielt, oft nebenbei und mit einer Hand.

## Rahmen

Diese Punkte sind gesetzt. Wenn eine Aufgabe dagegen läuft, erst nachfragen.

- **Handy zuerst.** Jede Oberfläche wird für Touch auf einem schmalen Display
  entworfen. Desktop darf funktionieren, ist aber nie der Maßstab.
- **Keine Werbung, kein Tracking, keine Analytics.** Auch nicht "nur zum Testen".
- **Kostenlos hostbar.** Alles muss im kostenlosen Tarif von Cloudflare Workers
  und D1 laufen. Keine Dienste, die eine Kreditkarte oder ein Abo verlangen.
- **Wenige Abhängigkeiten.** Spiele werden selbst gebaut, nicht eingebunden.
  Eine neue Laufzeit-Abhängigkeit braucht einen Grund, der im Commit steht.
  Für Dinge wie Zustandsverwaltung, Routing oder UI-Bibliotheken gilt: nein.
- **Bestehende Spielstände bleiben lesbar.** Ändert sich das Format eines
  Spielstands, muss der alte Stand weiterhin sinnvoll geladen werden können.
  Niemand soll seine Serie verlieren, weil wir etwas umgebaut haben.

## Technik

| Teil      | Womit                                             |
| --------- | ------------------------------------------------- |
| Frontend  | React 18 + TypeScript, gebaut mit Vite            |
| Backend   | Cloudflare Worker unter `worker/`                 |
| Datenbank | Cloudflare D1 (SQLite)                            |

```bash
npm run dev        # Frontend; /api geht per Proxy an Wrangler auf Port 8787
npm run preview    # Wrangler mit Worker und lokaler D1
npm run typecheck  # prüft Frontend und Worker getrennt
npm run build
```

Voraussetzung ist **Node 22 oder neuer**: Wrangler verlangt >= 22, Vite >= 20.19.

`npm run typecheck` läuft über zwei getrennte Projekte: `tsconfig.json` für
`src/` mit DOM-Typen, `worker/tsconfig.json` für das Backend mit den
Workers-Typen. Beide zusammen in einem Projekt kollidieren bei `Request` und
`Response` – die Trennung bitte nicht zusammenführen.

## Backend-Routing

Statische Dateien liefert Cloudflare direkt aus `dist/` aus; nur `/api/*` geht
durch den Worker (`run_worker_first` in `wrangler.toml`). Eine dateibasierte
Weiterleitung wie bei Pages gibt es nicht: ein neuer Endpunkt braucht einen
Handler in `worker/routes/` **und** einen Eintrag in der `ROUTES`-Tabelle in
`worker/index.ts`. Fehlt der Eintrag, antwortet der Pfad mit 404.

## Konventionen

- **Sichtbare Texte und Kommentare auf Deutsch**, Bezeichner im Code auf
  Englisch (`function evaluate`, `const guesses`). So liest sich die
  Oberfläche natürlich, ohne dass der Code zum Mischmasch wird.
- Kommentare erklären das *Warum*, nicht das *Was*. Wenn eine Zeile nur
  wiederholt, was daneben steht, gehört sie weg.
- Kein CSS-Framework. Styling läuft über `src/styles.css` mit den dort oben
  definierten Variablen. Neue Farben werden dort ergänzt, nicht inline gesetzt.
- Touch-Ziele mindestens 44 px hoch. Eingabefelder mindestens 16 px Schriftgröße,
  sonst zoomt iOS beim Fokussieren hinein.
- Layouts benutzen `dvh` statt `vh` und berücksichtigen `env(safe-area-inset-*)`.

## Anmeldung und Profile

Es gibt **ein gemeinsames Passwort** für die ganze Seite (`SITE_PASSWORD`).
Nach dem Login setzt `worker/lib/auth.ts` ein signiertes HttpOnly-Cookie.

Die Profile dahinter sind **reine Namensschilder, kein Sicherheitsmerkmal**.
Wer die Seite offen hat, kann jedes Profil auswählen und dessen Spielstände
ändern. Das ist so gewollt. Also: keine Funktion bauen, die sich darauf
verlässt, dass ein Profil "dem richtigen Menschen gehört" – kein Passwortschutz
pro Profil, keine privaten Inhalte, keine Zugriffsprüfung anhand des Profils.

## Ein Spiel hinzufügen

1. Ordner `src/games/<name>/` mit einer Komponente, die `GameProps`
   (`user`, `onExit`) entgegennimmt.
2. Spiellogik in eine eigene Datei ohne React (siehe `wordle/logic.ts`), damit
   sie für sich prüfbar bleibt.
3. Spielstand über `useGameSave(user.id, '<spiel-id>', startwert)`. Der Hook
   verzögert das Schreiben und schreibt erst, nachdem er geladen hat – ein
   leerer Startzustand darf nie einen echten Stand überschreiben.
4. Eintrag in `src/games/registry.ts`. Launchpad und Routing lesen von dort;
   sonst muss nichts angefasst werden.

Die Spiel-ID ist der Schlüssel in der Datenbank. Einmal veröffentlicht, wird
sie nicht mehr umbenannt.

## Datenbank

Schema steht in `schema.sql` und ist idempotent (`CREATE TABLE IF NOT EXISTS`).
Änderungen werden dort ergänzt und mit `npm run db:local` sowie `npm run db:remote`
eingespielt. Es gibt kein Migrationswerkzeug – Spalten also nur hinzufügen,
nicht umbenennen oder entfernen.

## Nicht ins Repo

`.dev.vars`, echte Passwörter, `SESSION_SECRET`. Secrets für die
veröffentlichte Seite gehören zu `wrangler secret put` – niemals unter
`[vars]` in die `wrangler.toml`, die liegt im Repo.

## Stand der Dinge

- Fertig: Login, Profile, Launchpad, Spielstände, Wörtchen (deutsches Wordle)
  und Wortsalat (Buchstabenrad mit Kreuzworträtsel).
- Fertig, aber noch wenig gespielt: Clever 4Ever (Würfelspiel, Solo-Variante).
  Regeln, Blattdaten und die getroffenen Annahmen: `docs/clever-4ever.md`.
  Dazu Galgenmännchen (klassisches Hangman, elf Fehlversuche).
- Neu und noch ungespielt:
  - Schnittpunkte – 4x4-Gitter aus Kategorien und Schreibweise-Eigenschaften,
    Lösungen tippt man selbst ein.
  - Wolkenkratzer – Höhen 1..n, Sichthinweise am Rand, 4x4 bis 6x6.
  - Bildgitter – Nonogramm, Bilder von Hand gezeichnet, 5x5 bis 10x10.
  - Brücken – Hashiwokakero, Inseln zu einem Netz verbinden, 7x7 und 9x9.
  - Kreuzchen – Mini-Kreuzworträtsel 5x5. Wörter und Hinweise stehen von Hand
    im Erzeugerskript; die Gitter sucht es sich daraus zusammen.

  Die drei Logikspiele folgen demselben Muster: Der Erzeuger nimmt nur Rätsel
  auf, die ein Solver ohne Raten löst. Derselbe Solver steht im Regelkern des
  Spiels, und das Prüfskript schickt ihn über die fertigen Daten – so können
  Erzeuger und Spiel nicht auseinanderlaufen.
- Es gibt **kein Testframework**. Wird eins gebraucht, vorher kurz abstimmen.
  Einzelne Regelkerne werden stattdessen mit einem einfachen Prüfskript
  abgesichert, das Node direkt ausführt – siehe `npm run check:clever`,
  `npm run check:intersections`, `npm run check:skyscrapers`,
  `npm run check:nonograms`, `npm run check:bridges` und
  `npm run check:crossword`.
- Die JSON-Dateien unter `src/games/*/` sind erzeugt, nicht handgepflegt:
  `npm run words` für Wörtchen, `npm run words:puzzle` für die Level von
  Wortsalat, `npm run words:hangman` für die Rätselwörter des Galgenmännchens,
  `npm run words:intersections` für Wortlisten, Regeln und Rätsel der
  Schnittpunkte, `npm run puzzles:skyscrapers` für die Rätsel der Wolkenkratzer,
  `npm run puzzles:nonograms` für die Bilder des Bildgitters – die Zeichnungen
  selbst stehen im Skript – und `npm run puzzles:bridges` für die Inselkarten,
  `npm run puzzles:crossword` für die Kreuzwortgitter.
  Nie direkt bearbeiten – Änderungen gehören ins jeweilige Skript unter
  `scripts/`. Das gilt genauso für die PNG-Icons unter `public/`:
  `npm run icons` zeichnet sie aus derselben Geometrie wie `icon.svg`.
- Die Seite lässt sich auf dem Handy als App auf den Homebildschirm legen.
  Dafür hängen `index.html`, `public/manifest.webmanifest` und die Icons
  zusammen – iOS nimmt für das Symbol nur das `apple-touch-icon` als PNG.
  Es gibt bewusst **keinen Service Worker**: iOS braucht für den
  Homebildschirm keinen, und ein hängender Cache wäre auf dem Handy schwer
  wieder loszuwerden.
